import dayjs from "dayjs";

export type PresetPeriodo = "hoy" | "7d" | "mes" | "mesPasado" | "anio" | "personalizado";

export const PRESETS_PERIODO: { id: Exclude<PresetPeriodo, "personalizado">; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "mes", label: "Este mes" },
  { id: "mesPasado", label: "Mes pasado" },
  { id: "anio", label: "Este año" },
];

export interface RangoFechas {
  desde: string;
  hasta: string;
}

const FMT = "YYYY-MM-DD";

export function rangoDePreset(id: Exclude<PresetPeriodo, "personalizado">): RangoFechas {
  const hoy = dayjs();
  switch (id) {
    case "hoy":
      return { desde: hoy.format(FMT), hasta: hoy.format(FMT) };
    case "7d":
      return { desde: hoy.subtract(6, "day").format(FMT), hasta: hoy.format(FMT) };
    case "mes":
      return { desde: hoy.startOf("month").format(FMT), hasta: hoy.format(FMT) };
    case "mesPasado": {
      const m = hoy.subtract(1, "month");
      return { desde: m.startOf("month").format(FMT), hasta: m.endOf("month").format(FMT) };
    }
    case "anio":
      return { desde: hoy.startOf("year").format(FMT), hasta: hoy.format(FMT) };
  }
}

export const rangoValido = (r: RangoFechas) => !!r.desde && !!r.hasta && r.desde <= r.hasta;
