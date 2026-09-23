import { Router } from "express";
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
} from "../controllers/usuarioController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", protect, authorizeRoles([Role.ADMIN]), listarUsuarios);
router.post("/", protect, authorizeRoles([Role.ADMIN]), crearUsuario);
router.put("/:id", protect, authorizeRoles([Role.ADMIN]), actualizarUsuario);

export default router;
