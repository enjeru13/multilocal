import { useNavigate } from "react-router-dom";
import { useAtajos, useAtajosContext, type Atajo } from "./atajosCore";
import { useNavegacion } from "../experiencia/navegacion";
import { useTema } from "../tema/temaCore";

/** Atajos que valen en cualquier pantalla: ir a cada sección, buscador de comandos y ayuda. */
export default function AtajosGlobales() {
  const navigate = useNavigate();
  const { abrirPaleta, abrirAyuda } = useAtajosContext();
  const { todos } = useNavegacion();
  const { alternar } = useTema();

  const atajos: Atajo[] = [
    { combo: "Ctrl+K", descripcion: "Buscar comando o pantalla", grupo: "General", accion: () => abrirPaleta(true), enCampo: true },
    { combo: "?", descripcion: "Ver esta ayuda", grupo: "General", accion: () => abrirAyuda(true) },
    { combo: "Ctrl+Shift+L", descripcion: "Cambiar tema (sistema, claro, oscuro)", grupo: "General", accion: alternar, enCampo: true },
    ...todos
      .filter((n) => n.atajo)
      .map<Atajo>((n) => ({
        combo: n.atajo!,
        descripcion: `Ir a ${n.label}`,
        grupo: "Ir a",
        accion: () => navigate(n.to),
      })),
  ];

  useAtajos(atajos);
  return null;
}
