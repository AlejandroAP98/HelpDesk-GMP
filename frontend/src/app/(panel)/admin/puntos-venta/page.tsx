"use client";

import { useEffect, useState, useCallback } from "react";
import { puntoVentaApi, empresaApi, type PuntoVenta, type Empresa, type Pagina } from "@/lib/endpoints";
import { DataTable } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import AddSedeIcon from "@/app/assets/icons/AddSedeIcon";

export default function PuntosVentaPage() {
  const [data, setData] = useState<Pagina<PuntoVenta> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<PuntoVenta | null>(null);
  const [nombre, setNombre] = useState("");
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params: Record<string, unknown> = { page, size: 15 };
      if (filtroEmpresa) params.empresa_id = filtroEmpresa;
      const res = await puntoVentaApi.listar(params);
      setData(res);
    } catch {
      setError("No se pudieron cargar los puntos de venta");
    } finally {
      setCargando(false);
    }
  }, [page, filtroEmpresa]);

  useEffect(() => {
    empresaApi.listar({ size: 100 }).then((r) => setEmpresas(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirCrear = () => {
    setEditando(null);
    setNombre("");
    setEmpresaId(null);
    setDireccion("");
    setCiudad("");
    setActivo(true);
    setModalOpen(true);
  };

  const abrirEditar = (pv: PuntoVenta) => {
    setEditando(pv);
    setNombre(pv.nombre);
    setEmpresaId(pv.empresa_id);
    setDireccion(pv.direccion || "");
    setCiudad(pv.ciudad || "");
    setActivo(pv.activo);
    setModalOpen(true);
  };

  const guardar = async () => {
    if (!nombre.trim() || !empresaId) return;
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await puntoVentaApi.actualizar(editando.id, {
          nombre: nombre.trim(),
          direccion: direccion.trim() || undefined,
          ciudad: ciudad.trim() || undefined,
          activo,
        });
      } else {
        await puntoVentaApi.crear({
          empresa_id: empresaId,
          nombre: nombre.trim(),
          direccion: direccion.trim() || undefined,
          ciudad: ciudad.trim() || undefined,
        });
      }
      setModalOpen(false);
      await cargar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este punto de venta?")) return;
    setEliminandoId(id);
    setError(null);
    try {
      await puntoVentaApi.eliminar(id);
      await cargar();
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="sm:text-2xl text-lg font-bold tracking-tight text-gray-900">Puntos de Venta</h1>
          <p className="text-gray-500 sm:text-sm text-xs mt-1">Sedes y sucursales de cada empresa</p>
        </div>
        <Button onClick={abrirCrear} className="text-nowrap" icon={<AddSedeIcon />}>
            Nuevo punto
        </Button>
        <div className="flex w-full">
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
      </div>

      {error && <ErrorMessage message={error} />}

      {cargando || !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
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
                  <span className="font-medium text-gray-900 sm:text-xs text-xs">{pv.nombre}</span>
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
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
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
                      onClick={() => eliminar(pv.id)}
                      loading={eliminandoId === pv.id}
                      className="py-1.5 sm:py-2 sm:text-[11px] text-[9px] px-3 text-xs bg-redCustom/90 hover:bg-redCustom"
                    >
                      Eliminar
                    </Button>
                  </div>
                ),
              },
            ]}
            data={data.items}
            keyExtractor={(pv: PuntoVenta) => String(pv.id)}
            minWidth="min-w-[700px]"
          />
          <Pagination
            page={page}
            totalPages={data.pages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editando ? "Editar punto de venta" : "Nuevo punto de venta"}
            </h2>
            <div className="space-y-4">
              <Select
                label="Empresa"
                value={empresaId ? String(empresaId) : ""}
                onChange={(e) => setEmpresaId(Number(e.target.value) || null)}
                placeholder="Seleccione..."
                disabled={!!editando}
                options={empresas.map((e) => ({ value: String(e.id), label: e.nombre }))}
              />
              <Input
                label="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del punto de venta"
                autoFocus
              />
              <Input
                label="Ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Ej: Bucaramanga"
              />
              <Input
                label="Direccion"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Direccion completa"
              />
              {editando && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brandCustom"
                  />
                  <span className="text-sm text-gray-700">Activo</span>
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardar} loading={guardando} disabled={!nombre.trim() || !empresaId}>
                  {editando ? "Guardar cambios" : "Crear punto"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
