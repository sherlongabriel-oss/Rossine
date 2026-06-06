import { RequestHandler } from "express";
import { AuthRequest } from "../utils/types";
import { addMessage, getCompany, updateCompany, upsertConversation } from "../storage/fileStore";
import {
  CompanySettings,
  getCompanySettings,
  maskSecret,
  saveCompanySettings,
} from "../services/companySettings";
import { DEFAULT_AI_MODEL, DEFAULT_ERP_SYSTEM_PROMPT } from "../constants/erpPrompt";
import { isOpenAiConfigured } from "../config/loadSecrets";
import { getLocalIPv4, getPrimaryLocalIP } from "../config/network";
import { getDataDir } from "../config/paths";
import { listAiLogs } from "../storage/aiLogs";
import { testOpenAiConnection } from "../services/openai";
import { parseWhatsappExport } from "../utils/whatsappImport";
import {
  connectWhatsapp,
  whatsappContacts,
  whatsappQr,
  whatsappStatus,
} from "../services/whatsappService";

function sanitizeSettings(settings: CompanySettings) {
  return {
    storageMode: settings.storage?.mode || "files",
    storage: settings.storage || { mode: "files", dataPath: "data/" },
    server: settings.server || {},
    externalDb: settings.externalDb
      ? {
          ...settings.externalDb,
          password: maskSecret(settings.externalDb.password),
          connectionString: settings.externalDb.connectionString ? "***" : undefined,
        }
      : null,
    ai: {
      systemPrompt: settings.ai?.systemPrompt ?? DEFAULT_ERP_SYSTEM_PROMPT,
      model: settings.ai?.model ?? DEFAULT_AI_MODEL,
      temperature: settings.ai?.temperature ?? 0.3,
      maxTokens: settings.ai?.maxTokens ?? 500,
      instructions: settings.ai?.instructions ?? "",
    },
    whatsapp: settings.whatsapp
      ? {
          ...settings.whatsapp,
          apiKey: maskSecret(settings.whatsapp.apiKey),
          webhookToken: maskSecret(settings.whatsapp.webhookToken),
        }
      : { provider: "local", botEnabled: false, connected: false },
  };
}

export const toggleAI: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  const company = updateCompany({ aiEnabled: Boolean(req.body.enabled) });
  res.json({ aiEnabled: company.aiEnabled });
};

export const toggleBot: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  const current = await getCompanySettings(authUser.companyId);
  const botEnabled = Boolean(req.body.enabled);
  const merged = await saveCompanySettings(authUser.companyId, {
    whatsapp: { ...current.whatsapp, botEnabled },
  });
  res.json({ botEnabled: merged.whatsapp?.botEnabled ?? false });
};

export const getSettings: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  const company = getCompany();
  const settings = await getCompanySettings(authUser.companyId);
  const keyOk = isOpenAiConfigured() || Boolean(company?.openaiApiKey);
  res.json({
    company: company ? { id: company.id, name: company.name, slug: company.slug } : null,
    settings: {
      aiEnabled: company?.aiEnabled ?? false,
      botEnabled: settings.whatsapp?.botEnabled ?? false,
      openaiConfigured: keyOk,
      openaiApiKey: keyOk ? "configured" : null,
      ...sanitizeSettings(settings),
    },
  });
};

export const testAiConnectionHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  const result = await testOpenAiConnection(authUser.companyId);
  res.status(result.ok ? 200 : 400).json(result);
};

export const getAiLogs: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  res.json({ logs: listAiLogs(150) });
};

export const updateAiSettings: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (authUser.role !== "ADMIN") return res.status(403).json({ error: "Apenas admin" });

  const patch: NonNullable<CompanySettings["ai"]> = {};
  if (req.body.apiKey !== undefined && req.body.apiKey) {
    // Salvar chave de IA customizada
    const company = getCompany();
    if (company) {
      updateCompany({ openaiApiKey: String(req.body.apiKey) });
    }
  }
  if (req.body.systemPrompt !== undefined) patch.systemPrompt = String(req.body.systemPrompt);
  if (req.body.model !== undefined) patch.model = String(req.body.model);
  if (req.body.temperature !== undefined) patch.temperature = Number(req.body.temperature);
  if (req.body.maxTokens !== undefined) patch.maxTokens = Number(req.body.maxTokens);
  if (req.body.instructions !== undefined) patch.instructions = String(req.body.instructions);

  const merged = await saveCompanySettings(authUser.companyId, { ai: patch });
  res.json({ ai: sanitizeSettings(merged).ai, message: "Configurações de IA atualizadas" });
};

export const updateServerSettings: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (authUser.role !== "ADMIN") return res.status(403).json({ error: "Apenas admin" });
  const merged = await saveCompanySettings(authUser.companyId, { server: req.body });
  res.json({ server: merged.server });
};

