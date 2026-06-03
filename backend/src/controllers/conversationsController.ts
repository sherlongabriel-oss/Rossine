import { RequestHandler } from "express";
import { AuthRequest } from "../utils/types";
import {
  addMessage,
  closeConversation,
  getConversationById,
  getUserById,
  listConversations,
  readMessagesFromTxt,
  updateConversationMeta,
  getCompany,
  listKnowledge,
} from "../storage/fileStore";
import { createCompletion } from "../services/openai";
import { getCompanySettings } from "../services/companySettings";
import { DEFAULT_ERP_SYSTEM_PROMPT } from "../constants/erpPrompt";
import { sendWhatsappText } from "../services/whatsappService";

function mapConversation(c: ReturnType<typeof listConversations>[0]) {
  const messages = readMessagesFromTxt(c.id);
  const last = messages[messages.length - 1];

  return {
    ...c,
    customer: c.customerName
      ? { name: c.customerName, phone: c.customerPhone || "" }
      : undefined,
    messages: last ? [last] : [],
  };
}

export const listConversationsHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Não autorizado" });

  const status = req.query.status ? String(req.query.status) : undefined;
  const conversations = listConversations(authUser.companyId, status).map(mapConversation);
  res.json({ conversations });
};

export const getConversation: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const { id } = req.params;
  if (!authUser) return res.status(401).json({ error: "Não autorizado" });

  const conv = getConversationById(authUser.companyId, id);
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada" });

  const messages = readMessagesFromTxt(conv.id);
  res.json({
    conversation: {
      ...conv,
      customer: conv.customerName
        ? { name: conv.customerName, phone: conv.customerPhone || "" }
        : undefined,
      messages,
    },
  });
};

export const replyConversation: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const { id } = req.params;
  const { message } = req.body;

  if (!authUser) return res.status(401).json({ error: "Não autorizado" });
  if (!message?.trim()) return res.status(400).json({ error: "Mensagem obrigatória" });

  const user = getUserById(authUser.userId);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

  const conv = getConversationById(authUser.companyId, id);
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada" });

  const body = message.trim();

  const saved = addMessage({
    conversationId: conv.id,
    sender: user.name,
    body,
    direction: "attendant",
  });

  updateConversationMeta(authUser.companyId, conv.id, {
    attendantName: user.name,
    status: "OPEN",
  });

  if (conv.customerPhone) {
    try {
      await sendWhatsappText(authUser.companyId, conv.customerPhone, body);
    } catch (e) {
      console.error("Envio WhatsApp:", e);
    }
  }

  res.json({ message: saved, sentToWhatsapp: Boolean(conv.customerPhone) });
};

export const closeConversationHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const { id } = req.params;

  if (!authUser) return res.status(401).json({ error: "Não autorizado" });

  const ok = closeConversation(authUser.companyId, id);
  if (!ok) return res.status(404).json({ error: "Conversa não encontrada" });

  res.json({ success: true });
};

export const aiAssistConversation: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const { id } = req.params;
  const { question } = req.body;

  if (!authUser) return res.status(401).json({ error: "Não autorizado" });

  const company = getCompany();
  if (!company?.aiEnabled) {
    return res.status(400).json({ error: "IA desativada" });
  }

  const conv = getConversationById(authUser.companyId, id);
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada" });

  const settings = await getCompanySettings(authUser.companyId);

  const history = readMessagesFromTxt(conv.id)
    .map((m) => `${m.direction.toUpperCase()}: ${m.body}`)
    .join("\n");

  const knowledge = listKnowledge(authUser.companyId)
    .filter((k) => k.approved)
    .slice(0, 8);

  const prompt = `Histórico:
${history}

Base:
${knowledge.map((k) => `- ${k.title}: ${k.answer}`).join("\n")}

Pergunta do atendente: ${question || "Sugira resposta ao cliente."}`;

  const answer = await createCompletion(
    prompt,
    settings.ai?.maxTokens ?? 400,
    settings.ai?.systemPrompt || DEFAULT_ERP_SYSTEM_PROMPT
  );

  res.json({ answer: answer.trim() });
};