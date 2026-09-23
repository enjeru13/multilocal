import { Router } from "express";
import { listarGastos, crearGasto, eliminarGasto } from "../controllers/gastoController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), listarGastos);
router.post("/", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE]), crearGasto);
router.delete("/:id", protect, authorizeRoles([Role.ADMIN]), eliminarGasto);

export default router;
