import { Router } from "express";
import {
  getAllServicios,
  getServicioById,
  createServicio,
  updateServicio,
  deleteServicio,
  ajustarPrecios,
  importarServicios,
} from "../controllers/servicioController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get(
  "/",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE, Role.CAJERO]),
  getAllServicios
);
router.get(
  "/:id",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE]),
  getServicioById
);
router.post("/", protect, authorizeRoles([Role.ADMIN]), createServicio);
router.post("/ajuste-precios", protect, authorizeRoles([Role.ADMIN]), ajustarPrecios);
router.post("/importar", protect, authorizeRoles([Role.ADMIN]), importarServicios);
router.put("/:id", protect, authorizeRoles([Role.ADMIN]), updateServicio);
router.delete("/:id", protect, authorizeRoles([Role.ADMIN]), deleteServicio);

export default router;
