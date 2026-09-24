import { Router } from "express";
import {
  getCajaActual,
  abrirCaja,
  registrarMovimiento,
  cerrarCaja,
  getHistorialCajas,
  getComprobanteCaja,
} from "../controllers/cajaController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();
const todos = [Role.ADMIN, Role.EMPLOYEE, Role.CAJERO];

router.get("/actual", protect, authorizeRoles(todos), getCajaActual);
router.get("/historial", protect, authorizeRoles([Role.ADMIN]), getHistorialCajas);
router.get("/:id/comprobante", protect, authorizeRoles(todos), getComprobanteCaja);
router.post("/abrir", protect, authorizeRoles(todos), abrirCaja);
router.post("/movimientos", protect, authorizeRoles(todos), registrarMovimiento);
router.post("/cerrar", protect, authorizeRoles(todos), cerrarCaja);

export default router;
