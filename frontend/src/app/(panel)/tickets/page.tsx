"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ticketApi, type Ticket, type EstadoTicket, type PrioridadTicket } from "@/lib/endpoints";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { useAuthStore } from "@/store/authStore";

const ESTADOS: ("todos" | EstadoTicket)[] = ["todos", "abierto", "asignado", "en_progreso", "resuelto", "cerrado"];
const PRIORIDADES: ("todas" | PrioridadTicket)[] = ["todas", "baja", "media", "alta", "urgente"];

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState<typeof ESTADOS[number]>("todos");
  const [prioridad, setPrioridad] = useState<typeof PRIORIDADES[number]>("todas");
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
          prioridad: ev.prioridad as PrioridadTicket,
          estado: ev.estado as EstadoTicket,
          cliente_id: ev.cliente_id ?? "",
          agente_id: ev.agente_id,
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Tickets</h1>
        <Link
          href="/tickets/nuevo"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + Nuevo ticket
        </Link>
      </div>

      <div className="flex gap-4 flex-wrap">
        <select
          value={estado}
          onChange={(e) => { setEstado(e.target.value as typeof ESTADOS[number]); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={prioridad}
          onChange={(e) => { setPrioridad(e.target.value as typeof PRIORIDADES[number]); setPage(1); }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="self-center text-sm text-slate-500">Total: {total}</span>
      </div>

      {cargando ? (
        <p className="py-8 text-center text-sm text-slate-400">Cargando...</p>
      ) : tickets.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No hay tickets para estos filtros.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">Titulo</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left">Prioridad</th>
                <th className="px-4 py-2 text-left">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="font-medium text-slate-800 hover:text-brand">
                      {t.titulo}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><EstadoBadge estado={t.estado} /></td>
                  <td className="px-4 py-3"><PrioridadBadge prioridad={t.prioridad} /></td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(t.fecha_creacion).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="self-center text-sm text-slate-600">Pagina {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={tickets.length < 20}
          className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    abierto: "bg-blue-100 text-blue-700",
    asignado: "bg-purple-100 text-purple-700",
    en_progreso: "bg-amber-100 text-amber-700",
    resuelto: "bg-green-100 text-green-700",
    cerrado: "bg-slate-200 text-slate-600",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[estado] ?? ""}`}>{estado}</span>;
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const styles: Record<string, string> = {
    baja: "bg-slate-100 text-slate-600",
    media: "bg-sky-100 text-sky-700",
    alta: "bg-orange-100 text-orange-700",
    urgente: "bg-red-100 text-red-700 font-bold",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[prioridad] ?? ""}`}>{prioridad}</span>;
}
