const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

// Nombre del producto en un solo lugar (ventana, carpeta de datos). El nombre del instalador
// está en la sección "build" de package.json; ambos se cambian juntos al definir la marca.
const NOMBRE = "Mostrador";
app.setName(NOMBRE);
// Carpeta de datos alternativa (pruebas): evita mezclar con la instalación real.
if (process.env.MOSTRADOR_USERDATA) app.setPath("userData", process.env.MOSTRADOR_USERDATA);

const isDev = process.env.MOSTRADOR_DEV === "1";
// Prueba local del modo instalado sin generar el instalador: usa desktop/stage.
const usarStage = process.env.MOSTRADOR_STAGE === "1";

const BACKEND_URL = "http://127.0.0.1:4000";
const FRONTEND_URL = "http://localhost:5173";
const REPO_ROOT = path.join(__dirname, "..");

const children = [];
let servidor = null; // proceso del servidor en modo instalado
let ventana = null;
let origen = null; // http://127.0.0.1:PUERTO del servidor instalado
let cerrando = false;

// ---------------------------------------------------------------------------------------------
// Modo desarrollo: reutiliza o levanta el backend y el frontend de `pnpm dev`.
// ---------------------------------------------------------------------------------------------

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url, timeoutMs = 30000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkUrl(url)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function spawnDevProcess(filterName, label) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "npx.cmd" : "npx";
  const child = spawn(cmd, ["--yes", "pnpm@latest", "--filter", filterName, "dev"], {
    cwd: REPO_ROOT,
    shell: isWin,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => process.stdout.write(`[${label}] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[${label}] ${d}`));
  children.push(child);
  return child;
}

async function ensureDevServersRunning() {
  if (!(await checkUrl(BACKEND_URL))) {
    console.log("[desktop] backend no responde, arrancándolo...");
    spawnDevProcess("backend", "backend");
  }
  if (!(await checkUrl(FRONTEND_URL))) {
    console.log("[desktop] frontend no responde, arrancándolo...");
    spawnDevProcess("frontend", "frontend");
  }
  const [b, f] = await Promise.all([waitForUrl(BACKEND_URL), waitForUrl(FRONTEND_URL)]);
  if (!b || !f) console.error(`[desktop] timeout esperando servidores (backend=${b}, frontend=${f})`);
}

// ---------------------------------------------------------------------------------------------
// Modo instalado: el servidor (Express + SQLite) corre como proceso hijo y sirve la interfaz.
// Todo queda en la carpeta de datos del usuario; nada sale de esta computadora.
// ---------------------------------------------------------------------------------------------

function rutas() {
  const base = usarStage ? path.join(__dirname, "stage") : process.resourcesPath;
  return {
    entrada: path.join(base, "server", "build", "produccion.js"),
    migraciones: path.join(base, "server", "prisma", "migrations"),
    interfaz: path.join(base, "frontend"),
    datos: path.join(app.getPath("userData"), "datos"),
    logs: path.join(app.getPath("userData"), "logs"),
  };
}

function abrirLog(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, "servidor.log");
  // Se conserva el anterior una vez y se empieza limpio para que no crezca sin límite.
  try {
    if (fs.existsSync(archivo) && fs.statSync(archivo).size > 1024 * 1024) fs.renameSync(archivo, archivo + ".1");
  } catch {
    /* no crítico */
  }
  return { archivo, flujo: fs.createWriteStream(archivo, { flags: "a" }) };
}

