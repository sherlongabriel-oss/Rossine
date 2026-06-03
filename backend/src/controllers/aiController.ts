import { RequestHandler } from "express";
import { AuthRequest } from "../utils/types";
import { createCompletion, createEmbedding } from "../services/openai";
import { DEFAULT_ERP_SYSTEM_PROMPT } from "../constants/erpPrompt";
import {
  getConversationById,
  listEmbeddings,
  listKnowledge,
} from "../storage/fileStore";

const cosineSimilarity = (a: number[], b: number[]) => {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return normA === 0 || normB === 0 ? 0 : dot / (normA * normB);
};

export const searchKnowledge: RequestHandler = async (req, res) => {
  const { question } = req.body;
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (!question) return res.status(400).json({ error: "Pergunta e obrigatoria" });

  const questionVector = await createEmbedding(question, authUser.companyId);
  const candidateEmbeddings = listEmbeddings(authUser.companyId);

  const ranked = candidateEmbeddings
    .map((item) => ({
      item,
      score: cosineSimilarity(questionVector, JSON.parse(item.vectorJson || "[]")),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const knowledgeSources = listKnowledge(authUser.companyId).filter((k) =>
    ranked.some((r) => r.item.sourceId === k.id)
  );

  const useful = knowledgeSources
    .map((k) => `Pergunta: ${k.title}\nResposta: ${k.answer}`)
    .join("\n\n");

  if (!useful) {
    return res.json({
      answer:
        "Nao encontrei informacao suficiente na base. Encaminhar para atendente humano.",
    });
  }

  const prompt = `Use SOMENTE a base abaixo:\n\n${useful}\n\nPergunta: ${question}`;
  const answer = await createCompletion(prompt, 300, authUser.companyId, DEFAULT_ERP_SYSTEM_PROMPT);
  if (!answer || answer.length < 15) {
    return res.json({
      answer:
        "Nao encontrei informacao suficiente na base. Encaminhar para atendente humano.",
    });
  }
  res.json({ answer: answer.trim() });
};

export const suggestReply: RequestHandler = async (req, res) => {
  const { conversationId, lastMessage } = req.body;
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (!conversationId || !lastMessage) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  const conversation = getConversationById(authUser.companyId, conversationId);
  if (!conversation) return res.status(404).json({ error: "Conversa nao encontrada" });

  const allKnowledge = listKnowledge(authUser.companyId)
    .filter((k) => k.approved)
    .slice(0, 10);

  const prompt = `Sugira resposta. Ultima mensagem: ${lastMessage}\n\n${allKnowledge
    .map((item) => `- ${item.title}: ${item.answer}`)
    .join("\n")}`;

  const assistantAnswer = await createCompletion(
    prompt,
    350,
    authUser.companyId,
    DEFAULT_ERP_SYSTEM_PROMPT
  );

  const related = allKnowledge.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    confidence: item.confidence,
  }));

  res.json({
    suggestion: assistantAnswer.trim(),
    relatedArticles: related,
    similarSolutions: related,
    similarTickets: [],
  });
};
