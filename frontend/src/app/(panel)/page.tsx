"use client";

import Link from "next/link";
import { useDashboard } from "@/hooks/useDashboard";
import type { Ticket } from "@/lib/endpoints";
import { EstadoBadge, PrioridadBadge } from "@/components/Badges";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable } from "@/components/ui/Table";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { ViewModeToggle } from "@/components/ui/ViewModeToggle";
import { TicketCard } from "@/components/TicketCard";
import { DonutChart } from "@/components/DonutChart";
import { ActividadPanel } from "@/components/ActividadPanel";
import { buildTicketTableColumns, TICKET_RECIENTE_FECHA } from "@/components/tickets/ticketTableColumns";
import { ESTADO_DONUT_COLORS, ESTADO_DONUT_LABELS, PRIORIDAD_DONUT_COLORS, PRIORIDAD_DONUT_LABELS } from "@/lib/chartConstants";
import NewTicketIcon from "../assets/icons/NewTicketIcon";
import TicketIcon from "../assets/icons/TicketIcon";
import TicketOpenedIcon from "../assets/icons/TicketOpenedIcon";
import TicketSolvedIcon from "../assets/icons/TicketSolvedIcon";
import TicketClosedIcon from "../assets/icons/TicketClosedIcon";
import TicketProgressIcon from "../assets/icons/TicketProgressIcon";
import TicketPauseIcon from "../assets/icons/TicketPauseIcon";
import AssingUserIcon from "../assets/icons/AssignUserIcon";

const columnasRecientes = buildTicketTableColumns({
  tituloClass: "font-medium text-gray-800 text-xs lowercase",
  descripcionMax: 40,
  fechaOpts: TICKET_RECIENTE_FECHA,
});

