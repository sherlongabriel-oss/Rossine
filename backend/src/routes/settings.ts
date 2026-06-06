import { Router } from "express";
import {
  connectWhatsappHandler,
  getAiLogs,
  getConnectionInfo,
  getSettings,
  testAiConnectionHandler,
  testDatabaseSettings,
  toggleAI,
  toggleBot,
  updateAiSettings,
  updateDatabaseSettings,
  updateServerSettings,
  updateStorageSettings,
  updateWhatsappSettings,
  importWhatsappHistory,
  whatsappQrHandler,
  whatsappStatusHandler,
  whatsappContactsHandler,
} from "../controllers/settingsController";

const router = Router();

router.get("/", getSettings);
router.get("/connection-info", getConnectionInfo);
router.get("/ai-logs", getAiLogs);
router.post("/ai/test", testAiConnectionHandler);
router.patch("/ai", toggleAI);
router.patch("/bot", toggleBot);
router.patch("/ai-config", updateAiSettings);
router.patch("/server", updateServerSettings);
router.patch("/storage", updateStorageSettings);
router.patch("/database", updateDatabaseSettings);
router.post("/database/test", testDatabaseSettings);
router.patch("/whatsapp", updateWhatsappSettings);
router.post("/whatsapp/connect", connectWhatsappHandler);
router.get("/whatsapp/status", whatsappStatusHandler);
router.get("/whatsapp/qrcode", whatsappQrHandler);
router.get("/whatsapp/contacts", whatsappContactsHandler);
router.post("/whatsapp/import", importWhatsappHistory);

export default router;
