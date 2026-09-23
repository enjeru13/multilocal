import { Router } from "express";
import { ajustarStock, listarMovimientos } from "../controllers/inventarioController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get("/movimientos", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), listarMovimientos);
router.post("/ajustes", protect, authorizeRoles([Role.ADMIN]), ajustarStock);

export default router;
