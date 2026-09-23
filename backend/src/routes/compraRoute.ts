import { Router } from "express";
import {
  getAllCompras,
  getCompraById,
  createCompra,
  recibirCompra,
  cancelarCompra,
  listarPorPagar,
  pagarCompra,
} from "../controllers/compraController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), getAllCompras);
router.get("/por-pagar", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), listarPorPagar);
router.get("/:id", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), getCompraById);
router.post("/", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), createCompra);
router.post("/:id/pagos", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), pagarCompra);
router.patch("/:id/recibir", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), recibirCompra);
router.patch("/:id/cancelar", protect, authorizeRoles([Role.ADMIN]), cancelarCompra);

export default router;
