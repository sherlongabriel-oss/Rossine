import { RequestHandler } from "express";
import {
  addEmbedding,
  addMessage,
  createKnowledge,
  getCompany,
  readMessagesFromTxt,
  upsertConversation,
} from "../storage/fileStore";
import { createCompletion, createEmbedding } from "../services/openai";
import { DEFAULT_ERP_SYSTEM_PROMPT } from "../constants/erpPrompt";
import { getCompanySettings } from "../services/companySettings";
import { sendWhatsappText } from "../services/whatsappService";

const processConversationAnalytics = async (conversationId: string, companyId: string) => {
  const messages = readMessagesFromTxt(conversationId);
  const history = messages.map((m) => `${m.direction.toUpperCase()}: ${m.body}`).join("\n");
  if (!history) return;

  const prompt = `Analise a conversa de suporte ERP e extraia:
Pergunta: (resumo da duvida)
Resposta: (solucao tecnica)

Conversa:
${history}`;

  const analysis = await createCompletion(prompt, 450, companyId, DEFAULT_ERP_SYSTEM_PROMPT);
  const parts = analysis.split("\nResposta:");
  const title = (parts[0] || "Atendimento").replace(/^Pergunta:\s*/i, "").trim().slice(0, 120);
  const answerText = (parts[1] || analysis).trim().slice(0, 800);

  const knowledgeItem = createKnowledge(companyId, {
    title: title || "Atendimento",
    answer: answerText || analysis,
    approved: false,
    category: "Fiscal",
  });

  const embeddingText = `${knowledgeItem.title}\n${knowledgeItem.answer}`;
  const vector = await createEmbedding(embeddingText, companyId);
  addEmbedding({
    companyId,
    sourceType: "knowledge_item",
    sourceId: knowledgeItem.id,
    content: embeddingText,
    vectorJson: JSON.stringify(vector),
  });
};

export const receiveMessage: RequestHandler = async (req, res) => {
  const {
    companyId,
    conversationId,
    customerName,
    customerPhone,
    attendantName,
    message,
    messageType,
    direction,
    timestamp,
    status,
  } = req.body;

  if (!companyId || !conversationId || !message || !direction || !timestamp) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  const company = getCompany();
  if (!company || company.id !== companyId) {
    return res.status(404).json({ error: "Empresa nao encontrada" });
  }

  const conversation = upsertConversation({
    companyId,
    externalId: conversationId,
    customerName,
    customerPhone,
    attendantName,
    status: status || "OPEN",
  });

  const ts = new Date(timestamp).toISOString();
  const savedMessage = addMessage({
    conversationId: conversation.id,
    sender: direction === "customer" ? customerName ?? "Cliente" : attendantName ?? "Atendente",
    body: message,
    direction,
    messageType: messageType || "text",
    timestamp: ts,
  });

  if (status === "CLOSED" || direction === "customer") {
    processConversationAnalytics(conversation.id, companyId).catch(console.error);
  }

  res.json({ success: true, message: savedMessage, conversationId: conversation.id });
};

export const simulateCustomerMessage: RequestHandler = async (req, res, next) => {
  const { companyId, customerName, customerPhone, message } = req.body;
  const company = getCompany();
  const cid = companyId || company?.id;
  if (!cid || !message) {
    return res.status(400).json({ error: "message obrigatorio" });
  }
  req.body = {
    companyId: cid,
    conversationId: `sim-${customerPhone || "anon"}-${cid}`,
    customerName: customerName || "Cliente Teste",
    customerPhone: customerPhone || "5599999999999",
    message,
    messageType: "text",
    direction: "customer",
    timestamp: new Date().toISOString(),
    status: "OPEN",
  };
  return receiveMessage(req, res, next);
};

export const evolutionWebhook: RequestHandler = async (req, res) => {
  const company = getCompany();
  if (!company) return res.status(404).json({ error: "Empresa nao configurada" });

  const settings = await getCompanySettings(company.id);
  const botEnabled = settings.whatsapp?.botEnabled ?? false;

  const body = req.body || {};
  const data = body.data || body;
  const key = data?.key || {};
  const fromMe = Boolean(key?.fromMe || data?.fromMe);
  const phone = String(key.remoteJid || data?.from || "").replace(/@.*/, "");
  const messageObj = data?.message || {};
  const ext = messageObj.extendedTextMessage;
  const extText = typeof ext === "object" && ext ? String(ext.text || "") : "";
  const text = String(messageObj.conversation || extText || body?.text || "");

  if (!text || !phone || fromMe) {
    return res.json({ ok: true });
  }

  const customerName = String(data?.pushName || phone);
  const conversationId = `wa-${phone}-${company.id}`;

  req.body = {
    companyId: company.id,
    conversationId,
    customerName,
    customerPhone: phone,
    message: text,
    messageType: "text",
    direction: "customer",
    timestamp: new Date().toISOString(),
    status: "OPEN",
  };

  const fakeRes = {
    json: () => undefined,
    status: () => ({ json: () => undefined }),
  } as unknown as typeof res;

  await receiveMessage(req, fakeRes, () => undefined);

  if (company.aiEnabled && botEnabled) {
    try {
      const conv = upsertConversation({
        companyId: company.id,
        externalId: conversationId,
        customerName,
        customerPhone: phone,
      });

      const history = readMessagesFromTxt(conv.id)
        .slice(-6)
        .map((m) => `${m.direction}: ${m.body}`)
        .join("\n");

      const reply = await createCompletion(
        `Cliente perguntou via WhatsApp. Historico:\n${history}\n\nResponda de forma breve e profissional.`,
        300,
        company.id,
        DEFAULT_ERP_SYSTEM_PROMPT
      );
      if (reply) await sendWhatsappText(company.id, phone, reply);
    } catch (e) {
      console.error("Auto-reply:", e);
    }
  }

  res.json({ ok: true });
};
