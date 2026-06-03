const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const fs = require("fs");
const net = require("net");
const http = require("http");

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = 4000;
const BACKEND_HOST = "0.0.0.0";
const REMOTE_URL = process.env.QI_REMOTE_URL || "https://qiinformatica.netlify.app";

function getAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "qi-app");
  }
  return path.join(__dirname, "..");
}

function getUserDataRoot() {
  const dir = path.join(app.getPath("userData"), "qi-support-data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function copyDirSafe(src, dst) {
  if (!fs.existsSync(src)) return;
  if (fs.existsSync(dst)) return;
  fs.cpSync(src, dst, { recursive: true });
}

function startBackend() {
  const appRoot = getAppRoot();
  const userRoot = getUserDataRoot();
  const backendDir = path.join(appRoot, "backend");
  const backendEntry = path.join(backendDir, "dist", "index.js");

  // Em primeiro boot copia config (incluindo secrets.env) para a pasta de dados
  // do usuario, onde a chave fica gravavel.
  copyDirSafe(path.join(backendDir, "config"), path.join(userRoot, "config"));

  if (!fs.existsSync(backendEntry)) {
    dialog.showErrorBox(
      "QI Support AI",
      "Backend nao encontrado em:\n" + backendEntry +
        "\n\nReinstale o aplicativo."
    );
    app.quit();
    return;
  }

  const env = {
    ...process.env,
    QI_APP_ROOT: userRoot,
    PORT: String(BACKEND_PORT),
    HOST: BACKEND_HOST,
    OPEN_BROWSER: "false",
    NODE_ENV: "production",
    ELECTRON_RUN_AS_NODE: "1",
  };

  backendProcess = fork(backendEntry, [], {
    cwd: backendDir,
    env,
    stdio: "inherit",
  });

  backendProcess.on("exit", (code) => {
    console.error("Backend encerrado:", code);
    backendProcess = null;
  });

  backendProcess.on("error", (err) => {
    console.error("Erro no backend:", err);
  });
}

function pingBackend(timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port: BACKEND_PORT, path: "/api/health", timeout: timeoutMs },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await pingBackend()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function pickIconPath() {
  const root = getAppRoot();
  const candidates = [
    path.join(root, "LOGO", "logo.ico"),
    path.join(root, "LOGO", "logo-big.png"),
    path.join(root, "LOGO", "logo.png"),
    path.join(root, "LOGO", "logo.svg"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

async function createWindow(targetUrl) {
  const icon = pickIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "QI Support AI",
    ...(icon ? { icon } : {}),
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  if (targetUrl) {
    await mainWindow.loadURL(targetUrl);
    return;
  }

  // Detectar IP local para exibir corretamente na janela
  const os = require("os");
  function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "127.0.0.1";
  }
  const localIP = getLocalIP();
  const url = "http://" + localIP + ":" + BACKEND_PORT;

  const ok = await waitForBackend();
  if (!ok) {
    await mainWindow.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          "<html><body style=\"font-family:sans-serif;padding:40px;background:#0f172a;color:#fff\">" +
            "<h1>QI Support AI</h1>" +
            "<p>Nao foi possivel iniciar o servico interno na porta " + BACKEND_PORT + ".</p>" +
            "<p>Verifique se outro programa esta usando essa porta e tente novamente.</p>" +
            "</body></html>"
        )
    );
    return;
  }

  await mainWindow.loadURL(url);
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "0.0.0.0");
  });
}

app.whenReady().then(async () => {
  // Single-instance lock evita 2 backends concorrentes na mesma porta
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  if (REMOTE_URL) {
    await createWindow(REMOTE_URL);
    return;
  }

  const portFree = await checkPortFree(BACKEND_PORT);
  if (!portFree) {
    // Backend ja rodando (ex.: outra instancia que escapou). Apenas abre janela.
    await createWindow();
    return;
  }

  startBackend();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

function shutdownBackend() {
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill();
    } catch {}
    backendProcess = null;
  }
}

app.on("window-all-closed", () => {
  shutdownBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  shutdownBackend();
});
