import path from "path";
import QRCode from "qrcode";
import { Client, LocalAuth, Message } from "whatsapp-web.js";
import { getDataDir } from "../config/paths";
import {
  addMessage,
  getCompany,
  readMessagesFromTxt,
  upsertConversation,
} from "../storage/fileStore";
import { getCompanySettings, saveCompanySettings } from "./companySettings";
import { createCompletion } from "./openai";
import { DEFAULT_ERP_SYSTEM_PROMPT } from "../constants/erpPrompt";

let client: Client | null = null;
let lastQrRaw: string | null = null;
let lastQrDataUrl: string | null = null;
let connected = false;
let connectionState = "disconnected";
let starting = false;

export function getLocalWhatsappState() {
  return {
    connected,
    state: connectionState,
    qrcode: lastQrDataUrl,
  };
}

async function setQr(qr: string) {
  lastQrRaw = qr;
  lastQrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 });
  connectionState = "qr";
  connected = false;
}

async function handleIncomingMessage(msg: Message) {
  if (msg.fromMe) return;

  const company = getCompany();
  if (!company) return;

  const settings = await getCompanySettings(company.id);
  const botEnabled = settings.whatsapp?.botEnabled ?? false;

  const phone = msg.from.replace(/@.*/, "");
  const text =
    msg.body ||
    (msg.hasMedia ? "[midia recebida - atendente pode responder pelo painel]" : "");
  if (!text.trim()) return;

  const customerName = (await msg.getContact()).pushname || phone;
  const conversationId = `wa-${phone}-${company.id}`;

  const conv = upsertConversation({
    companyId: company.id,
    externalId: conversationId,
    customerName,
    customerPhone: phone,
    status: "OPEN",
  });

  addMessage({
    conversationId: conv.id,
    sender: customerName,
    body: text.trim(),
    direction: "customer",
  });

  if (company.aiEnabled && botEnabled) {
    try {
      const history = readMessagesFromTxt(conv.id)
        .slice(-8)
        .map((m) => `${m.direction}: ${m.body}`)
        .join("\n");

      const reply = await createCompletion(
        `Cliente no WhatsApp (suporte ERP QI Informatica). Historico:\n${history}\n\nResponda de forma breve, cordial e tecnica quando aplicavel.`,
        350,
        company.id,
        DEFAULT_ERP_SYSTEM_PROMPT
      );

      if (reply?.trim()) {
        await msg.reply(reply.trim());
        addMessage({
          conversationId: conv.id,
          sender: "Assistente IA",
          body: reply.trim(),
          direction: "attendant",
        });
      }
    } catch (e) {
      console.error("Auto-reply WhatsApp:", e);
    }
  }
}

export async function startLocalWhatsapp(companyId: string) {
  if (client || starting) return getLocalWhatsappState();
  starting = true;

  console.log("[WhatsApp] Iniciando WhatsApp Local...");

  const sessionPath = path.join(getDataDir(), "whatsapp-session");
  const puppeteerArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ];

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath, clientId: "qi-support" }),
    puppeteer: {
      headless: true,
      args: puppeteerArgs,
      ...(executablePath ? { executablePath } : {}),
    },
  });

  client.on("qr", (qr) => {
    console.log("[WhatsApp] QR Code recebido");
    void setQr(qr);
  });

  client.on("authenticated", () => {
    console.log("[WhatsApp] Autenticado");
    connectionState = "authenticated";
  });

  client.on("ready", async () => {
    console.log("[WhatsApp] Conectado e pronto");
    connected = true;
    connectionState = "open";
    lastQrRaw = null;
    lastQrDataUrl = null;

    const current = await getCompanySettings(companyId);
    await saveCompanySettings(companyId, {
      whatsapp: {
        ...current.whatsapp,
        provider: "local",
        botEnabled: current.whatsapp?.botEnabled ?? false,
        connected: true,
        lastStatus: "open",
      },
    });

    console.log("[WhatsApp] WhatsApp conectado e pronto.");
  });

  client.on("disconnected", async (reason) => {
    console.log("[WhatsApp] Desconectado:", reason);
    connected = false;
    connectionState = String(reason || "close");

    await saveCompanySettings(companyId, {
      whatsapp: { connected: false, lastStatus: connectionState },
    });

    client = null;
    starting = false;
  });

  client.on("message", (msg) => {
    void handleIncomingMessage(msg);
  });

  try {
    console.log("[WhatsApp] Inicializando cliente...");
    await client.initialize();
    console.log("[WhatsApp] Cliente inicializado com sucesso");
  } catch (e) {
    console.error("[WhatsApp] Falha ao iniciar WhatsApp:", e);
    client = null;
    connectionState = "error";
  } finally {
    starting = false;
  }

  return getLocalWhatsappState();
}

export async function getLocalQr() {
  if (lastQrDataUrl) return { qrcode: lastQrDataUrl };

  if (lastQrRaw) {
    lastQrDataUrl = await QRCode.toDataURL(lastQrRaw, { margin: 1, width: 280 });
    return { qrcode: lastQrDataUrl };
  }

  return {} as { qrcode?: string };
}

export async function getLocalStatus() {
  return {
    state: connected ? "open" : connectionState,
    connected,
    instance: "local",
  };
}

export async function sendLocalText(phone: string, text: string) {
  if (!client || !connected) return false;

  const number = phone.replace(/\D/g, "");
  const chatId = `${number}@c.us`;

  await client.sendMessage(chatId, text);

  return true;
}

export function isLocalWhatsappReady() {
  return connected && !!client;
}

