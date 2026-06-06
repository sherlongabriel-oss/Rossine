import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import authRoutes from "./routes/auth";
import botRoutes from "./routes/bot";
import aiRoutes from "./routes/ai";
import knowledgeRoutes from "./routes/knowledge";
import setupRoutes from "./routes/setup";
import userRoutes from "./routes/users";
import settingsRoutes from "./routes/settings";
import conversationsRoutes from "./routes/conversations";
import { authMiddleware } from "./middleware/auth";
import { getPublicDir } from "./config/paths";
import { whatsappStatus, whatsappQr } from "./services/whatsappService";
import { getCompany } from "./storage/fileStore";


const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use("/api/setup", setupRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bot", botRoutes);

// Public WhatsApp endpoints (sem autenticação para simplificar)
app.get("/api/public/whatsapp/status", async (_req, res) => {
  try {
    const company = getCompany();
    if (!company) return res.status(400).json({ error: "Empresa não encontrada" });
    const status = await whatsappStatus(company.id);
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro" });
  }
});

app.get("/api/public/whatsapp/qrcode", async (_req, res) => {
  try {
    const company = getCompany();
    if (!company) return res.status(400).json({ error: "Empresa não encontrada" });
    const qr = await whatsappQr(company.id);
    res.json(qr);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro" });
  }
});

app.use("/api/users", authMiddleware, userRoutes);
app.use("/api/settings", authMiddleware, settingsRoutes);
app.use("/api/conversations", authMiddleware, conversationsRoutes);
app.use("/api/ai", authMiddleware, aiRoutes);
app.use("/api/knowledge", authMiddleware, knowledgeRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", storage: "files" });
});

const publicDir = getPublicDir();
app.use("/logo.png", express.static(path.join(publicDir, "logo.png")));
app.use(express.static(publicDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) next();
  });
});

export default app;
