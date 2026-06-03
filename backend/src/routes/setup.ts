import { Router } from "express";
import { initialSetup } from "../controllers/setupController";

const router = Router();

router.post("/company", initialSetup);

export default router;
