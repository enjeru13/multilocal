import { Router } from "express";
import { listarGastos, crearGasto, eliminarGasto } from "../controllers/gastoController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

// Los gastos son dinero que sale del negocio: solo el administrador los ve.
router.get("/", protect, authorizeRoles([Role.ADMIN]), listarGastos);
router.post("/", protect, authorizeRoles([Role.ADMIN]), crearGasto);
router.delete("/:id", protect, authorizeRoles([Role.ADMIN]), eliminarGasto);

export default router;
