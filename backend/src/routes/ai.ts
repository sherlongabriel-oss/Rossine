import { Router } from "express";
import { searchKnowledge, suggestReply } from "../controllers/aiController";

const router = Router();

router.post("/search", searchKnowledge);
router.post("/suggest", suggestReply);

export default router;
