import { RequestHandler } from "express";
import { AuthRequest } from "../utils/types";
import {
  createKnowledge,
  deleteKnowledge,
  listKnowledge,
  updateKnowledge,
} from "../storage/fileStore";

export const listKnowledgeHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });

  const search = req.query.search ? String(req.query.search) : undefined;
  const items = listKnowledge(authUser.companyId, search).map((item) => ({
    ...item,
    category: item.category ? { name: item.category } : null,
  }));
  res.json({ items });
};

export const createKnowledgeHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const { title, answer, approved, category } = req.body;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (!title || !answer) return res.status(400).json({ error: "Titulo e resposta obrigatorios" });

  const item = createKnowledge(authUser.companyId, { title, answer, approved, category });
  res.json({ item });
};

export const updateKnowledgeHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const { id } = req.params;
  const { title, answer, approved, confidence, category } = req.body;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });

  const ok = updateKnowledge(authUser.companyId, id, {
    title,
    answer,
    approved,
    confidence,
    category,
  });
  if (!ok) return res.status(404).json({ error: "Item nao encontrado" });
  res.json({ success: true });
};

export const deleteKnowledgeHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const { id } = req.params;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  deleteKnowledge(authUser.companyId, id);
  res.json({ success: true });
};
