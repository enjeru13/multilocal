import { Router } from "express";
import { getDashboard, getResumen } from "../controllers/reporteController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get("/dashboard", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE, Role.CAJERO]), getDashboard);
router.get("/resumen", protect, authorizeRoles([Role.ADMIN]), getResumen);

export default router;
