import { Router } from "express";
import {
  register,
  login,
  validateAdminPassword,
  getSetupStatus,
} from "../controllers/authController";

const router = Router();

router.get("/setup-status", getSetupStatus);
router.post("/register", register);
router.post("/login", login);
router.post("/validate-admin-password", validateAdminPassword);

export default router;
