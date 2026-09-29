import { Router } from "express";
import { enviarCorreoGenerico } from "../controllers/correoController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.post("/enviar", protect, authorizeRoles([Role.ADMIN, Role.EMPLOYEE, Role.CAJERO]), enviarCorreoGenerico);

export default router;
