import { Router } from "express";
import {
  aiAssistConversation,
  closeConversationHandler,
  getConversation,
  listConversationsHandler,
  replyConversation,
} from "../controllers/conversationsController";

const router = Router();

router.get("/", listConversationsHandler);
router.get("/:id", getConversation);
router.post("/:id/reply", replyConversation);
router.post("/:id/ai-assist", aiAssistConversation);
router.patch("/:id/close", closeConversationHandler);

export default router;
