import { Router } from "express";
import { Role } from "@prisma/client";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import {
  aplicarConteo,
  cancelarConteo,
  contarItem,
  crearConteo,
  listarConteos,
  obtenerConteo,
  quitarItem,
  requerirInventario,
} from "../controllers/conteoController";

const router = Router();
const gestion = authorizeRoles([Role.ADMIN, Role.EMPLOYEE]);

router.use(protect, gestion, requerirInventario);

router.get("/", listarConteos);
router.post("/", crearConteo);
router.get("/:id", obtenerConteo);
router.put("/:id/items", contarItem);
router.delete("/:id/items/:servicioId", quitarItem);
// Ajustar existencias es una decisión de administración: quien cuenta no las modifica.
router.post("/:id/aplicar", authorizeRoles([Role.ADMIN]), aplicarConteo);
router.post("/:id/cancelar", cancelarConteo);

export default router;
