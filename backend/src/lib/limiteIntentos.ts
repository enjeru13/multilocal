/**
 * Freno a las contraseñas adivinadas: pasados unos fallos seguidos desde el mismo lugar (o contra
 * el mismo usuario) se bloquean los intentos un rato. Es en memoria: al reiniciar el servidor se
 * borra, lo cual basta para frenar ataques automáticos sin depender de la base de datos.
 */
const VENTANA_MS = 15 * 60_000;
const MAX_POR_USUARIO = 8;
const MAX_POR_ORIGEN = 40;

interface Registro {
  fallos: number;
  desde: number;
}

const registros = new Map<string, Registro>();

function vigente(clave: string, ahora: number): Registro | undefined {
  const r = registros.get(clave);
  if (!r) return undefined;
  if (ahora - r.desde > VENTANA_MS) {
    registros.delete(clave);
    return undefined;
  }
  return r;
}

const claves = (origen: string, email: string) => [`u:${origen}|${email.trim().toLowerCase()}`, `o:${origen}`] as const;

/** Segundos que faltan para poder volver a intentar, o null si puede intentar ya. */
export function segundosDeBloqueo(origen: string, email: string, ahora = Date.now()): number | null {
  const [porUsuario, porOrigen] = claves(origen, email);
  const u = vigente(porUsuario, ahora);
  const o = vigente(porOrigen, ahora);
  const bloqueado = (u && u.fallos >= MAX_POR_USUARIO ? u : null) ?? (o && o.fallos >= MAX_POR_ORIGEN ? o : null);
  if (!bloqueado) return null;
  return Math.max(1, Math.ceil((bloqueado.desde + VENTANA_MS - ahora) / 1000));
}

export function registrarFallo(origen: string, email: string, ahora = Date.now()) {
  for (const clave of claves(origen, email)) {
    const r = vigente(clave, ahora);
    if (r) r.fallos += 1;
    else registros.set(clave, { fallos: 1, desde: ahora });
  }
}

/** Un acceso correcto borra los fallos de ese usuario desde ese lugar. */
export function limpiarFallos(origen: string, email: string) {
  registros.delete(claves(origen, email)[0]);
}

export function reiniciarLimites() {
  registros.clear();
}
