"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi, empresaApi, type Empresa, type Pagina } from "@/lib/endpoints";
import type { Usuario, Rol } from "@/store/authStore";
import { DataTable } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import AddUserIcon from "@/app/assets/icons/AddUserIcon";
import { extractApiError } from "@/lib/errors";

const ROLES: { value: string; label: string }[] = [
  { value: "cliente", label: "Cliente" },
  { value: "agente", label: "Agente" },
  { value: "mesa_ayuda", label: "Mesa de Ayuda" },
  { value: "administrador", label: "Administrador" },
];

const ROL_COLORS: Record<string, string> = {
  cliente: "bg-blueCustom/10 text-blueCustom",
  agente: "bg-greenCustom/10 text-greenCustom",
  mesa_ayuda: "bg-violetCustom/10 text-violetCustom",
  administrador: "bg-yellowCustom/10 text-yellowCustom",
};

interface UsuarioForm {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
  empresa_id: number | null;
}

const formVacio: UsuarioForm = { nombre: "", email: "", password: "", rol: "cliente", empresa_id: null };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState<UsuarioForm>(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const cargarEmpresas = useCallback(async () => {
    try {
      const res = await empresaApi.listar({ size: 100 });
      setEmpresas(res.items);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las empresas");
    }
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params: Record<string, unknown> = { page, size: 15 };
      if (filtroRol) params.rol = filtroRol;
      if (filtroEmpresa) params.empresa_id = Number(filtroEmpresa);
      const res: Pagina<Usuario> = await adminApi.listarUsuarios(params);
      setUsuarios(res.items);
      setTotalPages(res.pages);
    } catch {
      setError("No se pudieron cargar los usuarios");
    } finally {
      setCargando(false);
    }
  }, [page, filtroRol, filtroEmpresa]);

  useEffect(() => {
    cargarEmpresas();
  }, [cargarEmpresas]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setField = <K extends keyof UsuarioForm>(key: K, value: UsuarioForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const abrirCrear = () => {
    setEditando(null);
    setForm(formVacio);
    setModalOpen(true);
  };

  const abrirEditar = (u: Usuario) => {
    setEditando(u);
    setForm({
      nombre: u.nombre,
      email: u.email,
      password: "",
      rol: u.rol,
      empresa_id: u.empresa_id,
    });
    setModalOpen(true);
  };

  const guardar = async () => {
    if (guardando) return;
    if (!form.nombre.trim() || !form.email.trim()) return;
    if (!editando && !form.password) return;
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        const data: { nombre?: string; email?: string; rol?: string; empresa_id?: number; password?: string } = {};
        if (form.nombre.trim()) data.nombre = form.nombre.trim();
        if (form.email.trim()) data.email = form.email.trim();
        if (form.rol) data.rol = form.rol;
        if (form.empresa_id !== null && form.empresa_id !== undefined) data.empresa_id = form.empresa_id;
        if (form.password) data.password = form.password;
        await adminApi.actualizarUsuario(editando.id, data);
      } else {
        await adminApi.crearUsuario({
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          password: form.password,
          rol: form.rol,
          empresa_id: form.empresa_id,
        });
      }
      setModalOpen(false);
      await cargar();
    } catch (err: unknown) {
      setError(extractApiError(err, "Error al guardar"));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    if (eliminandoId) return;
    if (!confirm("¿Eliminar este usuario?")) return;
    setEliminandoId(id);
    setError(null);
    try {
      await adminApi.eliminarUsuario(id);
      await cargar();
    } catch (err: unknown) {
      setError(extractApiError(err, "No se pudo eliminar el usuario"));
    } finally {
      setEliminandoId(null);
    }
  };

  const empresaOptions = empresas.map((e) => ({ value: String(e.id), label: e.nombre }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona los usuarios del sistema</p>
        </div>
        <Button onClick={abrirCrear} className="text-xs py-2.5 px-3 sm:text-base sm:px-3 text-nowrap" icon={<AddUserIcon />}>Nuevo usuario</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={filtroRol}
          onChange={(e) => { setFiltroRol(e.target.value); setPage(1); }}
          options={ROLES}
          placeholder="Todos los roles"
          className="w-full max-w-xs"
        />
        <Select
          value={filtroEmpresa}
          onChange={(e) => { setFiltroEmpresa(e.target.value); setPage(1); }}
          options={empresaOptions}
          placeholder="Todas las empresas"
          className="w-full max-w-xs"
        />
      </div>

      {error && <ErrorMessage message={error} />}

      {cargando ? (
        <LoadingState />
      ) : usuarios.length === 0 ? (
        <EmptyState message="No hay usuarios con los filtros seleccionados." />
      ) : (
        <>
          <DataTable
            columns={[
              {
                key: "nombre",
                header: "Nombre",
                cell: (u: Usuario) => <span className="font-medium text-xs sm:text-sm text-gray-900">{u.nombre}</span>,
              },
              {
                key: "email",
                header: "Email",
                cell: (u: Usuario) => <span className="text-gray-500 text-xs sm:text-sm">{u.email}</span>,
              },
              {
                key: "rol",
                header: "Rol",
                cell: (u: Usuario) => (
                  <span className={`inline-block uppercase rounded-xl px-2.5 py-1 sm:py-2 sm:text-[11px] text-[9px] font-semibold ${ROL_COLORS[u.rol] ?? "bg-gray-100 text-gray-600"}`}>
                    {u.rol.replace("_", " ")}
                  </span>
                ),
              },
              {
                key: "empresa",
                header: "Empresa",
                cell: (u: Usuario) => {
                const emp = empresas.find((e) => e.id === u.empresa_id);
                return (
                  <span className="text-gray-400 text-xs">
                    {emp ? emp.nombre : "—"}
                  </span>
                );
              },
              },
              {
                key: "acciones",
                header: "Acciones",
                cell: (u: Usuario) => (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => abrirEditar(u)} className="py-1.5 px-3 text-xs">
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => eliminar(u.id)}
                      loading={eliminandoId === u.id}
                      className="py-1.5 sm:py-2 sm:text-[11px] text-[9px] px-3 text-xs bg-redCustom/90 hover:bg-redCustom"
                    >
                      Eliminar
                    </Button>
                  </div>
                ),
              },
            ]}
            data={usuarios}
            keyExtractor={(u: Usuario) => u.id}
            minWidth="min-w-[700px]"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editando ? "Editar usuario" : "Nuevo usuario"}
            </h2>
            <div className="space-y-4">
              <Input
                label="Nombre"
                value={form.nombre}
                onChange={(e) => setField("nombre", e.target.value)}
                placeholder="Nombre completo"
                autoFocus
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="correo@ejemplo.com"
              />
              <Input
                label={editando ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
                type="password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder="••••••••"
              />
              <Select
                label="Rol"
                value={form.rol}
                onChange={(e) => setField("rol", e.target.value as Rol)}
                options={ROLES}
              />
              <Select
                label="Empresa"
                value={form.empresa_id !== null ? String(form.empresa_id) : ""}
                onChange={(e) => setField("empresa_id", e.target.value ? Number(e.target.value) : null)}
                options={empresaOptions}
                placeholder="Sin empresa"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={guardar}
                  loading={guardando}
                  disabled={!form.nombre.trim() || !form.email.trim() || (!editando && !form.password)}
                >
                  {editando ? "Guardar cambios" : "Crear usuario"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
