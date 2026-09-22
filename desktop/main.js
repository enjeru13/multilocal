const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const isDev = process.env.MOSTRADOR_DEV === "1";

const BACKEND_URL = "http://127.0.0.1:4000";
const FRONTEND_URL = "http://localhost:5173";
const REPO_ROOT = path.join(__dirname, "..");

const children = [];

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
  const backendUp = await checkUrl(BACKEND_URL);
  if (!backendUp) {
    console.log("[desktop] backend no responde, arrancándolo...");
    spawnDevProcess("backend", "backend");
  } else {
    console.log("[desktop] backend ya estaba corriendo, lo reuso.");
  }

  const frontendUp = await checkUrl(FRONTEND_URL);
  if (!frontendUp) {
    console.log("[desktop] frontend no responde, arrancándolo...");
    spawnDevProcess("frontend", "frontend");
  } else {
    console.log("[desktop] frontend ya estaba corriendo, lo reuso.");
  }

  const [backendReady, frontendReady] = await Promise.all([
    waitForUrl(BACKEND_URL),
    waitForUrl(FRONTEND_URL),
  ]);

  if (!backendReady || !frontendReady) {
    console.error(
      `[desktop] timeout esperando servidores (backend=${backendReady}, frontend=${frontendReady})`
    );
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Mostrador",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    win.loadURL(FRONTEND_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  if (isDev) {
    await ensureDevServersRunning();
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // ya estaba muerto, ignorar
    }
  }
});
