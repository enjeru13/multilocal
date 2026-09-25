import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import morgan from "morgan";

import { protect } from "./middleware/authMiddleware";

// Rutas
import clienteRouter from "./routes/clienteRoute";
import servicioRouter from "./routes/servicioRoute";
import ordenRouter from "./routes/ordenRoute";
import detalleRouter from "./routes/detalleOrdenRoute";
import pagoRouter from "./routes/pagoRoute";
import configuracionRouter from "./routes/configuracionRoute";
import authRoute from "./routes/authRoute";
import categoriaRouter from "./routes/categoriaRoute";
import proveedorRouter from "./routes/proveedorRoute";
import compraRouter from "./routes/compraRoute";
import cajaRouter from "./routes/cajaRoute";
import usuarioRouter from "./routes/usuarioRoute";
import respaldoRouter from "./routes/respaldoRoute";
import inventarioRouter from "./routes/inventarioRoute";
import reporteRouter from "./routes/reporteRoute";
import presupuestoRouter from "./routes/presupuestoRoute";
import gastoRouter from "./routes/gastoRoute";

// App 100% local: sin orígenes cloud, CORS abierto solo porque el server
// nunca sale de 127.0.0.1 (ver startServer). No hay nada externo que bloquear.
export function createApp() {
  const app = express();

  app.use(cors());
  if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
  app.use(express.json());

  // App instalada: el mismo servidor entrega la interfaz (y así no hay orígenes distintos).
  const carpetaWeb = process.env.FRONTEND_DIR;
  if (!carpetaWeb) {
    app.get("/", (req: Request, res: Response) => {
      res.send("API local funcionando correctamente");
    });
  }

  app.use("/api/auth", authRoute);
  app.use("/api/categorias", categoriaRouter);
  app.use("/api", protect);

  // Rutas protegidas
  app.use("/api/clientes", clienteRouter);
  app.use("/api/servicios", servicioRouter);
  app.use("/api/ordenes", ordenRouter);
  app.use("/api/detalleOrdenes", detalleRouter);
  app.use("/api/pagos", pagoRouter);
  app.use("/api/configuracion", configuracionRouter);
  app.use("/api/proveedores", proveedorRouter);
  app.use("/api/compras", compraRouter);
  app.use("/api/caja", cajaRouter);
  app.use("/api/usuarios", usuarioRouter);
  app.use("/api/respaldos", respaldoRouter);
  app.use("/api/inventario", inventarioRouter);
  app.use("/api/reportes", reporteRouter);
  app.use("/api/presupuestos", presupuestoRouter);
  app.use("/api/gastos", gastoRouter);

  if (carpetaWeb) {
    app.use(express.static(carpetaWeb));
    // Cualquier otra ruta que no sea de la API es de la interfaz (React Router).
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.sendFile(path.join(carpetaWeb, "index.html"));
    });
  }

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Error global:", err);
    res.status(500).json({ message: "Ocurrió un error interno en el servidor." });
  });

  return app;
}

