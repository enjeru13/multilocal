import { Router } from "express";
import { Role } from "@prisma/client";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import {
  actualizarPresupuesto,
  cambiarEstado,
  convertirEnVenta,
  crearPresupuesto,
  eliminarPresupuesto,
  listarPresupuestos,
  obtenerAlertas,
  obtenerPresupuesto,
  requerirModulo,
} from "../controllers/presupuestoController";

const router = Router();
const gestion = authorizeRoles([Role.ADMIN, Role.EMPLOYEE]);

router.use(protect, gestion, requerirModulo);

router.get("/", listarPresupuestos);
router.get("/alertas", obtenerAlertas);
router.post("/", crearPresupuesto);
router.get("/:id", obtenerPresupuesto);
router.put("/:id", actualizarPresupuesto);
router.patch("/:id/estado", cambiarEstado);
router.post("/:id/convertir", convertirEnVenta);
router.delete("/:id", eliminarPresupuesto);

export default router;
