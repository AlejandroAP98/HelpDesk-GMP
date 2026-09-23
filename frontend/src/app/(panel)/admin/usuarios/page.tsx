"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { adminApi, empresaApi, type Empresa } from "@/lib/endpoints";
import type { Usuario, Rol } from "@/store/authStore";
import { useCrudPage } from "@/hooks/useCrudPage";
import { extractApiError } from "@/lib/errors";
import { DataTable } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import AddUserIcon from "@/app/assets/icons/AddUserIcon";

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

export default function UsuariosPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const filtros = useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filtroRol) f.rol = filtroRol;
    if (filtroEmpresa) f.empresa_id = Number(filtroEmpresa);
    if (filtroEstado) f.activo = filtroEstado === "activos";
    return f;
  }, [filtroRol, filtroEmpresa, filtroEstado]);

  const crud = useCrudPage<Usuario, UsuarioForm, string>({
    listar: (params) => adminApi.listarUsuarios(params),
    crear: (form) =>
      adminApi.crearUsuario({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        rol: form.rol,
        empresa_id: form.empresa_id,
      }),
    actualizar: (item, form) => {
      const data: { nombre?: string; email?: string; rol?: string; empresa_id?: number; password?: string } = {};
      if (form.nombre.trim()) data.nombre = form.nombre.trim();
      if (form.email.trim()) data.email = form.email.trim();
      if (form.rol) data.rol = form.rol;
      if (form.empresa_id !== null && form.empresa_id !== undefined) data.empresa_id = form.empresa_id;
      if (form.password) data.password = form.password;
      return adminApi.actualizarUsuario(item.id, data);
    },
    eliminar: (item) => adminApi.eliminarUsuario(item.id),
    keyOf: (item) => item.id,
    emptyForm: () => ({ nombre: "", email: "", password: "", rol: "cliente", empresa_id: null }),
    toForm: (item) => ({
      nombre: item.nombre,
      email: item.email,
      password: "",
      rol: item.rol,
      empresa_id: item.empresa_id,
    }),
    filtros,
    errorFrom: extractApiError,
    confirmarEliminar: () => confirm("¿Eliminar este usuario?"),
    mensajes: {
      cargar: "No se pudieron cargar los usuarios",
      guardar: "Error al guardar",
      eliminar: "No se pudo eliminar el usuario",
    },
  });
  const {
    items: usuarios, cargando, error, setError,
    page, totalPages, setPage,
    modalOpen, editando, form, setForm,
    guardando, eliminandoKey,
    abrirCrear, abrirEditar, cerrarModal, guardar, eliminar, cargar: recargar,
  } = crud;

  const cargarEmpresas = useCallback(async () => {
    try {
      const res = await empresaApi.listar({ size: 100 });
      setEmpresas(res.items);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las empresas");
    }
  }, [setError]);

  useEffect(() => {
    cargarEmpresas();
  }, [cargarEmpresas]);

  const setField = <K extends keyof UsuarioForm>(key: K, value: UsuarioForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onGuardar = () => {
    if (guardando) return;
    if (!form.nombre.trim() || !form.email.trim()) return;
    if (!editando && !form.password) return;
    guardar();
  };

  const onEliminar = (u: Usuario) => {
    if (eliminandoKey) return;
    eliminar(u);
  };

  const cambiarEstado = async (u: Usuario) => {
    if (guardando) return;
    if (u.activo && !confirm(`¿Inactivar a ${u.nombre}? Ya no podra ingresar al sistema.`)) return;
    if (!u.activo && !confirm(`¿Reactivar a ${u.nombre}?`)) return;
    try {
      await adminApi.actualizarUsuario(u.id, { activo: !u.activo });
      recargar();
    } catch (e) {
      setError(extractApiError(e, "No se pudo cambiar el estado del usuario"));
    }
  };

  const empresaOptions = empresas.map((e) => ({ value: String(e.id), label: e.nombre }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios"
        subtitle="Gestiona los usuarios del sistema"
        actions={<Button onClick={abrirCrear} className="text-nowrap text-xs sm:text-sm" icon={<AddUserIcon />}>Nuevo usuario</Button>}
      />

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
        <Select
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value); setPage(1); }}
          options={[
            { value: "activos", label: "Activos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
          placeholder="Todos los estados"
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
                cell: (u: Usuario) => <span className="font-normal text-xs sm:text-sm text-gray-900">{u.nombre}</span>,
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
                  <span className={`inline-block uppercase rounded-xl px-2.5 py-1 sm:py-2 sm:text-[11px] text-[9px] font-medium ${ROL_COLORS[u.rol] ?? "bg-gray-100 text-gray-600"}`}>
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
                key: "notificaciones_email",
                header: "Notificaciones Email",
                cell: (u: Usuario) => (
                  <span className={`inline-block uppercase rounded-xl px-2.5 py-1 sm:py-2 sm:text-[11px] text-[9px] font-medium ${u.notificaciones_email ? "bg-grayCustom/5 text-grayCustom" : "bg-redCustom/10 text-redCustom"}`}>
                    {u.notificaciones_email ? "Si" : "No"}
                  </span>
                ),
              },
              {
                key: "estado",
                header: "Estado",
                cell: (u: Usuario) => (
                  <span className={`inline-block uppercase rounded-xl px-2.5 py-1 sm:py-2 sm:text-[11px] text-[9px] font-medium ${u.activo ? "bg-greenCustom/10 text-greenCustom" : "bg-gray-200 text-gray-500"}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                ),
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
                      variant="secondary"
                      onClick={() => cambiarEstado(u)}
                      className={`py-1.5 px-3 text-xs ${u.activo ? "text-yellowCustom" : "text-greenCustom"}`}
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => onEliminar(u)}
                      loading={eliminandoKey === u.id}
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
            minWidth="min-w-[820px]"
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </>
      )}

      <Modal open={modalOpen}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
            <Button variant="secondary" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button
              onClick={onGuardar}
              loading={guardando}
              disabled={!form.nombre.trim() || !form.email.trim() || (!editando && !form.password)}
            >
              {editando ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
