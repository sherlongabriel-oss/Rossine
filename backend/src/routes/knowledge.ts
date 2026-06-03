import { Router } from "express";
import {
  createKnowledgeHandler,
  deleteKnowledgeHandler,
  listKnowledgeHandler,
  updateKnowledgeHandler,
} from "../controllers/knowledgeController";

const router = Router();

router.get("/", listKnowledgeHandler);
router.post("/", createKnowledgeHandler);
router.patch("/:id", updateKnowledgeHandler);
router.put("/:id", updateKnowledgeHandler);
router.delete("/:id", deleteKnowledgeHandler);

export default router;
