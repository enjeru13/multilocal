const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn, execFile } = require("child_process");

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

// ---------------------------------------------------------------------------------------------
// Impresión directa de tickets (sin el diálogo de impresión de Windows)
//
// Probamos primero a dibujar el ticket en una ventana oculta y mandarlo con webContents.print(),
// pidiéndole a Chromium el tamaño exacto del rollo (pageSize/preferCSSPageSize). En la práctica,
// el driver de varias impresoras térmicas baratas (Xprinter XP-58 entre ellas) ignora ese tamaño
// y usa su hoja por defecto (carta/A4): el ticket sale diminuto sobre una tira larguísima de papel.
// Por eso el ticket se arma como texto ESC/POS -tal como lo hacía el sistema anterior con
// PrintNode- y se manda en crudo (RAW) a la impresora: sin diálogo de Windows, sin negociar
// tamaño de página, a prueba de ese bug de los drivers.
// ---------------------------------------------------------------------------------------------

ipcMain.handle("impresoras:listar", async (evento) => {
  try {
    const lista = await evento.sender.getPrintersAsync();
    return lista.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault }));
  } catch {
    return [];
  }
});

const ESC = "\x1B";
const GS = "\x1D";
const CENTRAR = `${ESC}\x61\x01`;
const IZQUIERDA = `${ESC}\x61\x00`;
const NEGRITA_ON = `${ESC}\x45\x01`;
const NEGRITA_OFF = `${ESC}\x45\x00`;
const TAMANO_NORMAL = `${GS}\x21\x00`;
const TAMANO_GRANDE = `${GS}\x21\x11`; // doble ancho y doble alto
const PAGINA_DE_CODIGOS = `${ESC}\x74\x13`; // tabla 19: CP858 (occidental con €), la misma que usaba el sistema anterior

// Tabla mínima de acentos/eñes a CP858 (=CP850 salvo el símbolo del euro). Lo que no está en la
// tabla y no es ASCII sale como "?": en un ticket eso son casos rarísimos (otro alfabeto, emoji).
const CP858 = {
  "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5,
  "ü": 0x81, "Ü": 0x9a, "¿": 0xa8, "¡": 0xad, "Á": 0xb5, "É": 0x90, "Í": 0xd6,
  "Ó": 0xe0, "Ú": 0xe9, "°": 0xf8, "€": 0xd5, "ª": 0xa6, "º": 0xa7,
};

function bytesCp858(texto) {
  const bytes = [];
  for (const c of texto) {
    const codigo = c.codePointAt(0);
    bytes.push(codigo < 128 ? codigo : CP858[c] ?? 0x3f);
  }
  return Buffer.from(bytes);
}

/** Reparte `texto` en líneas de a lo sumo `ancho` caracteres, sin cortar palabras cuando se puede. */
function partirEnAncho(texto, ancho) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (prueba.length > ancho) {
      if (actual) lineas.push(actual);
      let resto = palabra;
      while (resto.length > ancho) {
        lineas.push(resto.slice(0, ancho));
        resto = resto.slice(ancho);
      }
      actual = resto;
    } else {
      actual = prueba;
    }
  }
  if (actual || lineas.length === 0) lineas.push(actual);
  return lineas;
}

/** Etiqueta a la izquierda, valor a la derecha; si no caben en una línea, el valor baja con la etiqueta. */
function lineaDosColumnas(etiqueta, valor, ancho) {
  const espacio = ancho - etiqueta.length - valor.length;
  if (espacio >= 1) return `${etiqueta}${" ".repeat(espacio)}${valor}`;
  const filas = partirEnAncho(etiqueta, ancho);
  const ultima = filas.pop() ?? "";
  const espacioUltima = Math.max(1, ancho - ultima.length - valor.length);
  filas.push(`${ultima}${" ".repeat(espacioUltima)}${valor}`);
  return filas.join("\n");
}

