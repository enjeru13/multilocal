import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import morgan from "morgan";

import { protect } from "./middleware/authMiddleware";
import { imagenesDir } from "./lib/archivos";

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
import conteoRouter from "./routes/conteoRoute";
import gastoRouter from "./routes/gastoRoute";
import correoRouter from "./routes/correoRoute";

// App 100% local: sin orígenes cloud, CORS abierto solo porque el server
// nunca sale de 127.0.0.1 (ver startServer). No hay nada externo que bloquear.
export function createApp() {
  const app = express();
  // En la nube el servidor va detrás del proxy del proveedor (HTTPS): así req.ip es el del cliente real.
  const enNube = process.env.MOSTRADOR_MODO === "nube";
  if (enNube) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    if (enNube) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    next();
  });
  // Interfaz y API salen del mismo servidor: en la nube no se abre CORS a otros orígenes.
  if (!enNube) app.use(cors());
  if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
  app.use(express.json({ limit: "10mb" })); // las importaciones de catálogo llevan miles de filas

  // App instalada: el mismo servidor entrega la interfaz (y así no hay orígenes distintos).
  const carpetaWeb = process.env.FRONTEND_DIR;
  if (!carpetaWeb) {
    app.get("/", (req: Request, res: Response) => {
      res.send("API local funcionando correctamente");
    });
  }

  // Para la comprobación de salud del proveedor (no toca la base de datos).
  app.get("/api/salud", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Fotos de productos: son solo eso, fotos de catálogo, así que no llevan autenticación (un
  // <img src> normal no puede mandar el token). El nombre de archivo no revela nada del negocio.
  app.use("/archivos/imagenes", express.static(imagenesDir()));

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
  app.use("/api/conteos", conteoRouter);
  app.use("/api/gastos", gastoRouter);
  app.use("/api/correo", correoRouter);

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

