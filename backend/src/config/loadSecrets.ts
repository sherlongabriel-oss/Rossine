import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getAppRoot, getConfigDir } from "./paths";

function cleanKey(value?: string): string | undefined {
  if (!value) return undefined;
  const key = value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^["']|["']$/g, "");
  if (!key || key === "placeholder" || key.includes("sua-chave")) return undefined;
  return key;
}

/** Carrega todas as fontes de configuração (EXE usa pasta ao lado do .exe) */
export function loadSecrets(): void {
  const files = [
    path.join(getConfigDir(), "secrets.env"),
    path.join(getAppRoot(), "config", "secrets.env"),
    path.join(getAppRoot(), "secrets.env"),
    path.join(getAppRoot(), ".env"),
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file, override: true });
    }
  }

  const key = cleanKey(process.env.OPENAI_API_KEY);
  if (key) process.env.OPENAI_API_KEY = key;
}

export function getOpenAiKey(): string | undefined {
  return cleanKey(process.env.OPENAI_API_KEY);
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getOpenAiKey());
}
