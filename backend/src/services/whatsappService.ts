import { getCompanySettings, saveCompanySettings, WhatsappConfig } from "./companySettings";
import { getPrimaryLocalIP } from "../config/network";
import * as local from "./whatsappLocal";

function baseUrl(cfg: WhatsappConfig) {
  return (cfg.apiUrl || "").replace(/\/$/, "");
}

function headers(cfg: WhatsappConfig) {
  return {
    "Content-Type": "application/json",
    apikey: cfg.apiKey || "",
  };
}

function asRecord(data: unknown): Record<string, unknown> {
  return (data as Record<string, unknown>) || {};
}

function isLocalProvider(cfg: WhatsappConfig) {
  return (
    !cfg.provider ||
    cfg.provider === "local" ||
    cfg.provider === "manual" ||
    cfg.provider === "webhook"
  );
}

export async function connectWhatsapp(companyId: string, port: number) {
  const settings = await getCompanySettings(companyId);
  const cfg = settings.whatsapp || {};

  if (isLocalProvider(cfg)) {
    await saveCompanySettings(companyId, {
      whatsapp: { ...cfg, provider: "local", botEnabled: cfg.botEnabled ?? false },
    });
    const result = await local.startLocalWhatsapp(companyId);
    return {
      instance: "local",
      webhookUrl: `http://${getPrimaryLocalIP()}:${port}/api/bot/evolution`,
      qrcode: result.qrcode?.replace(/^data:image\/png;base64,/, ""),
      pairingCode: undefined,
    };
  }

  if (!cfg.apiUrl || !cfg.apiKey) {
    throw new Error("Informe URL e API Key da Evolution API ou use modo integrado (local)");
  }

  const instance = cfg.instance || "qi-support";
  const publicHost = settings.server?.publicUrl || `http://${getPrimaryLocalIP()}:${port}`;
  const webhookUrl = `${publicHost.replace(/\/$/, "")}/api/bot/evolution`;

  await fetch(`${baseUrl(cfg)}/instance/create`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({ instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
  }).catch(() => null);

  await fetch(`${baseUrl(cfg)}/webhook/set/${instance}`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    }),
  }).catch(() => null);

  const connectRes = await fetch(`${baseUrl(cfg)}/instance/connect/${instance}`, {
    method: "GET",
    headers: headers(cfg),
  });
  const connectData = asRecord(await connectRes.json().catch(() => ({})));
  const qrcodeObj = asRecord(connectData.qrcode);

  await saveCompanySettings(companyId, {
    whatsapp: {
      ...cfg,
      instance,
      botEnabled: cfg.botEnabled ?? false,
      connected: false,
      lastStatus: "Aguardando QR Code",
    },
  });

  return {
    instance,
    webhookUrl,
    qrcode:
      connectData.base64 ||
      qrcodeObj.base64 ||
      connectData.code,
    pairingCode: connectData.pairingCode,
  };
}

export async function whatsappStatus(companyId: string) {
  const settings = await getCompanySettings(companyId);
  const cfg = settings.whatsapp || {};

  if (isLocalProvider(cfg)) {
    const status = await local.getLocalStatus();
    await saveCompanySettings(companyId, {
      whatsapp: { ...cfg, connected: status.connected, lastStatus: status.state },
    });
    return status;
  }

  if (!cfg.apiUrl || !cfg.apiKey || !cfg.instance) {
    return { state: "not_configured", connected: false };
  }

  const res = await fetch(`${baseUrl(cfg)}/instance/connectionState/${cfg.instance}`, {
    headers: headers(cfg),
  });
  const data = asRecord(await res.json().catch(() => ({})));
  const instanceObj = asRecord(data.instance);
  const state = String(instanceObj.state || data.state || "close");
  const connected = state === "open";

  await saveCompanySettings(companyId, {
    whatsapp: { ...cfg, connected, lastStatus: state },
  });

  return { state, connected, instance: cfg.instance };
}

export async function whatsappQr(companyId: string) {
  const settings = await getCompanySettings(companyId);
  const cfg = settings.whatsapp || {};

  if (isLocalProvider(cfg)) {
    const qr = await local.getLocalQr();
    return {
      qrcode: qr.qrcode?.replace(/^data:image\/png;base64,/, ""),
    };
  }

  const res = await fetch(`${baseUrl(cfg)}/instance/connect/${cfg.instance}`, {
    headers: headers(cfg),
  });
  const data = asRecord(await res.json().catch(() => ({})));
  const qrcodeObj = asRecord(data.qrcode);
  return {
    qrcode: data.base64 || qrcodeObj.base64,
    pairingCode: data.pairingCode,
  };
}

export async function sendWhatsappText(companyId: string, phone: string, text: string) {
  const settings = await getCompanySettings(companyId);
  const cfg = settings.whatsapp || {};
  if (!phone || !text.trim()) return false;

  if (isLocalProvider(cfg)) {
    return local.sendLocalText(phone, text.trim());
  }

  if (!cfg.apiUrl || !cfg.apiKey || !cfg.instance) return false;

  const number = phone.replace(/\D/g, "");
  await fetch(`${baseUrl(cfg)}/message/sendText/${cfg.instance}`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify({ number, text: text.trim() }),
  });
  return true;
}

export async function ensureWhatsappOnBoot(companyId: string) {
  const settings = await getCompanySettings(companyId);
  const cfg = settings.whatsapp || {};
  if (isLocalProvider(cfg)) {
    await saveCompanySettings(companyId, {
      whatsapp: { ...cfg, provider: "local", botEnabled: cfg.botEnabled ?? false },
    });
    void local.startLocalWhatsapp(companyId);
  }
}

// Compatibilidade com imports antigos
export const evolutionConnect = connectWhatsapp;
export const evolutionStatus = whatsappStatus;
export const evolutionQr = whatsappQr;
