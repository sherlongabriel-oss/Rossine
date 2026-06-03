import { getCompany, updateCompany } from "../storage/fileStore";

export type ExternalDbType = "postgresql" | "mysql" | "sqlserver" | "sqlite" | "oracle";

export interface ExternalDbConfig {
  type: ExternalDbType;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
  ssl?: boolean;
  enabled?: boolean;
}

export interface AiConfig {
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  instructions?: string;
}

export interface WhatsappConfig {
  provider?: "local" | "evolution" | "webhook" | "manual";
  apiUrl?: string;
  instance?: string;
  apiKey?: string;
  webhookToken?: string;
  botEnabled?: boolean;
  connected?: boolean;
  lastStatus?: string;
}

export interface ServerConfig {
  publicUrl?: string;
  port?: number;
  bindHost?: string;
}

export interface StorageConfig {
  mode?: "files" | "database";
  dataPath?: string;
}

export interface CompanySettings {
  externalDb?: ExternalDbConfig | null;
  ai?: AiConfig;
  whatsapp?: WhatsappConfig;
  server?: ServerConfig;
  storage?: StorageConfig;
  storageMode?: "files" | "database";
}

export function parseCompanySettings(json: string | null | undefined): CompanySettings {
  if (!json) return { storageMode: "files", storage: { mode: "files", dataPath: "data/" } };
  try {
    return { storageMode: "files", storage: { mode: "files", dataPath: "data/" }, ...(JSON.parse(json) as CompanySettings) };
  } catch {
    return { storageMode: "files", storage: { mode: "files", dataPath: "data/" } };
  }
}

export async function getCompanySettings(_companyId: string): Promise<CompanySettings> {
  const company = getCompany();
  return parseCompanySettings(company?.settingsJson);
}

export async function saveCompanySettings(_companyId: string, patch: Partial<CompanySettings>) {
  const company = getCompany();
  if (!company) throw new Error("Empresa não configurada");
  const current = parseCompanySettings(company.settingsJson);
  const merged: CompanySettings = {
    ...current,
    ...patch,
    externalDb: patch.externalDb !== undefined ? patch.externalDb : current.externalDb,
    ai: patch.ai ? { ...current.ai, ...patch.ai } : current.ai,
    whatsapp: patch.whatsapp ? { ...current.whatsapp, ...patch.whatsapp } : current.whatsapp,
    server: patch.server ? { ...current.server, ...patch.server } : current.server,
    storage: patch.storage ? { ...current.storage, ...patch.storage } : current.storage,
  };
  updateCompany({ settingsJson: JSON.stringify(merged) });
  return merged;
}

export function maskSecret(value?: string | null) {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}
