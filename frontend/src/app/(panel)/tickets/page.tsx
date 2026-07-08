"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ticketApi, type Ticket, type EstadoTicket, type PrioridadTicket } from "@/lib/endpoints";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { useAuthStore } from "@/store/authStore";

const ESTADOS: ("todos" | EstadoTicket)[] = ["todos", "abierto", "asignado", "en_progreso", "resuelto", "cerrado"];
const PRIORIDADES: ("todas" | PrioridadTicket)[] = ["todas", "baja", "media", "alta", "urgente"];

const estadoStyles: Record<string, string> = {
  abierto: "bg-blue-50 text-blue-700 border-blue-100",
  asignado: "bg-purple-50 text-purple-700 border-purple-100",
  en_progreso: "bg-amber-50 text-amber-700 border-amber-100",
  resuelto: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cerrado: "bg-gray-100 text-gray-500 border-gray-200",
};

const prioridadStyles: Record<string, string> = {
  baja: "bg-gray-100 text-gray-500 border-gray-200",
  media: "bg-sky-50 text-sky-700 border-sky-100",
  alta: "bg-orange-50 text-orange-700 border-orange-100",
  urgente: "bg-red-50 text-red-600 border-red-100 font-bold",
};

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase border ${estadoStyles[estado] ?? ""}`}>
      {estado.replace("_", " ")}
    </span>
  );
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase border ${prioridadStyles[prioridad] ?? ""}`}>
      {prioridad === "urgente" && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />
      )}
      {prioridad}
    </span>
  );
}

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tickets</h1>
        <Link
          href="/tickets/nuevo"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 shadow-brand active:scale-[0.98] transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo ticket
        </Link>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={estado}
          onChange={(e) => { setEstado(e.target.value as typeof ESTADOS[number]); setPage(1); }}
          className="rounded-xl border border-gray-200 bg-white text-gray-700 px-4 py-2.5 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all cursor-pointer"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>Estado: {e.replace("_", " ")}</option>
          ))}
        </select>
        <select
          value={prioridad}
          onChange={(e) => { setPrioridad(e.target.value as typeof PRIORIDADES[number]); setPage(1); }}
          className="rounded-xl border border-gray-200 bg-white text-gray-700 px-4 py-2.5 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all cursor-pointer"
        >
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>Prioridad: {p}</option>
          ))}
        </select>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 border border-gray-200 px-3.5 py-1.5 rounded-lg">
          {total} ticket{total !== 1 ? "s" : ""}
        </span>
      </div>

      {cargando ? (
        <p className="py-12 text-center text-sm text-gray-400">Cargando...</p>
      ) : tickets.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-card">
          No hay tickets para estos filtros.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Titulo</th>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Estado</th>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Prioridad</th>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <Link href={`/tickets/${t.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors">
                      {t.titulo}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5"><EstadoBadge estado={t.estado} /></td>
                  <td className="px-5 py-3.5"><PrioridadBadge prioridad={t.prioridad} /></td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {new Date(t.fecha_creacion).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-30 disabled:hover:bg-white transition-all"
        >
          Anterior
        </button>
        <span className="text-sm font-medium text-gray-400 px-2">Pagina {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={tickets.length < 20}
          className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-30 disabled:hover:bg-white transition-all"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
