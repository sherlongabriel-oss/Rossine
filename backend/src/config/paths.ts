import fs from "fs";
import path from "path";

function ensureDir(dir: string): string {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Pasta gravavel (config, data, mensagens). No Electron empacotado e o
 * %APPDATA%/QI Support AI/qi-support-data; em desenvolvimento ou pkg cai para
 * a raiz do projeto / pasta do executavel.
 */
export function getAppRoot(): string {
  if (process.env.QI_APP_ROOT) {
    return path.resolve(process.env.QI_APP_ROOT);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((process as any).pkg) {
    return path.dirname(process.execPath);
  }
  return path.resolve(__dirname, "..", "..");
}

/**
 * Pasta somente-leitura ao lado do codigo (frontend buildado, etc.).
 * Em runtime sempre fica ao lado de dist/index.js (resources/qi-app/backend
 * no Electron empacotado).
 */
export function getBackendDir(): string {
  // __dirname = .../backend/dist/config (compilado) ou .../backend/src/config (dev)
  return path.resolve(__dirname, "..", "..");
}

export function getDataDir(): string {
  const envDir = process.env.QI_DATA_DIR;
  if (envDir) {
    return ensureDir(path.resolve(envDir));
  }
  const dir = path.join(getAppRoot(), "data");
  return ensureDir(dir);
}

export function getMessagesDir(): string {
  const dir = path.join(getDataDir(), "mensagens");
  return ensureDir(dir);
}

export function getConfigDir(): string {
  const envDir = process.env.QI_CONFIG_DIR;
  if (envDir) {
    return ensureDir(path.resolve(envDir));
  }
  const dir = path.join(getAppRoot(), "config");
  return ensureDir(dir);
}

export function getPublicDir(): string {
  if (process.env.QI_PUBLIC_DIR) {
    const fromEnv = path.resolve(process.env.QI_PUBLIC_DIR);
    if (fs.existsSync(fromEnv)) {
      return fromEnv;
    }
  }
  // Procura o public buildado ao lado do backend (forma preferida no
  // empacotamento Electron e em desenvolvimento).
  const candidates = [
    path.join(getBackendDir(), "public"),
    path.join(getAppRoot(), "public"),
    path.join(getAppRoot(), "..", "public"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}
