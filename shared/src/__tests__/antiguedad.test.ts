import { describe, it, expect } from "vitest";
import { diasDeAntiguedad, resumirAntiguedad, tramoDe } from "../utils/antiguedad";

describe("antigüedad de deudas", () => {
  const hoy = new Date(2026, 8, 23, 15, 0);

  it("cuenta días de calendario sin importar la hora", () => {
    expect(diasDeAntiguedad(new Date(2026, 8, 23, 23, 59), hoy)).toBe(0);
    expect(diasDeAntiguedad(new Date(2026, 8, 22, 0, 1), hoy)).toBe(1);
    expect(diasDeAntiguedad(new Date(2026, 7, 24), hoy)).toBe(30);
  });

  it("una fecha futura no da días negativos", () => {
    expect(diasDeAntiguedad(new Date(2026, 9, 5), hoy)).toBe(0);
  });

  it("reparte en tramos con los bordes correctos", () => {
    expect(tramoDe(0)).toBe("D0_30");
    expect(tramoDe(30)).toBe("D0_30");
    expect(tramoDe(31)).toBe("D31_60");
    expect(tramoDe(60)).toBe("D31_60");
    expect(tramoDe(61)).toBe("D61_90");
    expect(tramoDe(90)).toBe("D61_90");
    expect(tramoDe(91)).toBe("D90_MAS");
    expect(tramoDe(900)).toBe("D90_MAS");
  });

  it("resume por tramo, incluidos los vacíos", () => {
    const r = resumirAntiguedad([
      { dias: 5, monto: 10.5 },
      { dias: 20, monto: 4.5 },
      { dias: 120, monto: 100 },
    ]);
    expect(r.map((t) => [t.id, t.monto, t.cantidad])).toEqual([
      ["D0_30", 15, 2],
      ["D31_60", 0, 0],
      ["D61_90", 0, 0],
      ["D90_MAS", 100, 1],
    ]);
  });
});
