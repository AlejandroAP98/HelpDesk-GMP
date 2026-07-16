"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ticketApi, type Ticket, type EstadoTicket, type PrioridadTicket, type VistaTicket } from "@/lib/endpoints";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { useAuthStore } from "@/store/authStore";
import { EstadoBadge, PrioridadBadge, TotalBadge } from "@/components/Badges";
import { DataTable } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
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

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState("todos");
  const [prioridad, setPrioridad] = useState("todas");
  const [vista, setVista] = useState<VistaTicket>("activos");
  const [cargando, setCargando] = useState(true);

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

  return (
    <div className="space-y-5">
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
          <div className="flex w-fit border-b border-grayCustom/50 bg-grayCustom/10  rounded-lg h-fit">
            {VISTAS.map((v) => (
            <button
              key={v.value}
              onClick={() => cambiarVista(v.value)}
              className={`px-4 py-1.5 sm:text-sm text-xs font-medium rounded-md transition-all ${
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
        </div>
      </div>
      {cargando ? (
        <LoadingState />
      ) : tickets.length === 0 ? (
        <EmptyState message="No hay tickets para estos filtros." />
      ) : (
        <DataTable
          columns={[
            {
              key: "titulo",
              header: "Titulo",
              cell: (t: Ticket) => (
                <Link href={`/tickets/${t.id}`} title={`Ver ticket: ${t.titulo}`} className="font-medium text-gray-800 hover:text-brandCustom transition-colors lowercase">
                  {t.titulo.substring(0, 20) + "..."}
                </Link>
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
              cell: (t: Ticket) => <PrioridadBadge prioridad={t.prioridad} />,
            },
            {
              key: "creado",
              header: "Creado",
              cell: (t: Ticket) => (
                <span className="text-gray-400 sm:text-xs text-[10px]">{new Date(t.fecha_creacion).toLocaleString(undefined, { timeZone: "America/Bogota",  day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              ),
            },
          ]}
          data={tickets}
          keyExtractor={(t: Ticket) => t.id}
        />
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
