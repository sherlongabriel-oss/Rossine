import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDataDir } from "../config/paths";

export interface AiLogEntry {
  id: string;
  timestamp: string;
  action: string;
  inputPreview: string;
  outputPreview: string;
  success: boolean;
  detail?: string;
}

const LOG_FILE = "ia_aprendizado.jsonl";

function logPath() {
  return path.join(getDataDir(), LOG_FILE);
}

export function appendAiLog(entry: Omit<AiLogEntry, "id" | "timestamp">) {
  const full: AiLogEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  fs.appendFileSync(logPath(), `${JSON.stringify(full)}\n`, "utf8");
}

export function listAiLogs(limit = 100): AiLogEntry[] {
  const file = logPath();
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line) as AiLogEntry;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse() as AiLogEntry[];
}