/** Arranca el servidor y devuelve su puerto cuando está listo. */
function iniciarServidor() {
  const r = rutas();
  const log = abrirLog(r.logs);
  log.flujo.write(`\n--- ${new Date().toISOString()} · arranque ---\n`);

  return new Promise((resolve, reject) => {
    servidor = spawn(process.execPath, [r.entrada], {
      cwd: path.dirname(path.dirname(r.entrada)),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        MOSTRADOR_DATA_DIR: r.datos,
        MIGRATIONS_DIR: r.migraciones,
        FRONTEND_DIR: r.interfaz,
        PORT: process.env.MOSTRADOR_PORT || "47821",
      },
      stdio: ["pipe", "pipe", "pipe"], // la entrada abierta le avisa al servidor si la app se cierra
      windowsHide: true,
    });

    let listo = false;
    let ultimoError = "";
    const alLeer = (d) => {
      const texto = String(d);
      log.flujo.write(texto);
      const ok = texto.match(/MOSTRADOR_LISTO:(\d+)/);
      if (ok && !listo) {
        listo = true;
        resolve(Number(ok[1]));
      }
      const mal = texto.match(/MOSTRADOR_ERROR:\s*(.*)/);
      if (mal) ultimoError = mal[1];
    };
    servidor.stdout.on("data", alLeer);
    servidor.stderr.on("data", alLeer);
    servidor.on("error", (e) => reject(new Error(`No se pudo iniciar el servidor: ${e.message}`)));
    servidor.on("exit", (codigo) => {
      servidor = null;
      if (!listo) reject(new Error(ultimoError || `El servidor se cerró al arrancar (código ${codigo}).`));
      else if (!cerrando) {
        dialog.showErrorBox(NOMBRE, `El servidor interno se detuvo de forma inesperada.\nDetalle en: ${log.archivo}`);
        app.quit();
      }
    });
    setTimeout(() => !listo && reject(new Error("El servidor tardó demasiado en arrancar.")), 45000);
  });
}

// ---------------------------------------------------------------------------------------------
// Ventana
// ---------------------------------------------------------------------------------------------

const PANTALLA_CARGA = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><title>${NOMBRE}</title>
<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Segoe UI,system-ui,sans-serif;background:#f3f4f6;color:#374151">
<div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(#2563eb,#1d4ed8);display:flex;align-items:center;justify-content:center;color:#fff;font-size:34px;font-weight:800;box-shadow:0 8px 24px #2563eb44">M</div>
<p style="margin-top:20px;font-size:15px">Preparando el sistema…</p></body>`)}`;

function crearVentana() {
  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1000,
    minHeight: 640,
    title: NOMBRE,
    show: false,
    backgroundColor: "#f3f4f6",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.once("ready-to-show", () => win.show());

  // Enlaces externos (WhatsApp, etc.) se abren en el navegador, no dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    const propia = url.startsWith(FRONTEND_URL) || (origen && url.startsWith(origen)) || url.startsWith("data:");
    if (!propia) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  // Sin menú superior (deja libres los atajos Alt+letra del sistema); F12 abre las herramientas para soporte.
  if (!isDev) {
    win.webContents.on("before-input-event", (_e, input) => {
      if (input.type === "keyDown" && (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i"))) {
        win.webContents.toggleDevTools();
      }
    });
  }
  return win;
}

app.whenReady().then(async () => {
  if (!isDev && !app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });

  if (!isDev) Menu.setApplicationMenu(null);
  ventana = crearVentana();

  try {
    if (isDev) {
      await ensureDevServersRunning();
      ventana.loadURL(FRONTEND_URL);
      ventana.webContents.openDevTools({ mode: "detach" });
    } else {
      ventana.loadURL(PANTALLA_CARGA);
      const puerto = await iniciarServidor();
      origen = `http://127.0.0.1:${puerto}`;
      await ventana.loadURL(origen);
    }
  } catch (e) {
    dialog.showErrorBox(`${NOMBRE} no pudo iniciar`, `${e.message}\n\nRegistro: ${path.join(rutas().logs, "servidor.log")}`);
    app.quit();
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      ventana = crearVentana();
      ventana.loadURL(origen || FRONTEND_URL);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  cerrando = true;
  for (const child of [...children, servidor]) {
    try {
      child?.kill();
    } catch {
      // ya estaba muerto, ignorar
    }
  }
});
