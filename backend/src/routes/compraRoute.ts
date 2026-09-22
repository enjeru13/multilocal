import { Router } from "express";
import {
  getAllCompras,
  getCompraById,
  createCompra,
  recibirCompra,
  cancelarCompra,
} from "../controllers/compraController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), getAllCompras);
router.get("/:id", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), getCompraById);
router.post("/", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), createCompra);
router.patch("/:id/recibir", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), recibirCompra);
router.patch("/:id/cancelar", protect, authorizeRoles([Role.ADMIN]), cancelarCompra);

export default router;
