import { Router } from "express";
import {
  register,
  login,
  validateAdminPassword,
} from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/validate-admin-password", validateAdminPassword);

export default router;