/** Arma el texto ESC/POS a partir de las líneas ya extraídas del ticket (ver frontend/src/impresion/escpos.ts). */
function construirEscPos(lineas, ancho) {
  let out = PAGINA_DE_CODIGOS;
  for (const l of lineas) {
    if (l.tipo === "separador") {
      out += `${(l.fuerte ? "=" : "-").repeat(ancho)}\n`;
    } else if (l.tipo === "texto") {
      out += l.centrado ? CENTRAR : IZQUIERDA;
      if (l.grande) out += TAMANO_GRANDE;
      if (l.negrita) out += NEGRITA_ON;
      const texto = l.mayus ? l.texto.toUpperCase() : l.texto;
      const anchoTexto = l.grande ? Math.max(8, Math.floor(ancho / 2)) : ancho;
      for (const fila of partirEnAncho(texto, anchoTexto)) out += `${fila}\n`;
      if (l.negrita) out += NEGRITA_OFF;
      if (l.grande) out += `${TAMANO_NORMAL}\n`; // aire debajo del nombre del negocio
      out += IZQUIERDA;
    } else if (l.tipo === "linea") {
      if (l.fuerte) out += NEGRITA_ON;
      out += `${lineaDosColumnas(l.etiqueta ?? "", l.valor ?? "", ancho)}\n`;
      if (l.fuerte) out += `${NEGRITA_OFF}\n`; // aire después de totales y encabezados en negrita
    } else if (l.tipo === "renglon") {
      out += NEGRITA_ON;
      for (const fila of partirEnAncho(l.nombre ?? "", ancho)) out += `${fila}\n`;
      out += NEGRITA_OFF;
      if (l.detalle || l.valor) out += `${lineaDosColumnas(l.detalle ?? "", l.valor ?? "", ancho)}\n`;
      out += "\n"; // aire entre artículos
    }
  }
  out += "\n\n\n\n";
  return out;
}

// Pequeño script de PowerShell (clásico "RawPrinterHelper") que abre la cola de impresión de
// Windows en modo RAW y escribe los bytes tal cual: así se evita agregar un módulo nativo de
// Node solo para esto. Se escribe una vez a un archivo temporal y se reusa entre impresiones.
const SCRIPT_IMPRESION_RAW = `param([string]$Impresora, [string]$Archivo)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MostradorRawPrint {
  [StructLayout(LayoutKind.Sequential)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
  public static bool Enviar(string impresora, byte[] bytes) {
    IntPtr hPrinter;
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "Mostrador - Ticket";
    di.pDataType = "RAW";
    if (!OpenPrinter(impresora, out hPrinter, IntPtr.Zero)) return false;
    try {
      if (!StartDocPrinter(hPrinter, 1, di)) return false;
      try {
        if (!StartPagePrinter(hPrinter)) return false;
        try {
          IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
          Marshal.Copy(bytes, 0, p, bytes.Length);
          int escritos;
          bool ok = WritePrinter(hPrinter, p, bytes.Length, out escritos);
          Marshal.FreeCoTaskMem(p);
          return ok;
        } finally { EndPagePrinter(hPrinter); }
      } finally { EndDocPrinter(hPrinter); }
    } finally { ClosePrinter(hPrinter); }
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes($Archivo)
$ok = [MostradorRawPrint]::Enviar($Impresora, $bytes)
if (-not $ok) { [Console]::Error.WriteLine("La impresora rechazó el trabajo (¿apagada, sin papel o desconectada?)."); exit 1 }
`;

let scriptImpresionListo = null;
function rutaScriptImpresion() {
  if (!scriptImpresionListo) {
    scriptImpresionListo = path.join(os.tmpdir(), "mostrador-imprimir-raw.ps1");
    fs.writeFileSync(scriptImpresionListo, SCRIPT_IMPRESION_RAW, "utf8");
  }
  return scriptImpresionListo;
}

// El ticket llega ya partido en líneas simples (ver escpos.ts): así no depende de que Chromium o
// el driver de la impresora sepan negociar un tamaño de página custom.
ipcMain.handle("impresion:ticket", async (_evento, datos) => {
  const { lineas, columnas, impresora } = datos || {};
  if (!Array.isArray(lineas) || lineas.length === 0 || !(columnas > 0)) return { ok: false, motivo: "Datos de impresión no válidos." };
  if (typeof impresora !== "string" || !impresora) return { ok: false, motivo: "No hay una impresora elegida." };
  if (process.platform !== "win32") return { ok: false, motivo: "La impresión directa solo existe en Windows." };

  const texto = construirEscPos(lineas, Math.round(columnas));
  const archivo = path.join(os.tmpdir(), `mostrador-ticket-${Date.now()}.bin`);
  try {
    fs.writeFileSync(archivo, bytesCp858(texto));
    return await new Promise((resolve) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", rutaScriptImpresion(), "-Impresora", impresora, "-Archivo", archivo],
        { windowsHide: true, timeout: 15000 },
        (error, _stdout, stderr) => {
          if (error) resolve({ ok: false, motivo: (stderr && stderr.trim()) || error.message || "No se pudo imprimir." });
          else resolve({ ok: true });
        }
      );
    });
  } catch (error) {
    return { ok: false, motivo: error && error.message ? error.message : "No se pudo imprimir." };
  } finally {
    fs.promises.unlink(archivo).catch(() => undefined);
  }
});

// Los sonidos (avisos al abrir, errores) deben poder sonar aunque todavía no se haya tocado la ventana.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

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
