/** Detecta un error conocido de Prisma por su código (más fiable que instanceof entre módulos duplicados). */
export function esErrorPrisma(error: unknown, codigo: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === codigo
  );
}
