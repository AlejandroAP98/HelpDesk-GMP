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

export default function BandejaPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agentes, setAgentes] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [agenteSel, setAgenteSel] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const [tk, ags] = await Promise.all([
          ticketApi.listar({ estado: "abierto", size: 100 }),
          adminApi.listarUsuarios({ rol: "agente", size: 100 }),
        ]);
        setTickets(tk.items);
        setAgentes(ags.items);
      } catch {
        setError("No se pudo cargar la bandeja");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Bandeja de Tickets Abiertos</h1>
        <p className="text-sm text-gray-500 mt-1">Asigne tickets a sus agentes disponibles</p>
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
              key: "titulo",
              header: "Titulo",
              cell: (t: Ticket) => (
                <Link href={`/tickets/${t.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors">
                  {t.titulo}
                </Link>
              ),
            },
            {
              key: "empresa",
              header: "Empresa",
              cell: (t: Ticket) => <span className="text-gray-400 text-xs">#{t.empresa_id}</span>,
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
                <span className="text-gray-400 text-xs">{new Date(t.fecha_creacion).toLocaleDateString()}</span>
              ),
            },
            {
              key: "asignar_select",
              header: "Asignar a",
              cell: (t: Ticket) => (
                <select
                  value={agenteSel[t.id] ?? ""}
                  onChange={(e) => setAgenteSel((p) => ({ ...p, [t.id]: e.target.value }))}
                  className="rounded-xl border border-gray-200 bg-white text-gray-700 px-3 py-2 text-xs font-medium focus:border-brand-500 focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer"
                >
                  <option value="">Seleccione agente...</option>
                  {agentes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} {a.empresa_id ? `(emp ${a.empresa_id})` : "(interno)"}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              key: "asignar_btn",
              header: "",
              cell: (t: Ticket) => (
                <div className="flex items-center justify-end">
                  <Button
                    variant="primary"
                    onClick={() => asignar(t.id)}
                    disabled={!agenteSel[t.id] || asignandoId === t.id}
                    loading={asignandoId === t.id}
                    className="py-2 text-xs w-fit"
                    icon={<AssingUserIcon className="w-4 h-4" />}
                  >
                    Asignar
                  </Button >
                </div>
              ),
            },
          ]}
          data={tickets}
          keyExtractor={(t: Ticket) => t.id}
          minWidth="min-w-[700px]"
        />
      )}
    </div>
  );
}
