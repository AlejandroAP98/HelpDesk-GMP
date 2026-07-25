"use client";

import { useEffect, useState, useCallback } from "react";
import { empresaApi, type Empresa } from "@/lib/endpoints";
import { DataTable } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import AddFactoryIcon from "@/app/assets/icons/AddFactoryIcon";

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await empresaApi.listar({ page, size: 15 });
      setEmpresas(res.items);
      setTotalPages(res.pages);
    } catch {
      setError("No se pudieron cargar las empresas");
    } finally {
      setCargando(false);
    }
  }, [page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirCrear = () => {
    setEditando(null);
    setNombre("");
    setModalOpen(true);
  };

  const abrirEditar = (e: Empresa) => {
    setEditando(e);
    setNombre(e.nombre);
    setModalOpen(true);
  };

  const guardar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await empresaApi.actualizar(editando.id, { nombre: nombre.trim() });
      } else {
        await empresaApi.crear({ nombre: nombre.trim() });
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
    if (!confirm("¿Eliminar esta empresa? Los usuarios asociados perderán la referencia.")) return;
    setEliminandoId(id);
    setError(null);
    try {
      await empresaApi.eliminar(id);
      await cargar();
    } catch {
      setError("No se pudo eliminar. Verifique que no tenga usuarios asociados.");
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="sm:text-2xl text-lg font-bold tracking-tight text-gray-900">Empresas</h1>
          <p className="text-gray-500 sm:text-sm text-xs mt-1">Gestiona las empresas del sistema</p>
        </div>
        <Button onClick={abrirCrear} className=" text-nowrap" icon={<AddFactoryIcon />}>Nueva empresa</Button>
      </div>

      {error && <ErrorMessage message={error} />}

      {cargando ? (
        <LoadingState />
      ) : empresas.length === 0 ? (
        <EmptyState message="No hay empresas registradas." />
      ) : (
        <>
          <DataTable
            columns={[
              {
                key: "id",
                header: "ID",
                cell: (e: Empresa) => <span className="text-gray-400 sm:text-xs text-xs">#{e.id}</span>,
              },
              {
                key: "nombre",
                header: "Nombre",
                cell: (e: Empresa) => <span className="font-medium text-gray-900 sm:text-xs text-xs">{e.nombre}</span>,
              },
              {
                key: "fecha_creacion",
                header: "Creada",
                cell: (e: Empresa) => (
                  <span className="text-gray-400 sm:text-xs text-xs">
                    {new Date(e.fecha_creacion).toLocaleDateString("es-CO")}
                  </span>
                ),
              },
              {
                key: "acciones",
                header: "Acciones",
                cell: (e: Empresa) => (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => abrirEditar(e)} className="py-1.5 px-3 text-xs">
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => eliminar(e.id)}
                      loading={eliminandoId === e.id}
                      className="py-1.5 sm:py-2 sm:text-[11px] text-[9px] px-3 text-xs bg-redCustom/90 hover:bg-redCustom"
                    >
                      Eliminar
                    </Button>
                  </div>
                ),
              },
            ]}
            data={empresas}
            keyExtractor={(e: Empresa) => String(e.id)}
            minWidth="min-w-[500px]"
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
              {editando ? "Editar empresa" : "Nueva empresa"}
            </h2>
            <div className="space-y-4">
              <Input
                label="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre de la empresa"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardar} loading={guardando} disabled={!nombre.trim()}>
                  {editando ? "Guardar cambios" : "Crear empresa"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
