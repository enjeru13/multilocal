// Puente mínimo hacia el sistema: solo la impresión directa de tickets. La app habla con el servidor
// embebido por HTTP local (127.0.0.1); esto existe únicamente para lo que el navegador no puede hacer.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mostradorEscritorio", {
  /** Impresoras instaladas en este equipo: [{ name, displayName, isDefault }]. */
  listarImpresoras: () => ipcRenderer.invoke("impresoras:listar"),
  /**
   * Manda un ticket a la impresora sin abrir el diálogo de impresión, en crudo (ESC/POS).
   * `lineas` son los renglones ya extraídos del ticket; `columnas`, el ancho de texto del rollo.
   * Devuelve { ok, motivo? }.
   */
  imprimirTicket: (datos) => ipcRenderer.invoke("impresion:ticket", datos),
});
