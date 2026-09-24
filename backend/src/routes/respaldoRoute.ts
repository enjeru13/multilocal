import express, { Router } from "express";
import {
  listar,
  crear,
  descargar,
  restaurarGuardado,
  restaurarArchivo,
  importarDesdeLegado,
} from "../controllers/respaldoController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const router = Router();
const soloAdmin = [protect, authorizeRoles([Role.ADMIN])];

router.get("/", ...soloAdmin, listar);
router.post("/crear", ...soloAdmin, crear);
router.get("/:nombre/descargar", ...soloAdmin, descargar);
router.post("/restaurar/:nombre", ...soloAdmin, restaurarGuardado);
router.post(
  "/restaurar-archivo",
  ...soloAdmin,
  express.raw({ type: "application/octet-stream", limit: "500mb" }),
  restaurarArchivo
);

router.post(
  "/importar-legado",
  ...soloAdmin,
  express.raw({ type: "application/octet-stream", limit: "500mb" }),
  importarDesdeLegado
);

export default router;
