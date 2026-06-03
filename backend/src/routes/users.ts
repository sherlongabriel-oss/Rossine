import { Router } from "express";
import {
  createUserHandler,
  listUsersHandler,
} from "../controllers/userController";

const router = Router();

router.get("/", listUsersHandler);
router.post("/", createUserHandler);

export default router;
