import dayjs from "dayjs";
import type { ReciboData, Moneda } from "@lavanderia/shared/types/types";
import { formatearMoneda } from "./monedaHelpers";

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Correo simple con el resumen del recibo: mismos datos que el ticket, en una tabla legible. */
export function correoRecibo(datos: ReciboData, principal: Moneda) {
  const fmt = (n: number) => formatearMoneda(n, principal);
  const cliente = `${datos.clienteInfo.nombre} ${datos.clienteInfo.apellido}`.trim();
  const restante = Math.max(datos.total - datos.abono, 0);
  const saldada = restante < 0.005;
  const numero = datos.numeroOrden ? `N.º ${datos.numeroOrden}` : "";
  const asunto = `${datos.lavanderiaInfo.nombre} · Recibo ${numero}`.trim();

  const filas = datos.items
    .map((i) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${escapar(i.descripcion)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right" nowrap>${i.cantidad} × ${fmt(i.precioUnitario)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right" nowrap>${fmt(i.cantidad * i.precioUnitario)}</td></tr>`)
    .join("");

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:480px;margin:0 auto">
  <h2 style="margin:0 0 4px">${escapar(datos.lavanderiaInfo.nombre)}</h2>
  <p style="margin:0 0 16px;color:#555;font-size:13px">Recibo ${numero} · ${dayjs().format("DD/MM/YYYY")}</p>
  <p style="margin:0 0 4px"><strong>Cliente:</strong> ${escapar(cliente || "—")}</p>
  <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
    <thead><tr><th style="text-align:left;padding:4px 8px;border-bottom:2px solid #111">Descripción</th><th style="text-align:right;padding:4px 8px;border-bottom:2px solid #111">Cant. × precio</th><th style="text-align:right;padding:4px 8px;border-bottom:2px solid #111">Importe</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <table style="width:100%;font-size:14px">
    <tr><td style="padding:2px 8px">Total</td><td style="padding:2px 8px;text-align:right"><strong>${fmt(datos.total)}</strong></td></tr>
    ${saldada ? `<tr><td colspan="2" style="padding:8px;text-align:center;font-weight:bold;border:1px solid #111;margin-top:8px">*** PAGADO ***</td></tr>` : `
    <tr><td style="padding:2px 8px">Abonado</td><td style="padding:2px 8px;text-align:right">${fmt(datos.abono)}</td></tr>
    <tr><td style="padding:2px 8px"><strong>Resta por pagar</strong></td><td style="padding:2px 8px;text-align:right"><strong>${fmt(restante)}</strong></td></tr>`}
  </table>
  <p style="margin:20px 0 0;font-size:12px;color:#777">Comprobante no fiscal. ${datos.mensajePieRecibo ? escapar(datos.mensajePieRecibo) : "Conserve este comprobante para cualquier reclamo."}</p>
</div>`.trim();

  const texto = `${datos.lavanderiaInfo.nombre} - Recibo ${numero}\nCliente: ${cliente}\nTotal: ${fmt(datos.total)}\n${saldada ? "PAGADO" : `Abonado: ${fmt(datos.abono)}\nResta por pagar: ${fmt(restante)}`}`;

  return { asunto, html, texto };
}
