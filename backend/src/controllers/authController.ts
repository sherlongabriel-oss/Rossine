import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../utils/types";
import { findUserByLogin, getUserById, bcrypt } from "../storage/fileStore";

const secret = process.env.JWT_SECRET || "qi-support-local-secret";

export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body;
  const loginId = String(email || req.body.login || "").trim();
  if (!loginId || !password) {
    return res.status(400).json({ error: "Usuario e senha sao obrigatorios" });
  }

  const user = findUserByLogin(loginId);
  if (!user) {
    return res.status(401).json({ error: "Credenciais invalidas" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciais invalidas" });
  }

  const token = jwt.sign(
    { userId: user.id, companyId: user.companyId, role: user.role },
    secret,
    { expiresIn: "12h" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company: { id: user.company.id, name: user.company.name },
    },
  });
};

export const me: RequestHandler = async (req, res) => {
  const authUser = (req as AuthRequest).user;
  if (!authUser) return res.status(401).json({ error: "Nao autorizado" });

  const user = getUserById(authUser.userId);
  if (!user) return res.status(404).json({ error: "Usuario nao encontrado" });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: { id: user.company.id, name: user.company.name },
    },
  });
};
