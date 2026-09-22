import { Router } from "express";
import {
  getConfiguracion,
  updateConfiguracion,
} from "../controllers/configuracionesController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get(
  "/",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE]),
  getConfiguracion
);

router.put("/", protect, authorizeRoles([Role.ADMIN]), updateConfiguracion);

export default router;
