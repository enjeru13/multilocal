/** 1200 → "1.2k", 3_400_000 → "3.4M". Para ejes de gráficos y etiquetas pequeñas. */
export function numeroCorto(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return `${+n.toFixed(2)}`;
}
