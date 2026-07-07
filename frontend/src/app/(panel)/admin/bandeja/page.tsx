"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, ticketApi, type Ticket } from "@/lib/endpoints";
import type { Usuario } from "@/store/authStore";

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Bandeja de tickets abiertos</h1>
        <p className="text-sm text-slate-500">Asigne tickets a sus agentes disponibles</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {cargando ? (
        <p className="text-center text-slate-400 py-8">Cargando...</p>
      ) : tickets.length === 0 ? (
        <p className="text-center text-slate-500 py-8 bg-white rounded-lg border border-slate-200">
          No hay tickets abiertos por asignar.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">Titulo</th>
                <th className="px-4 py-2 text-left">Empresa</th>
                <th className="px-4 py-2 text-left">Prioridad</th>
                <th className="px-4 py-2 text-left">Creado</th>
                <th className="px-4 py-2 text-left">Asignar a</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id} className={t.prioridad === "urgente" ? "bg-red-50" : ""}>
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="font-medium text-slate-800 hover:text-brand">
                      {t.titulo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">#{t.empresa_id}</td>
                  <td className="px-4 py-3"><PrioridadBadge prioridad={t.prioridad} /></td>
                  <td className="px-4 py-3 text-slate-500">{new Date(t.fecha_creacion).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={agenteSel[t.id] ?? ""}
                      onChange={(e) => setAgenteSel((p) => ({ ...p, [t.id]: e.target.value }))}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="">Seleccione agente...</option>
                      {agentes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre} {a.empresa_id ? `(emp ${a.empresa_id})` : "(interno)"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => asignar(t.id)}
                      disabled={!agenteSel[t.id] || asignandoId === t.id}
                      className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
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

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const styles: Record<string, string> = {
    baja: "bg-slate-100 text-slate-600",
    media: "bg-sky-100 text-sky-700",
    alta: "bg-orange-100 text-orange-700",
    urgente: "bg-red-100 text-red-700 font-bold",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[prioridad] ?? ""}`}>{prioridad}</span>;
}