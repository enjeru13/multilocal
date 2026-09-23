import { Router } from "express";
import {
  getAllPagos,
  getPagoById,
  createPago,
  updatePago,
  deletePago,
} from "../controllers/pagoController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";

const router = Router();

router.get("/", protect, authorizeRoles(["ADMIN", "EMPLOYEE", "CAJERO"]), getAllPagos);
router.get("/:id", protect, authorizeRoles(["ADMIN", "EMPLOYEE", "CAJERO"]), getPagoById);
router.post("/", protect, authorizeRoles(["ADMIN", "EMPLOYEE", "CAJERO"]), createPago);
router.put("/:id", protect, authorizeRoles(["ADMIN", "EMPLOYEE"]), updatePago);
router.delete("/:id", protect, authorizeRoles(["ADMIN"]), deletePago);

export default router;
