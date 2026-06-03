import { Router } from "express";
import {
  evolutionWebhook,
  receiveMessage,
  simulateCustomerMessage,
} from "../controllers/botController";

const router = Router();

router.post("/messages", receiveMessage);
router.post("/simulate", simulateCustomerMessage);
router.post("/evolution", evolutionWebhook);

export default router;
