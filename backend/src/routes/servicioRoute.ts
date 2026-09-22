import { Router } from "express";
import {
  getAllServicios,
  getServicioById,
  createServicio,
  updateServicio,
  deleteServicio,
} from "../controllers/servicioController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get(
  "/",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE]),
  getAllServicios
);
router.get(
  "/:id",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE]),
  getServicioById
);
router.post("/", protect, authorizeRoles([Role.ADMIN]), createServicio);
router.put("/:id", protect, authorizeRoles([Role.ADMIN]), updateServicio);
router.delete("/:id", protect, authorizeRoles([Role.ADMIN]), deleteServicio);

export default router;
