import { Router } from "express";
import {
  register,
  login,
  validateAdminPassword,
  getSetupStatus,
  changePassword,
} from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/setup-status", getSetupStatus);
router.post("/register", register);
router.post("/login", login);
router.post("/change-password", protect, changePassword);
router.post("/validate-admin-password", validateAdminPassword);

export default router;
