import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import { FaPlus, FaPen, FaUserCheck, FaUserSlash, FaUserCog } from "react-icons/fa";
import { usuariosService, type Usuario } from "../services/usuariosService";
import { useAuth } from "../hooks/useAuth";
import type { Role } from "@lavanderia/shared/types/types";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Campo, ModalEncabezado, ModalPie, campo } from "../components/ui/Formulario";

const ROLES: { valor: Role; etiqueta: string; ayuda: string }[] = [
  { valor: "ADMIN", etiqueta: "Administrador", ayuda: "Acceso total, incluida configuración y usuarios." },
  { valor: "EMPLOYEE", etiqueta: "Empleado", ayuda: "Opera órdenes, clientes, inventario y compras." },
  { valor: "CAJERO", etiqueta: "Cajero", ayuda: "Opera la caja." },
];

const etiquetaRol = (r: Role) => ROLES.find((x) => x.valor === r)?.etiqueta ?? r;

function msgError(err: unknown, fallback: string) {
  return err instanceof AxiosError ? err.response?.data?.message ?? fallback : fallback;
}

export default function PantallaUsuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [editando, setEditando] = useState<Usuario | "nuevo" | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Role>("EMPLOYEE");

  const cargar = useCallback(async () => {
    try {
      const res = await usuariosService.getAll();
      setUsuarios(res.data);
    } catch (err) {
      toast.error(msgError(err, "No se pudieron cargar los usuarios."));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = (u: Usuario | "nuevo") => {
    setEditando(u);
    setNombre(u === "nuevo" ? "" : u.name ?? "");
    setEmail(u === "nuevo" ? "" : u.email);
    setPassword("");
    setRol(u === "nuevo" ? "EMPLOYEE" : u.role);
  };

  const guardar = async () => {
    if (!nombre.trim()) return toast.error("El nombre es obligatorio.");
    if (editando === "nuevo") {
      if (!email.trim()) return toast.error("El correo es obligatorio.");
      if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    } else if (password && password.length < 6) {
      return toast.error("La contraseña debe tener al menos 6 caracteres.");
    }

    setGuardando(true);
    try {
      if (editando === "nuevo") {
        await usuariosService.create({ email: email.trim(), password, name: nombre.trim(), role: rol });
        toast.success("Usuario creado.");
      } else if (editando) {
        await usuariosService.update(editando.id, {
          name: nombre.trim(),
          role: rol,
          ...(password ? { password } : {}),
        });
        toast.success("Usuario actualizado.");
      }
      setEditando(null);
      cargar();
    } catch (err) {
      toast.error(msgError(err, "No se pudo guardar el usuario."));
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (u: Usuario) => {
    try {
      await usuariosService.update(u.id, { activo: !u.activo });
      toast.success(u.activo ? "Usuario desactivado." : "Usuario reactivado.");
      cargar();
    } catch (err) {
      toast.error(msgError(err, "No se pudo cambiar el estado."));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Usuarios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Quién puede entrar al sistema y qué puede hacer. Los usuarios no se borran, se desactivan.
          </p>
        </div>
        <Button onClick={() => abrir("nuevo")} variant="primary" leftIcon={<FaPlus className="w-4 h-4" />}>
          Nuevo usuario
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        <table className="min-w-full bg-white dark:bg-gray-900 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide font-semibold border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-6 py-3 text-left">Nombre</th>
              <th className="px-6 py-3 text-left">Correo</th>
              <th className="px-6 py-3 text-left">Rol</th>
              <th className="px-6 py-3 text-left">Estado</th>
              <th className="px-6 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={`border-t border-gray-100 dark:border-gray-800 ${u.activo ? "" : "opacity-50"}`}>
                <td className="px-6 py-3 font-semibold text-gray-800 dark:text-gray-100">
                  {u.name ?? "—"} {u.id === user?.id && <span className="text-xs text-blue-500">(tú)</span>}
                </td>
                <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{etiquetaRol(u.role)}</td>
                <td className="px-6 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      u.activo
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {u.activo ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td className="px-6 py-3 text-center">
                  <div className="inline-flex gap-2">
                    <Button onClick={() => abrir(u)} title="Editar" variant="iconInfo" size="icon">
                      <FaPen size={12} />
                    </Button>
                    {u.id !== user?.id && (
                      <Button
                        onClick={() => alternarActivo(u)}
                        title={u.activo ? "Desactivar" : "Reactivar"}
                        variant={u.activo ? "iconDanger" : "iconSuccess"}
                        size="icon"
                      >
                        {u.activo ? <FaUserSlash size={12} /> : <FaUserCheck size={12} />}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal open onClose={() => setEditando(null)} maxWidth="max-w-md">
          <ModalEncabezado
            icono={<FaUserCog />}
            titulo={editando === "nuevo" ? "Nuevo usuario" : "Editar usuario"}
            subtitulo={editando === "nuevo" ? "Podrá entrar con su correo y contraseña" : editando.email}
            onClose={() => setEditando(null)}
          />
          <form
            id="usuario-form"
            onSubmit={(e) => {
              e.preventDefault();
              guardar();
            }}
            className="px-6 py-5 space-y-4"
          >
            <Campo etiqueta="Nombre">
              <input className={campo} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </Campo>
            {editando === "nuevo" && (
              <Campo etiqueta="Correo">
                <input className={campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
              </Campo>
            )}
            <Campo etiqueta={editando === "nuevo" ? "Contraseña" : "Nueva contraseña"} ayuda={editando === "nuevo" ? "Mínimo 6 caracteres." : "Déjala vacía para no cambiarla."}>
              <input className={campo} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Campo>
            <Campo etiqueta="Rol" ayuda={ROLES.find((r) => r.valor === rol)?.ayuda}>
              <select className={campo} value={rol} onChange={(e) => setRol(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
          </form>
          <ModalPie>
            <Button variant="secondary" onClick={() => setEditando(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" form="usuario-form" variant="primary" isLoading={guardando}>
              Guardar
            </Button>
          </ModalPie>
        </Modal>
      )}
    </div>
  );
}
