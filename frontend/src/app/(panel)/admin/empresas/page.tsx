"use client";

import { empresaApi, type Empresa } from "@/lib/endpoints";
import { useCrudPage } from "@/hooks/useCrudPage";
import { DataTable } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import AddFactoryIcon from "@/app/assets/icons/AddFactoryIcon";

interface EmpresaForm {
  nombre: string;
}

export default function EmpresasPage() {
  const crud = useCrudPage<Empresa, EmpresaForm, number>({
    listar: (params) => empresaApi.listar(params),
    crear: (form) => empresaApi.crear({ nombre: form.nombre.trim() }),
    actualizar: (item, form) => empresaApi.actualizar(item.id, { nombre: form.nombre.trim() }),
    eliminar: (item) => empresaApi.eliminar(item.id),
    keyOf: (item) => item.id,
    emptyForm: () => ({ nombre: "" }),
    toForm: (item) => ({ nombre: item.nombre }),
    confirmarEliminar: () =>
      confirm("¿Eliminar esta empresa? Los usuarios asociados perderán la referencia."),
    mensajes: {
      cargar: "No se pudieron cargar las empresas",
      guardar: "Error al guardar",
      eliminar: "No se pudo eliminar. Verifique que no tenga usuarios asociados.",
    },
  });
  const {
    items: empresas, cargando, error,
    page, totalPages, setPage,
    modalOpen, editando, form, setForm,
    guardando, eliminandoKey,
    abrirCrear, abrirEditar, cerrarModal, guardar, eliminar,
  } = crud;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Empresas"
        subtitle="Gestiona las empresas del sistema"
        actions={<Button onClick={abrirCrear} className="text-nowrap text-xs sm:text-sm" icon={<AddFactoryIcon />}>Nueva empresa</Button>}
      />

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
                cell: (e: Empresa) => <span className="font-normal text-gray-900 sm:text-xs text-xs">{e.nombre}</span>,
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
                      onClick={() => eliminar(e)}
                      loading={eliminandoKey === e.id}
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

      <Modal open={modalOpen}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editando ? "Editar empresa" : "Nueva empresa"}
        </h2>
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ nombre: e.target.value })}
            placeholder="Nombre de la empresa"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button onClick={guardar} loading={guardando} disabled={!form.nombre.trim()}>
              {editando ? "Guardar cambios" : "Crear empresa"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
