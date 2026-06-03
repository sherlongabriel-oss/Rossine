import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../utils/types";

const secret = process.env.JWT_SECRET || "qi-support-local-secret";

export const authMiddleware: RequestHandler = (req, res, next) => {
  const authReq = req as AuthRequest;
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, secret) as any;
    authReq.user = {
      userId: payload.userId,
      companyId: payload.companyId,
      role: payload.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
};
