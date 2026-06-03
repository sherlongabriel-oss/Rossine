import { RequestHandler } from "express";
import { AuthRequest } from "../utils/types";
import { createUser, listUsers } from "../storage/fileStore";

export const createUserHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  const { name, email, login, password, role, whatsappAccess } = req.body;
  const userLogin = String(login || email || "").trim();

  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });
  if (authUser.role !== "ADMIN") {
    return res.status(403).json({ error: "Apenas administradores" });
  }
  if (!name || !userLogin || !password || !role) {
    return res.status(400).json({ error: "Nome, login, senha e perfil sao obrigatorios" });
  }

  try {
    const user = await createUser(authUser.companyId, {
      name,
      email: userLogin,
      password,
      role,
      whatsappAccess: whatsappAccess ?? true,
    });
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        whatsappAccess: user.whatsappAccess,
      },
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro" });
  }
};

export const listUsersHandler: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });

  const users = listUsers(authUser.companyId).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    whatsappAccess: u.whatsappAccess,
    active: u.active,
    createdAt: u.createdAt,
  }));
  res.json({ users });
};
