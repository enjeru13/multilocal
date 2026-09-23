import { Router } from "express";
import {
  register,
  login,
  getSetupStatus,
  changePassword,
} from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/setup-status", getSetupStatus);
router.post("/register", register);
router.post("/login", login);
router.post("/change-password", protect, changePassword);

export default router;
