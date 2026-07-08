"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, ticketApi, type Ticket } from "@/lib/endpoints";
import type { Usuario } from "@/store/authStore";

const prioridadStyles: Record<string, string> = {
  baja: "bg-gray-100 text-gray-500 border-gray-200",
  media: "bg-sky-50 text-sky-700 border-sky-100",
  alta: "bg-orange-50 text-orange-700 border-orange-100",
  urgente: "bg-red-50 text-red-600 border-red-100 font-bold",
};

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

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {cargando ? (
        <p className="text-center text-gray-400 py-12">Cargando...</p>
      ) : tickets.length === 0 ? (
        <p className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-gray-100 shadow-card">
          No hay tickets abiertos por asignar.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Titulo</th>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Empresa</th>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Prioridad</th>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Creado</th>
                <th className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase">Asignar a</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tickets.map((t) => (
                <tr key={t.id} className={t.prioridad === "urgente" ? "bg-red-50/30 hover:bg-red-50/50 transition-colors" : "hover:bg-gray-50/50 transition-colors"}>
                  <td className="px-5 py-3.5">
                    <Link href={`/tickets/${t.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors">
                      {t.titulo}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">#{t.empresa_id}</td>
                  <td className="px-5 py-3.5"><PrioridadBadge prioridad={t.prioridad} /></td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(t.fecha_creacion).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    <select
                      value={agenteSel[t.id] ?? ""}
                      onChange={(e) => setAgenteSel((p) => ({ ...p, [t.id]: e.target.value }))}
                      className="rounded-xl border border-gray-200 bg-white text-gray-700 px-3 py-2 text-xs font-medium focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Seleccione agente...</option>
                      {agentes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} {a.empresa_id ? `(emp ${a.empresa_id})` : "(interno)"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => asignar(t.id)}
                      disabled={!agenteSel[t.id] || asignandoId === t.id}
                      className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40 shadow-brand active:scale-[0.98] transition-all"
                    >
                      {asignandoId === t.id ? "Asignando..." : "Asignar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
