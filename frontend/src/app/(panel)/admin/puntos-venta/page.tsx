"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { puntoVentaApi, empresaApi, type PuntoVenta, type Empresa } from "@/lib/endpoints";
import { useCrudPage } from "@/hooks/useCrudPage";
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
import AddSedeIcon from "@/app/assets/icons/AddSedeIcon";

interface PuntoVentaForm {
  empresaId: number | null;
  nombre: string;
  direccion: string;
  ciudad: string;
  activo: boolean;
}

export default function PuntosVentaPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtros = useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filtroEmpresa) f.empresa_id = filtroEmpresa;
    if (busquedaDebounced.length >= 2) f.q = busquedaDebounced;
    return f;
  }, [filtroEmpresa, busquedaDebounced]);

  const crud = useCrudPage<PuntoVenta, PuntoVentaForm, number>({
    listar: (params) => puntoVentaApi.listar(params),
    crear: (form) =>
      puntoVentaApi.crear({
        empresa_id: form.empresaId!,
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || undefined,
        ciudad: form.ciudad.trim() || undefined,
      }),
    actualizar: (item, form) =>
      puntoVentaApi.actualizar(item.id, {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || undefined,
        ciudad: form.ciudad.trim() || undefined,
        activo: form.activo,
      }),
    eliminar: (item) => puntoVentaApi.eliminar(item.id),
    keyOf: (item) => item.id,
    emptyForm: () => ({ empresaId: null, nombre: "", direccion: "", ciudad: "", activo: true }),
    toForm: (item) => ({
      empresaId: item.empresa_id,
      nombre: item.nombre,
      direccion: item.direccion || "",
      ciudad: item.ciudad || "",
      activo: item.activo,
    }),
    filtros,
    confirmarEliminar: () => confirm("¿Eliminar este punto de venta?"),
    mensajes: {
      cargar: "No se pudieron cargar los puntos de venta",
      guardar: "Error al guardar",
      eliminar: "No se pudo eliminar.",
    },
  });
  const {
    cargando, error,
    page, totalPages, setPage,
    modalOpen, editando, form, setForm,
    guardando, eliminandoKey,
    abrirCrear, abrirEditar, cerrarModal, guardar, eliminar,
  } = crud;
  const items = crud.items;

  useEffect(() => {
    empresaApi.listar({ size: 100 }).then((r) => setEmpresas(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBusquedaDebounced(busqueda.trim());
      setPage(1);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [busqueda, setPage]);

  const setField = <K extends keyof PuntoVentaForm>(key: K, value: PuntoVentaForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onGuardar = () => {
    if (!form.nombre.trim() || !form.empresaId) return;
    guardar();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Puntos de Venta"
        subtitle="Sedes y sucursales de cada empresa"
        actions={
          <Button onClick={abrirCrear} className="text-nowrap text-xs sm:text-sm" icon={<AddSedeIcon />}>
            Nuevo punto
          </Button>
        }
      />
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-end justify-start">
        <div className="relative flex-1 sm:max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607"/></svg>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:font-regular placeholder-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brandCustom focus:bg-white outline-none transition-all"
          />
          {busqueda && (
            <button
              onClick={() => { setBusqueda(""); setBusquedaDebounced(""); setPage(1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        <Select
          label="Empresa"
          options={[
            { value: "", label: "Todas" },
            ...empresas.map((e) => ({ value: String(e.id), label: e.nombre })),
          ]}
          value={filtroEmpresa ? String(filtroEmpresa) : ""}
          onChange={(e) => {
            setFiltroEmpresa(Number(e.target.value) || null);
            setPage(1);
          }}
          className="min-w-[180px]"
        />
      </div>

      {error && <ErrorMessage message={error} />}

      {cargando ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message="No hay puntos de venta registrados." />
      ) : (
        <>
          <DataTable
            columns={[
              {
                key: "id",
                header: "ID",
                cell: (pv: PuntoVenta) => <span className="text-gray-400 sm:text-xs text-xs">#{pv.id}</span>,
              },
              {
                key: "empresa_nombre",
                header: "Empresa",
                cell: (pv: PuntoVenta) => (
                  <span className="text-gray-500 sm:text-xs text-xs">{pv.empresa_nombre || pv.empresa_id}</span>
                ),
              },
              {
                key: "nombre",
                header: "Nombre",
                cell: (pv: PuntoVenta) => (
                  <span className="font-normal text-gray-900 sm:text-xs text-xs">{pv.nombre}</span>
                ),
              },
              {
                key: "ciudad",
                header: "Ciudad",
                cell: (pv: PuntoVenta) => (
                  <span className="text-gray-500 sm:text-xs text-xs">{pv.ciudad || "-"}</span>
                ),
              },
              {
                key: "direccion",
                header: "Direccion",
                cell: (pv: PuntoVenta) => (
                  <span className="text-gray-500 sm:text-xs text-xs truncate max-w-[200px] block">{pv.direccion || "-"}</span>
                ),
              },
              {
                key: "activo",
                header: "Estado",
                cell: (pv: PuntoVenta) => (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    pv.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {pv.activo ? "Activo" : "Inactivo"}
                  </span>
                ),
              },
              {
                key: "acciones",
                header: "Acciones",
                cell: (pv: PuntoVenta) => (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => abrirEditar(pv)} className="py-1.5 px-3 text-xs">
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => eliminar(pv)}
                      loading={eliminandoKey === pv.id}
                      className="py-1.5 sm:py-2 sm:text-[11px] text-[9px] px-3 text-xs bg-redCustom/90 hover:bg-redCustom"
                    >
                      Eliminar
                    </Button>
                  </div>
                ),
              },
            ]}
            data={items}
            keyExtractor={(pv: PuntoVenta) => String(pv.id)}
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

      <Modal open={modalOpen}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editando ? "Editar punto de venta" : "Nuevo punto de venta"}
        </h2>
        <div className="space-y-4">
          <Select
            label="Empresa"
            value={form.empresaId ? String(form.empresaId) : ""}
            onChange={(e) => setField("empresaId", Number(e.target.value) || null)}
            placeholder="Seleccione..."
            disabled={!!editando}
            options={empresas.map((e) => ({ value: String(e.id), label: e.nombre }))}
          />
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setField("nombre", e.target.value)}
            placeholder="Nombre del punto de venta"
            autoFocus
          />
          <Input
            label="Ciudad"
            value={form.ciudad}
            onChange={(e) => setField("ciudad", e.target.value)}
            placeholder="Ej: Bucaramanga"
          />
          <Input
            label="Direccion"
            value={form.direccion}
            onChange={(e) => setField("direccion", e.target.value)}
            placeholder="Direccion completa"
          />
          {editando && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setField("activo", e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brandCustom"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button onClick={onGuardar} loading={guardando} disabled={!form.nombre.trim() || !form.empresaId}>
              {editando ? "Guardar cambios" : "Crear punto"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
