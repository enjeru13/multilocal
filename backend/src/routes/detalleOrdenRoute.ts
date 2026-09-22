import { Router } from "express";
import {
  getAllDetalle,
  getDetalleById,
  getDetallesByOrdenId,
  createDetalle,
  updateDetalle,
  deleteDetalle,
} from "../controllers/detalleOrdenController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";

const router = Router();

router.get("/", protect, getAllDetalle);
router.get("/by-order", protect, getDetallesByOrdenId);
router.get("/:id", protect, getDetalleById);
router.post("/", protect, authorizeRoles(["ADMIN", "EMPLOYEE"]), createDetalle);
router.put(
  "/:id",
  protect,
  authorizeRoles(["ADMIN", "EMPLOYEE"]),
  updateDetalle
);
router.delete("/:id", protect, authorizeRoles(["ADMIN"]), deleteDetalle);

export default router;
