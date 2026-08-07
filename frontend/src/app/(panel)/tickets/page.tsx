"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ticketApi, type Ticket, type EstadoTicket, type PrioridadTicket, type VistaTicket } from "@/lib/endpoints";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { useAuthStore } from "@/store/authStore";
import { EstadoBadge, PrioridadBadge, TotalBadge } from "@/components/Badges";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { TicketCard } from "@/components/TicketCard";
import NewTicketIcon from "@/app/assets/icons/NewTicketIcon";


const ESTADOS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "abierto", label: "Abierto" },
  { value: "asignado", label: "Asignado" },
  { value: "en_progreso", label: "En progreso" },
  { value: "resuelto", label: "Resuelto" },
  { value: "cerrado", label: "Cerrado" },
];

const PRIORIDADES: { value: string; label: string }[] = [
  { value: "todas", label: "Todos" },
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const VISTAS: { value: VistaTicket; label: string }[] = [
  { value: "activos", label: "Activos" },
  { value: "historial", label: "Historial" },
  { value: "todos", label: "Todos" },
];

const ESTADOS_POR_VISTA: Record<VistaTicket, { value: string; label: string }[]> = {
  activos: [
    { value: "todos", label: "Todos" },
    { value: "abierto", label: "Abierto" },
    { value: "asignado", label: "Asignado" },
    { value: "en_progreso", label: "En progreso" },
  ],
  historial: [
    { value: "todos", label: "Todos" },
    { value: "resuelto", label: "Resuelto" },
    { value: "cerrado", label: "Cerrado" },
  ],
  todos: ESTADOS,
};

type VistaMode = "cards" | "table";
const VISTA_STORAGE_KEY = "tickets:viewMode";

function getInitialVistaMode(): VistaMode {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(VISTA_STORAGE_KEY) === "table" ? "table" : "cards";
}

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState("todos");
  const [prioridad, setPrioridad] = useState("todas");
  const [vista, setVista] = useState<VistaTicket>("activos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [cargando, setCargando] = useState(true);
  const [viewMode, setViewMode] = useState<VistaMode>(getInitialVistaMode);

  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const setOnTicketAssigned = useWsTicketStore((s) => s.setOnTicketAssigned);
  const usuario = useAuthStore((s) => s.usuario);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const params: Record<string, unknown> = { page, size: 15 };
        if (vista !== "todos") params.vista = vista;
        if (estado !== "todos") params.estado = estado;
        if (prioridad !== "todas") params.prioridad = prioridad;
        if (fechaInicio) params.fecha_inicio = fechaInicio;
        if (fechaFin) params.fecha_fin = fechaFin;
        const data = await ticketApi.listar(params);
        setTickets(data.items);
        setTotal(data.total);
        setTotalPages(data.pages);
      } catch {
        setTickets([]);
        setTotal(0);
      } finally {
        setCargando(false);
      }
    })();
  }, [page, estado, prioridad, vista, fechaInicio, fechaFin]);

  const hayFiltrosFecha = fechaInicio || fechaFin;
  const limpiarFiltrosFecha = () => {
    setFechaInicio("");
    setFechaFin("");
    setPage(1);
  };

  useEffect(() => {
    setOnTicketUpdated((ev) => {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ev.ticket_id
            ? {
                ...t,
                estado: ev.estado as EstadoTicket,
                prioridad: ev.prioridad as PrioridadTicket,
                agente_id: ev.agente_id,
                fecha_actualizacion: ev.fecha_actualizacion,
              }
            : t
        )
      );
    });

    setOnTicketAssigned((ev) => {
      if (ev.agente_id !== usuario?.id) return;
      setTickets((prev) => {
        if (prev.some((t) => t.id === ev.ticket_id)) return prev;
        const nuevo: Ticket = {
          id: ev.ticket_id,
          empresa_id: ev.empresa_id,
          empresa_nombre: ev.empresa_nombre ?? null,
          titulo: ev.titulo,
          descripcion: "",
          categoria_id: 0,
          subcategoria_id: 0,
          elemento_afectado: "punto_venta",
          ip_pcs: null,
          ip_antena: null,
          mascara_red: null,
          puerta_enlace: null,
          nombre_punto: null,
          prioridad: ev.prioridad as PrioridadTicket,
          estado: ev.estado as EstadoTicket,
          cliente_id: ev.cliente_id ?? "",
          agente_id: ev.agente_id,
          modificado_por_id: null,
          modificado_por_nombre: null,
          fecha_creacion: ev.fecha_actualizacion,
          fecha_actualizacion: ev.fecha_actualizacion,
        };
        return [nuevo, ...prev];
      });
    });

    return () => {
      setOnTicketUpdated(null);
      setOnTicketAssigned(null);
    };
  }, [setOnTicketUpdated, setOnTicketAssigned, usuario?.id]);

  const cambiarVista = (nueva: VistaTicket) => {
    setVista(nueva);
    setEstado("todos");
    setPage(1);
  };

  const cambiarModo = (modo: VistaMode) => {
    setViewMode(modo);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VISTA_STORAGE_KEY, modo);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Tickets"
        subtitle={`Hola, ${usuario?.nombre?.split(" ")[0]}, gestiona tus tickets aquí`}
        actions={
          usuario?.rol !== 'agente' ? (
            <Link href="/tickets/nuevo">
              <Button
                className="text-nowrap text-xs sm:text-sm"
                variant="primary"
                disabled={cargando}
                icon={<NewTicketIcon />}
              >
                Nuevo ticket
              </Button>
            </Link>
          ) : undefined
        }
      />
      <div className="flex gap-4 flex-col-reverse justify-between">
        <div className="flex rounded-lg sm:gap-8 gap-2 justify-between items-end">
          <div className="flex w-fit border-b border-grayCustom/50 bg-grayCustom/10 gap-0 rounded-lg h-fit">
            {VISTAS.map((v) => (
            <button
              key={v.value}
              onClick={() => cambiarVista(v.value)}
              className={`px-4 py-1.5 text-xs transition-all duration-100 ease-in rounded-md font-normal last:border-none border-grayCustom ${
                vista === v.value
                  ? "bg-brandCustom text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v.label}
            </button>
          ))}
          </div>
          <div className="flex w-fit border-b border-brandCustom/50 bg-grayCustom/10 rounded-lg h-fit self-end gap-1">
            <button
              onClick={() => cambiarModo("cards")}
              title="Vista tarjetas"
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "cards"
                  ? "bg-brandCustom text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-layout-grid" viewBox="0 0 24 24"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>
            </button>
            <button
              onClick={() => cambiarModo("table")}
              title="Vista tabla"
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "table"
                  ? "bg-brandCustom text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-table" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          </div>
        </div>
        <div className="grid md:flex grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1">
          <Select
            label="Estado"
            value={estado}
            onChange={(e) => { setEstado(e.target.value); setPage(1); }}
            options={ESTADOS_POR_VISTA[vista]}
          />
          <Select
            label="Prioridad"
            value={prioridad}
            onChange={(e) => { setPrioridad(e.target.value); setPage(1); }}
            options={PRIORIDADES}
          />
          <div className="flex flex-col">
            <label className="sm:text-[11px] text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">
              Desde
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => { setFechaInicio(e.target.value); setPage(1); }}
              className="rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50 text-gray-700 px-2.5 py-2 text-xs focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer"
            />
          </div>
          <div className="flex flex-col">
            <label className="sm:text-[11px] text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">
              Hasta
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => { setFechaFin(e.target.value); setPage(1); }}
              className="rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50 text-gray-700 px-2.5 py-2 text-xs focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer"
            />
          </div>
          <TotalBadge total={total} />
          {hayFiltrosFecha && (
            <button
              onClick={limpiarFiltrosFecha}
              className="text-xs self-end text-gray-500 hover:text-gray-800 underline transition-colors mb-0.5"
            >
              Limpiar fechas
            </button>
          )}
        </div>
      </div>
      {cargando ? (
        <LoadingState />
      ) : tickets.length === 0 ? (
        <EmptyState message="No hay tickets para estos filtros." />
      ) : viewMode === "table" ? (
        <DataTable
          columns={[
            {
              key: "ticket_number",
              header: "# Ticket",
              cell: (t: Ticket) => (
                <Link
                href={`/tickets/${t.id}`}
                title={`Ver ticket: ${t.titulo}`}
                className="font-normal text-xs text-gray-500 hover:text-brandCustom transition-colors uppercase"
                >
                  #{t.id.split('-')[0].toUpperCase()}
                </Link>
              ),
            },
            {
              key: "titulo",
              header: "Titulo",
              cell: (t: Ticket) => (
                <Link
                href={`/tickets/${t.id}`}
                title={`Ver ticket: ${t.titulo}`}
                className="font-normal text-gray-800 hover:text-brandCustom transition-colors lowercase"
                >
                  {t.titulo.length > 20 ? `${t.titulo.substring(0, 20)}...` : t.titulo}
                </Link>
              ),
            },
            {
              key: "empresa_nombre",
              header: "Empresa",
              cell: (t: Ticket) => (
                <span className="text-gray-500 sm:text-xs text-[10px]">
                  {t.empresa_nombre}
                </span>
              ),
            },
            {
              key: "estado",
              header: "Estado",
              cell: (t: Ticket) => <EstadoBadge estado={t.estado} />,
            },
            {
              key: "prioridad",
              header: "Prioridad",
              cell: (t: Ticket) => <PrioridadBadge prioridad={t.prioridad} estado={t.estado} />,
            },
            {
              key: "creado",
              header: "Creado",
              cell: (t: Ticket) => (
                <span className="text-gray-400 sm:text-xs text-[10px]">
                  {new Date(t.fecha_creacion).toLocaleString(undefined, {
                    timeZone: "America/Bogota",
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ),
            },
          ]}
          data={tickets}
          keyExtractor={(t: Ticket) => t.id}
        />
      ) : (
        <div className="bg-cardCustom rounded-2xl min-h-[70vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:p-6 p-4">
            {tickets.map((t: Ticket, index: number) => (
              <TicketCard key={t.id} ticket={t} index={index} />
            ))}
          </div>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
