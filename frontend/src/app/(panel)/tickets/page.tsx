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
  const [cargando, setCargando] = useState(true);
  const [viewMode, setViewMode] = useState<VistaMode>(getInitialVistaMode);

  const setOnTicketCreated = useWsTicketStore((s) => s.setOnTicketCreated);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const setOnTicketAssigned = useWsTicketStore((s) => s.setOnTicketAssigned);
  const usuario = useAuthStore((s) => s.usuario);
  const empresaId = usuario?.empresa_id;

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const params: Record<string, unknown> = { page, size: 15 };
        if (vista !== "todos") params.vista = vista;
        if (estado !== "todos") params.estado = estado;
        if (prioridad !== "todas") params.prioridad = prioridad;
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
  }, [page, estado, prioridad, vista]);

  useEffect(() => {
    setOnTicketCreated((ev) => {
      if (usuario?.rol === "cliente" && empresaId != null && ev.empresa_id !== empresaId) return;
      setTickets((prev) => {
        const existe = prev.some((t) => t.id === ev.ticket_id);
        if (existe) return prev;
        const nuevo: Ticket = {
          id: ev.ticket_id,
          empresa_id: ev.empresa_id,
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
      setTotalPages((t) => t + 1);
    });

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
      if (usuario?.rol === "cliente" && empresaId != null && ev.empresa_id !== empresaId) return;
      setTickets((prev) => {
        const existe = prev.some((t) => t.id === ev.ticket_id);
        if (existe) {
          return prev.map((t) =>
            t.id === ev.ticket_id
              ? {
                  ...t,
                  estado: ev.estado as EstadoTicket,
                  prioridad: ev.prioridad as PrioridadTicket,
                  agente_id: ev.agente_id,
                  fecha_actualizacion: ev.fecha_actualizacion,
                }
              : t
          );
        }
        const nuevo: Ticket = {
          id: ev.ticket_id,
          empresa_id: ev.empresa_id,
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
      setOnTicketCreated(null);
      setOnTicketUpdated(null);
      setOnTicketAssigned(null);
    };
  }, [setOnTicketCreated, setOnTicketUpdated, setOnTicketAssigned, usuario?.rol, empresaId]);

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
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-gray-500 flex flex-col gap-2">
          <h1 className="sm:text-2xl text-xl font-bold tracking-tight text-gray-900">Tickets</h1>
          <h2 className="sm:text-sm text-xs  text-gray-500">Hola, {usuario?.nombre?.split(" ")[0]}, gestiona tus tickets aquí </h2>
        </div>
        <Link href="/tickets/nuevo">
          <Button
            className="sm:py-2 py-1 text-xs sm:text-sm w-fit text-nowrap"
            variant="primary"
            disabled={cargando}
            icon={<NewTicketIcon />}
          >
            Nuevo ticket
          </Button>
        </Link>
      </div>
      <div className="flex gap-4 sm:flex-row flex-col-reverse justify-between">
        <div className="flex rounded-lg sm:gap-8 gap-2 justify-between items-end">
          <div className="flex w-fit border-b border-grayCustom/50 bg-grayCustom/10 gap-1 rounded-lg h-fit">
            {VISTAS.map((v) => (
            <button
              key={v.value}
              onClick={() => cambiarVista(v.value)}
              className={`px-4 py-1.5 sm:text-sm text-xs font-medium rounded-md transition-all last:border-none border-grayCustom ${
                vista === v.value
                  ? "bg-brandCustom text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v.label}
            </button>
          ))}
          </div>
          <TotalBadge total={total} />
        </div>
        <div className="flex gap-4 justify-end w-full">
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
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          </div>
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
                className="font-medium text-xs text-gray-500 hover:text-brandCustom transition-colors uppercase"
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
                className="font-medium text-gray-800 hover:text-brandCustom transition-colors lowercase"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 sm:gap-4 gap-3 sm:p-6 p-4">
            {tickets.map((t: Ticket, index: number) => (
              <div
                key={t.id}
                className={`group relative bg-white border border-brandCustom/60
                  rounded-xl shadow-sm hover:shadow-md hover:border-brandCustom/40 transition-all flex flex-col justify-between gap-2 cursor-pointer
                  animate-fadeIn opacity-0`}
                style={{
                  animationDelay: `${index * 40}ms`,
                  animationFillMode: "forwards",
                }}
              >
                <div className="flex items-center justify-between gap-2 bg-brandCustom p-2 rounded-t-xl">
                  <span className="text-white uppercase transition-colors line-clamp-2 text-[10px] px-2 py-1 rounded-full w-fit h-fit">
                    {t.empresa_nombre}
                  </span>
                  <span className="text-white uppercase transition-colors line-clamp-2 text-[10px] px-2 py-1 rounded-full w-fit h-fit">
                    {t.elemento_afectado.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 px-4 pt-2">
                  <Link
                    href={`/tickets/${t.id}`}
                    title={`Ver ticket: ${t.titulo}`}
                    className="font-medium text-gray-800 group-hover:text-gray-500 transition-colors line-clamp-2 text-sm sm:text-base after:absolute after:inset-0"
                  >
                    {t.titulo}
                  </Link>
                  <span className="text-gray-500 uppercase transition-colors line-clamp-2 text-[9px]">#{t.id.split("-")[0]}</span>
                </div>
                <div className="flex flex-col text-start h-full w-full">
                  <span className="px-4 text-gray-500 transition-colors line-clamp-2 text-xs">
                    {t.descripcion}
                  </span>
                </div>
                <div className="bg-grayCustom/5 px-2 py-2 border-t border-grayCustom/10 rounded-b-xl flex items-center justify-between gap-2 text-gray-400 sm:text-xs text-[10px]">
                  <div className="flex items-center gap-2">
                    <EstadoBadge estado={t.estado}/>
                    <PrioridadBadge prioridad={t.prioridad} estado={t.estado}/>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px]">
                      {new Date(t.fecha_creacion).toLocaleString(undefined, {
                        timeZone: "America/Bogota",
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
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
