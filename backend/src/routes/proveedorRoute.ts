import { Router } from "express";
import {
  getAllProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
} from "../controllers/proveedorController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), getAllProveedores);
router.get("/:id", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), getProveedorById);
router.post("/", protect, authorizeRoles([Role.ADMIN]), createProveedor);
router.put("/:id", protect, authorizeRoles([Role.ADMIN]), updateProveedor);
router.delete("/:id", protect, authorizeRoles([Role.ADMIN]), deleteProveedor);

export default router;
