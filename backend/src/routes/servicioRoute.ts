import { Router } from "express";
import multer from "multer";
import {
  getAllServicios,
  getServicioById,
  createServicio,
  updateServicio,
  deleteServicio,
  ajustarPrecios,
  importarServicios,
  subirImagenServicio,
  eliminarImagenServicio,
} from "../controllers/servicioController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();
const subirFoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single("imagen");
// multer manda sus propios errores (foto muy pesada, campo raro) al manejador de errores genérico;
// aquí se les pone un mensaje que la persona entienda en vez del 500 por defecto.
function recibirFoto(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  subirFoto(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "La foto pesa demasiado (máximo 5 MB)." });
    }
    return res.status(400).json({ message: "No se pudo recibir la imagen." });
  });
}

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
router.post("/:id/imagen", protect, authorizeRoles([Role.ADMIN]), recibirFoto, subirImagenServicio);
router.delete("/:id/imagen", protect, authorizeRoles([Role.ADMIN]), eliminarImagenServicio);

export default router;