export const updateStorageSettings: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (authUser.role !== "ADMIN") return res.status(403).json({ error: "Apenas admin" });
  const merged = await saveCompanySettings(authUser.companyId, { storage: req.body });
  res.json({ storage: merged.storage, dataPath: getDataDir() });
};

export const updateDatabaseSettings: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (authUser.role !== "ADMIN") return res.status(403).json({ error: "Apenas admin" });
  const current = await getCompanySettings(authUser.companyId);
  const incoming = req.body;
  const externalDb = {
    ...current.externalDb,
    ...incoming,
    type: incoming.type || current.externalDb?.type || "postgresql",
    enabled: Boolean(incoming.enabled),
  };
  if (!incoming.password && current.externalDb?.password) {
    externalDb.password = current.externalDb.password;
  }
  const merged = await saveCompanySettings(authUser.companyId, { externalDb });
  res.json({ externalDb: sanitizeSettings(merged).externalDb });
};

export const testDatabaseSettings: RequestHandler = async (_req, res) => {
  res.json({
    ok: true,
    message: "Modo arquivo ativo. Mensagens em data/mensagens/*.txt ate conectar banco SQL.",
  });
};

export const updateWhatsappSettings: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (authUser.role !== "ADMIN") return res.status(403).json({ error: "Apenas admin" });
  const current = await getCompanySettings(authUser.companyId);
  const patch = req.body;
  const whatsapp = { ...current.whatsapp, ...patch };
  if (!patch.apiKey && current.whatsapp?.apiKey) whatsapp.apiKey = current.whatsapp.apiKey;
  if (!patch.webhookToken && current.whatsapp?.webhookToken) {
    whatsapp.webhookToken = current.whatsapp.webhookToken;
  }
  const merged = await saveCompanySettings(authUser.companyId, { whatsapp });
  res.json({ whatsapp: sanitizeSettings(merged).whatsapp });
};

export const connectWhatsappHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (authUser.role !== "ADMIN") return res.status(403).json({ error: "Apenas admin" });
  const port = Number(process.env.PORT) || 4000;
  try {
    const result = await connectWhatsapp(authUser.companyId, port);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Falha ao conectar" });
  }
};

export const whatsappStatusHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  try {
    const status = await whatsappStatus(authUser.companyId);
    res.json(status);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro" });
  }
};

export const whatsappQrHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  try {
    const qr = await whatsappQr(authUser.companyId);
    res.json(qr);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro" });
  }
};

export const whatsappContactsHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  try {
    const contacts = await whatsappContacts(authUser.companyId);
    res.json({ contacts });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro" });
  }
};

export const getConnectionInfo: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const port = Number(process.env.PORT) || 4000;
  const settings = authUser ? await getCompanySettings(authUser.companyId) : ({} as CompanySettings);
  const localIps = getLocalIPv4();
  const primaryIp = getPrimaryLocalIP();
  const publicUrl =
    settings.server?.publicUrl?.replace(/\/$/, "") || `http://${primaryIp}:${port}`;
  res.json({
    port,
    bindHost: settings.server?.bindHost || "0.0.0.0",
    localUrls: localIps.map((ip) => `http://${ip}:${port}`),
    publicUrl,
    apiBaseUrl: publicUrl,
    webhookUrl: `${publicUrl}/api/bot/messages`,
    evolutionWebhookUrl: `${publicUrl}/api/bot/evolution`,
    storagePath: getDataDir(),
    openaiConfigured: isOpenAiConfigured(),
    hint: "Pronto para uso - porta 4000 ja configurada automaticamente.",
  });
};

export const importWhatsappHistory: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (authUser.role !== "ADMIN") return res.status(403).json({ error: "Apenas admin" });

  const text = String(req.body?.text || "");
  const customerName = String(req.body?.customerName || "Cliente");
  const customerPhone = String(req.body?.customerPhone || "");

  if (!text.trim()) {
    return res.status(400).json({ error: "Arquivo vazio" });
  }

  const company = getCompany();
  if (!company) return res.status(404).json({ error: "Empresa nao encontrada" });

  const normalizedPhone = customerPhone.replace(/\D/g, "");
  const externalId = normalizedPhone
    ? `import-${normalizedPhone}-${company.id}`
    : `import-${Date.now()}-${company.id}`;

  const conv = upsertConversation({
    companyId: company.id,
    externalId,
    customerName,
    customerPhone: normalizedPhone || undefined,
    status: "OPEN",
  });

  const messages = parseWhatsappExport(text);
  const customerNameNorm = customerName.trim().toLowerCase();

  let imported = 0;
  for (const msg of messages) {
    const senderNorm = msg.sender.trim().toLowerCase();
    const isCustomer = senderNorm === customerNameNorm;

    addMessage({
      conversationId: conv.id,
      sender: msg.sender,
      body: msg.body,
      direction: isCustomer ? "customer" : "attendant",
      timestamp: msg.timestamp,
    });
    imported += 1;
  }

  res.json({ ok: true, conversationId: conv.id, imported });
};