export default function PanelHomePage() {
  const {
    usuario, recientes, cargando, stats, graficas, viewMode, cambiarModo,
    fechaInicio, setFechaInicio, fechaFin, setFechaFin,
    filtroEmpresaId, setFiltroEmpresaId, estado, setEstado, prioridad, setPrioridad,
    empresas, descargando, handleDescargar, limpiarFiltros, hayFiltros,
    esCliente, esAgente, actividadItems,
  } = useDashboard();

  return (
    <div className="space-y-3">
      <PageHeader
        title={`Hola, ${usuario?.nombre?.split(" ")[0]}`}
        subtitle={
          <>
            {usuario?.rol === "cliente" && "Información del estado de tus tickets de soporte y generación de reportes"}
            {usuario?.rol === "agente" && "Información del estado de los tickets"}
            {usuario?.rol === "mesa_ayuda" && "Supervisa, asigna y mide el rendimiento del equipo"}
            {usuario?.rol === "administrador" && "Panel de administracion y control global"}
          </>
        }
        actions={
          !esCliente ? (
            <a href="https://app.gmpredes.online/" target="_blank" rel="noopener noreferrer" className="hidden sm:block">
              <Button className="bg-gradient-to-r from-accentCustom text-nowrap to-red-600 hover:from-red-700 hover:to-red-700 !font-regular !sm:text-base !text-[12px] !self-end ">
                Reportes GMP
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-external-link" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6m-7 1 9-9m-5 0h5v5"/></svg>
              </Button>
            </a>
          ) : (
            <Link href="/tickets/nuevo">
              <Button className="text-nowrap">
                Nuevo ticket
                <NewTicketIcon />
              </Button>
            </Link>
          )
        }
      />
      <section className={`grid grid-cols-3 md:grid-cols-4 xl:grid-cols-7 md:gap-4 gap-2 bg-cardCustom p-4 sm:p-6 rounded-2xl items-center animate-fade-in`}>
        <StatsCard label="Total tickets" value={stats.total} icon={<TicketIcon />}  className="bg-brandCustom animate-scale-in " />
        <StatsCard label="Abiertos" value={stats.abiertos} icon={<TicketOpenedIcon />}  className="animate-scale-in bg-blueCustom " />
        <StatsCard label="Asignados" value={stats.asignados} icon={<AssingUserIcon />}  className="animate-scale-in bg-violetCustom" />
        <StatsCard label="En Progreso" value={stats.en_progreso} icon={<TicketProgressIcon />} className="animate-scale-in bg-yellowCustom" />
        <StatsCard label="En Espera" value={stats.en_pausa ?? 0} icon={<TicketPauseIcon />} className="animate-scale-in bg-amberCustom" />
        <StatsCard label="Resueltos" value={stats.resueltos} icon={<TicketSolvedIcon />}  className="animate-scale-in bg-greenCustom" />
        <StatsCard label="Cerrados" value={stats.cerrados} icon={<TicketClosedIcon />}  className="animate-scale-in bg-grayCustom" />
      </section>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-cardCustom p-4 sm:p-6 rounded-2xl animate-fade-in">
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl ">
          {(usuario?.rol === "administrador" || usuario?.rol === "mesa_ayuda") && (
            <ActividadPanel items={actividadItems} />
          )}
          {(usuario?.rol === "cliente") && (
            <>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Solucionados esta semana</p>
              <p className="text-5xl font-bold text-grayCustom animate-fade-in">{graficas?.cerrados_semana ?? 0}</p>
            </>
          )}
        </div>
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-4">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Tickets pendientes por estado</p>
          {graficas && graficas.no_cerrados_por_estado.length > 0 ? (
            <DonutChart
              data={graficas.no_cerrados_por_estado.map((e) => ({
                label: ESTADO_DONUT_LABELS[e.estado] ?? e.estado,
                value: e.cantidad,
                color: ESTADO_DONUT_COLORS[e.estado] ?? "#9ca3af",
              }))}
              size={130}
              centerLabel="pendientes"
            />
          ) : (
            <p className="text-xs text-gray-400 py-8">Sin datos</p>
          )}
        </div>
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-4">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Tickets pendientes por prioridad</p>
          {graficas && graficas.no_cerrados_por_prioridad.length > 0 ? (
            <DonutChart
              data={graficas.no_cerrados_por_prioridad.map((p) => ({
                label: PRIORIDAD_DONUT_LABELS[p.prioridad] ?? p.prioridad,
                value: p.cantidad,
                color: PRIORIDAD_DONUT_COLORS[p.prioridad] ?? "#9ca3af",
              }))}
              size={130}
              centerLabel="pendientes"
            />
          ) : (
            <p className="text-xs text-gray-400 py-8">Sin datos</p>
          )}
        </div>
      </section>
      {!esAgente && (
        <section className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 sm:p-5 flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight text-gray-900">
          Reporte de tickets
        </h2>
        <div className=" flex justify-between gap-2 w-full">
          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-col">
              <label className="text-[11px] px-1 font-medium text-gray-500 uppercase tracking-normal">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white text-gray-700 text-xs px-3 py-2 focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] px-1 font-medium text-gray-500 uppercase tracking-normal">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white text-gray-700 text-xs px-3 py-2 focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
              />
            </div>
            {!esCliente && empresas.length > 0 && (
              <Select
                label="Empresa"
                value={filtroEmpresaId}
                onChange={(e) => setFiltroEmpresaId(e.target.value)}
                options={empresas.map((e) => ({ value: String(e.id), label: e.nombre }))}
                placeholder="Todas"
                className="w-full sm:w-44 !text-xs"
              />
            )}
            <Select
              label="Estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              options={[
                { value: "abierto", label: "Abierto" },
                { value: "asignado", label: "Asignado" },
                { value: "en_progreso", label: "En Progreso" },
                { value: "resuelto", label: "Resuelto" },
                { value: "cerrado", label: "Cerrado" },
              ]}
              placeholder="Todos"
              className="w-full sm:w-40 !text-xs"
            />
            <Select
              label="Prioridad"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              options={[
                { value: "urgente", label: "Urgente" },
                { value: "alta", label: "Alta" },
                { value: "media", label: "Media" },
                { value: "baja", label: "Baja" },
              ]}
              placeholder="Todas"
              className="w-full sm:w-36 !text-xs"
            />
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="text-xs self-end text-gray-500 hover:text-gray-800 underline transition-colors mb-0.5"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
          <Button
            onClick={handleDescargar}
            loading={descargando}
            variant="secondary"
            disabled={descargando}
            className=" self-end w-fit h-fit !bg-greenCustom !text-white hover:!bg-greenCustom/80"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-file-type-csv" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12V5a2 2 0 0 1 2-2h7l5 5v4M7 16.5a1.5 1.5 0 0 0-3 0v3a1.5 1.5 0 0 0 3 0m3 .75c0 .414.336.75.75.75H12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h1.25a.75.75 0 0 1 .75.75m3-.75 2 6 2-6"/></svg> }
          >
            Descargar
          </Button>
      </section>
      )}
      <section className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-gray-900">Tickets Recientes</h2>
          <div className="flex items-center sm:gap-2 gap-2">
            <ViewModeToggle value={viewMode} onChange={cambiarModo} />
            <Link href="/tickets" className="text-xs text-nowrap sm:text-sm font-normal text-brandCustom hover:text-brandCustom/80 transition-colors flex justify-center items-center gap-1">
              Ver todos
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="m9 6 6 6-6 6"/></svg>
            </Link>
          </div>
        </div>

        {cargando ? (
          <div className="relative h-48">
            <LoadingState />
          </div>
        ) : recientes.length === 0 ? (
          <EmptyState message="No hay tickets todavia." />
        ) : viewMode === "table" ? (
          <DataTable
            columns={columnasRecientes}
            data={recientes}
            keyExtractor={(t: Ticket) => t.id}
            minWidth="min-w-[500px]"
          />
        )
        : (
          <div className="bg-cardCustom rounded-2xl min-h-[40vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 sm:gap-4 gap-3 sm:p-2">
              {recientes.map((t: Ticket, index: number) => (
                <TicketCard key={t.id} ticket={t} index={index} />
              ))}
          </div>
        </div>
        )}
      </section>
    </div>
  );
}
