import { Router } from "express";
import {
  getAllClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
} from "../controllers/clienteController";
import { protect, authorizeRoles } from "../middleware/authMiddleware";

const router = Router();

router.get("/", protect, getAllClientes);
router.get("/:id", protect, getClienteById);
router.post("/", protect, authorizeRoles(["ADMIN", "EMPLOYEE"]), createCliente);
router.put(
  "/:id",
  protect,
  authorizeRoles(["ADMIN", "EMPLOYEE"]),
  updateCliente
);
router.delete("/:id", protect, authorizeRoles(["ADMIN"]), deleteCliente);

export default router;
