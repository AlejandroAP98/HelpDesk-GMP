"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ticketApi, type Ticket, type EstadoTicket, type PrioridadTicket } from "@/lib/endpoints";
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
  { value: "todos", label: "Estado: todos" },
  { value: "abierto", label: "Estado: abierto" },
  { value: "asignado", label: "Estado: asignado" },
  { value: "en_progreso", label: "Estado: en progreso" },
  { value: "resuelto", label: "Estado: resuelto" },
  { value: "cerrado", label: "Estado: cerrado" },
];

const PRIORIDADES: { value: string; label: string }[] = [
  { value: "todas", label: "Prioridad: todas" },
  { value: "baja", label: "Prioridad: baja" },
  { value: "media", label: "Prioridad: media" },
  { value: "alta", label: "Prioridad: alta" },
  { value: "urgente", label: "Prioridad: urgente" },
];

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState("todos");
  const [prioridad, setPrioridad] = useState("todas");
  const [cargando, setCargando] = useState(true);

  const setOnTicketCreated = useWsTicketStore((s) => s.setOnTicketCreated);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const usuario = useAuthStore((s) => s.usuario);
  const empresaId = usuario?.empresa_id;

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const params: Record<string, unknown> = { page, size: 20 };
        if (estado !== "todos") params.estado = estado;
        if (prioridad !== "todas") params.prioridad = prioridad;
        const data = await ticketApi.listar(params);
        setTickets(data.items);
        setTotal(data.total);
      } catch {
        setTickets([]);
        setTotal(0);
      } finally {
        setCargando(false);
      }
    })();
  }, [page, estado, prioridad]);

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
      setTotal((t) => t + 1);
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

    return () => {
      setOnTicketCreated(null);
      setOnTicketUpdated(null);
    };
  }, [setOnTicketCreated, setOnTicketUpdated, usuario?.rol, empresaId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tickets</h1>
        <Link href="/tickets/nuevo">
          <Button
            className="py-2 text-sm w-fit"
            variant="primary"
            disabled={cargando}
            icon={<NewTicketIcon />}
          >
            Nuevo ticket
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <Select
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setPage(1); }}
          options={ESTADOS}
        />
        <Select
          value={prioridad}
          onChange={(e) => { setPrioridad(e.target.value); setPage(1); }}
          options={PRIORIDADES}
        />
        <TotalBadge total={total} />
      </div>

      {cargando ? (
        <LoadingState />
      ) : tickets.length === 0 ? (
        <EmptyState message="No hay tickets para estos filtros." />
      ) : (
        <DataTable
          columns={[
            {
              key: "id",
              header: "ID Ticket",
              cell: (t: Ticket) => (
                <Link href={`/tickets/${t.id}`} className="font-regular text-sm hover:text-brand-600 transition-all text-gray-500  ">
                  {t.id}
                </Link>
              ),
            },
            {
              key: "titulo",
              header: "Titulo",
              cell: (t: Ticket) => (
                <Link href={`/tickets/${t.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors">
                  {t.titulo}
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
                <span className="text-gray-400 text-xs">{new Date(t.fecha_creacion).toLocaleDateString(undefined, { timeZone: "America/Bogota" })}</span>
              ),
            },
          ]}
          data={tickets}
          keyExtractor={(t: Ticket) => t.id}
        />
      )}

      <Pagination
        page={page}
        hasMore={tickets.length >= 20}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
