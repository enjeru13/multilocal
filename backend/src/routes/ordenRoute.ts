import { Router } from "express";
import {
  getAllOrdenes,
  getOrdenById,
  createOrden,
  updateOrden,
  deleteOrden,
  actualizarObservacion,
  anularOrden,
  crearDevolucion,
} from "../controllers/ordenController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get(
  "/",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE, Role.CAJERO]),
  getAllOrdenes
);
router.get(
  "/:id",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE, Role.CAJERO]),
  getOrdenById
);
router.post(
  "/",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE, Role.CAJERO]),
  createOrden
);
router.put(
  "/:id",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE]),
  updateOrden
);
router.delete("/:id", protect, authorizeRoles([Role.ADMIN]), deleteOrden);
router.post("/:id/devolucion", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), crearDevolucion);
router.patch("/:id/anular", protect, authorizeRoles([Role.ADMIN]), anularOrden);
router.patch(
  "/:id/observacion",
  protect,
  authorizeRoles([Role.ADMIN]),
  actualizarObservacion
);

export default router;
