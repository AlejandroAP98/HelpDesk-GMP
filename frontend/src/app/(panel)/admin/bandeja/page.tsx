"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, ticketApi, type Ticket, type PrioridadTicket, type EstadoTicket } from "@/lib/endpoints";
import type { Usuario } from "@/store/authStore";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { PrioridadBadge } from "@/components/Badges";
import { DataTable } from "@/components/ui/Table";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import AssingUserIcon from "@/app/assets/icons/AssignUserIcon";
import TicketIcon from "@/app/assets/icons/TicketIcon";
import { Pagination } from "@/components/ui/Pagination";

export default function BandejaPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agentes, setAgentes] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [agenteSel, setAgenteSel] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const [tk, ags] = await Promise.all([
          ticketApi.listar({ estado: "abierto", page, size: 15 }),
          adminApi.listarUsuarios({ rol: "agente", size: 10 }),
        ]);
        setTickets(tk.items);
        setAgentes(ags.items);
        setTotalPages(tk.pages);
      } catch {
        setError("No se pudo cargar la bandeja");
      } finally {
        setCargando(false);
      }
    })();
  }, [page]);

  const setOnTicketCreated = useWsTicketStore((s) => s.setOnTicketCreated);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);

  useEffect(() => {
    setOnTicketCreated((ev) => {
      if (ev.estado !== "abierto") return;
      setTickets((prev) => {
        if (prev.some((t) => t.id === ev.ticket_id)) return prev;
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

    setOnTicketUpdated((ev) => {
      setTickets((prev) => {
        const idx = prev.findIndex((t) => t.id === ev.ticket_id);
        if (idx === -1) {
          if (ev.estado === "abierto") {
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
              fecha_creacion: "",
              fecha_actualizacion: ev.fecha_actualizacion,
            };
            return [nuevo, ...prev];
          }
          return prev;
        }
        if (ev.estado !== "abierto") {
          return prev.filter((t) => t.id !== ev.ticket_id);
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          estado: ev.estado as EstadoTicket,
          prioridad: ev.prioridad as PrioridadTicket,
          agente_id: ev.agente_id,
          fecha_actualizacion: ev.fecha_actualizacion,
        };
        return updated;
      });
    });

    return () => {
      setOnTicketCreated(null);
      setOnTicketUpdated(null);
    };
  }, [setOnTicketCreated, setOnTicketUpdated]);

  const asignar = async (ticketId: string) => {
    const agenteId = agenteSel[ticketId];
    if (!agenteId) return;
    setAsignandoId(ticketId);
    setError(null);
    try {
      await ticketApi.asignar(ticketId, agenteId);
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch {
      setError("No se pudo asignar el ticket");
    } finally {
      setAsignandoId(null);
    }
  };

  const asignarme = async (ticketId: string) => {
    setAsignandoId(ticketId);
    setError(null);
    try {
      await ticketApi.asignarme(ticketId);
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch {
      setError("No se pudo autoasignar el ticket");
    } finally {
      setAsignandoId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="sm:text-2xl text-lg font-bold tracking-tight text-gray-900">Bandeja de Tickets Abiertos</h1>
        <p className="sm:text-sm text-xs text-gray-500 mt-1">Asigna tickets a los agentes disponibles</p>
      </div>

      {error && <ErrorMessage message={error} />}

      {cargando ? (
        <LoadingState />
      ) : tickets.length === 0 ? (
        <EmptyState message="No hay tickets abiertos por asignar." />
      ) : (
        <DataTable
          rowClassName={(t: Ticket) => t.prioridad === "urgente" ? "bg-red-50/30" : ""}
          columns={[
            {
              key: "ticket_number",
              header: "# Ticket",
              cell: (t: Ticket) => (
                <Link href={`/tickets/${t.id}`} title={`Ver ticket: ${t.titulo}`} className="font-medium text-xs text-gray-500 hover:text-brandCustom transition-colors uppercase">
                  #{t.id.split('-')[0].toUpperCase()}
                </Link>
              ),
            },
            {
              key: "titulo",
              header: "Titulo",
              cell: (t: Ticket) => (
                <Link href={`/tickets/${t.id}`} title={`Ver ticket: ${t.titulo}`} className="font-medium text-sm text-gray-900 hover:text-brandCustom transition-colors cursor-pointer">
                  {t.titulo.substring(0, 20) + "..."}
                </Link>
              ),
            },
            {
              key: "empresa",
              header: "Empresa",
              cell: (t: Ticket) => <span className="text-gray-400 text-xs">{t.empresa_nombre ?? `#${t.empresa_id}`}</span>,
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
                <span className="text-gray-400 sm:text-xs text-[10px]">{new Date(t.fecha_creacion).toLocaleString(undefined, { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              ),
            },
            {
              key: "asignar_select",
              header: "Asignar",
              cell: (t: Ticket) => (
                <Select
                  value={agenteSel[t.id] ?? ""}
                  onChange={(e) => setAgenteSel((p) => ({ ...p, [t.id]: e.target.value }))}
                  options={agentes.map((a) => ({ value: a.id, label: a.nombre }))}
                  className="w-full max-w-sm px-1 py-1.5 sm:text-xs text-[10px] border border-gray-300 rounded-lg"
                  placeholder="Seleccione agente..."
                />
              ),
            },
            {
              key: "asignar_btn",
              header: "Acción",
              cell: (t: Ticket) => (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={() => asignar(t.id)}
                    disabled={!agenteSel[t.id] || asignandoId === t.id}
                    loading={asignandoId === t.id}
                    className="py-2 text-xs w-fit"
                    icon={<AssingUserIcon className="w-4 h-4" />}
                  >
                    Asignar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => asignarme(t.id)}
                    disabled={Boolean(agenteSel[t.id]) || asignandoId === t.id}
                    loading={asignandoId === t.id}
                    className="py-2 text-xs w-fit !bg-violetCustom !text-white hover:!bg-violetCustom/80"
                    title="Asignarme este ticket a mi mismo"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-user-star" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h.5m7.3 5.817-2.172 1.138a.392.392 0 0 1-.568-.41l.415-2.411-1.757-1.707a.389.389 0 0 1 .217-.665l2.428-.352 1.086-2.193a.392.392 0 0 1 .702 0l1.086 2.193 2.428.352a.39.39 0 0 1 .217.665l-1.757 1.707.414 2.41a.39.39 0 0 1-.567.411z"/></svg>}
                  >
                    Asignarme
                  </Button>
                </div>
              ),
            },
          ]}
          data={tickets}
          keyExtractor={(t: Ticket) => t.id}
          minWidth="min-w-[700px]"
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
