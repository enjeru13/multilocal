import { Router } from "express";
import {
  getAllCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  deleteCategoria,
} from "../controllers/categoriaController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get(
  "/",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE]),
  getAllCategorias
);
router.get(
  "/:id",
  protect,
  authorizeRoles([Role.ADMIN, Role.EMPLOYEE]),
  getCategoriaById
);
router.post("/", protect, authorizeRoles([Role.ADMIN]), createCategoria);
router.put("/:id", protect, authorizeRoles([Role.ADMIN]), updateCategoria);
router.delete("/:id", protect, authorizeRoles([Role.ADMIN]), deleteCategoria);

export default router;
