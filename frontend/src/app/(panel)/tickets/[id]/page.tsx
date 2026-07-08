"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useWsTicketStore } from "@/store/wsTicketStore";
import {
  adjuntoApi,
  comentarioApi,
  ticketApi,
  type Adjunto,
  type Comentario,
  type EstadoTicket,
  type PrioridadTicket,
  type Ticket,
} from "@/lib/endpoints";

const PRIORIDADES: PrioridadTicket[] = ["baja", "media", "alta", "urgente"];

const prioridadLabels: Record<string, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

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

export default function TicketDetallePage() {
  const params = useParams();
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const ticketId = String(params.id);

  const subscribeTicket = useWsTicketStore((s) => s.subscribeTicket);
  const unsubscribeTicket = useWsTicketStore((s) => s.unsubscribeTicket);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const setOnTicketCommented = useWsTicketStore((s) => s.setOnTicketCommented);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [esNotaInterna, setEsNotaInterna] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [t, cs, as] = await Promise.all([
        ticketApi.obtener(ticketId),
        comentarioApi.listar(ticketId),
        adjuntoApi.listar(ticketId),
      ]);
      setTicket(t);
      setComentarios(cs);
      setAdjuntos(as);
    } catch {
      setError("No se pudo cargar el ticket");
    } finally {
      setCargando(false);
    }
  }, [ticketId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    subscribeTicket(ticketId);

    setOnTicketUpdated((ev) => {
      if (ev.ticket_id === ticketId) {
        setTicket((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            estado: ev.estado as EstadoTicket,
            prioridad: ev.prioridad as PrioridadTicket,
            agente_id: ev.agente_id,
            fecha_actualizacion: ev.fecha_actualizacion,
          };
        });
      }
    });

    setOnTicketCommented((ev) => {
      if (ev.ticket_id !== ticketId) return;
      if (ev.es_nota_interna && usuario?.rol === "cliente") return;
      setComentarios((prev) => {
        const existe = prev.some((c) => c.id === ev.comentario_id);
        if (existe) return prev;
        return [
          ...prev,
          {
            id: ev.comentario_id,
            ticket_id: ev.ticket_id,
            usuario_id: ev.usuario_id,
            usuario_nombre: ev.usuario_nombre,
            contenido: ev.contenido,
            es_nota_interna: ev.es_nota_interna,
            fecha_creacion: ev.fecha_creacion,
          },
        ];
      });
    });

    return () => {
      unsubscribeTicket(ticketId);
      setOnTicketUpdated(null);
      setOnTicketCommented(null);
    };
  }, [ticketId, usuario?.rol, subscribeTicket, unsubscribeTicket, setOnTicketUpdated, setOnTicketCommented]);

  const enviarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoComentario.trim()) return;
    try {
      await comentarioApi.crear(ticketId, {
        contenido: nuevoComentario,
        es_nota_interna: esNotaInterna,
      });
      setNuevoComentario("");
      setEsNotaInterna(false);
      await cargar();
    } catch {
      setError("No se pudo agregar el comentario");
    }
  };

  const subirAdjunto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    try {
      for (const f of Array.from(e.target.files)) {
        await adjuntoApi.subir(ticketId, f);
      }
      e.target.value = "";
      await cargar();
    } catch {
      setError("No se pudo subir el adjunto");
    }
  };

  const cambiarEstado = async (estado: EstadoTicket) => {
    try {
      await ticketApi.cambiarEstado(ticketId, estado);
      await cargar();
    } catch {
      setError("Transicion invalida");
    }
  };

  const cerrar = async () => {
    try {
      await ticketApi.cerrar(ticketId);
      await cargar();
    } catch {
      setError("No se pudo cerrar el ticket");
    }
  };

  const reabrir = async () => {
    try {
      await ticketApi.reabrir(ticketId);
      await cargar();
    } catch {
      setError("No se pudo reabrir el ticket");
    }
  };

  const setPrioridad = async (p: PrioridadTicket) => {
    try {
      await ticketApi.cambiarPrioridad(ticketId, p);
      await cargar();
    } catch {
      setError("No se pudo cambiar prioridad");
    }
  };

  if (cargando) return <p className="text-center text-gray-400 py-12">Cargando...</p>;
  if (error && !ticket) return (
    <div className="rounded-2xl bg-red-50 border border-red-100 px-6 py-4 flex items-center gap-3">
      <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="font-semibold text-red-600">{error}</p>
    </div>
  );
  if (!ticket) return null;

  const esCliente = usuario?.rol === "cliente";
  const esAgente = usuario?.rol === "agente";
  const esAdmin = usuario?.rol === "administrador";
  const esAgenteAsignado = ticket?.agente_id === usuario?.id;
  const puedeProgresar = (esAgente && esAgenteAsignado) || esAdmin;
  const puedeResolver = (esAgente && esAgenteAsignado) || esAdmin;
  const puedeCerrar =
    (esCliente && ticket.cliente_id === usuario?.id) || (esAgente && esAgenteAsignado) || esAdmin;
  const puedeReabrir = esAdmin;
  const estaCerrado = ticket.estado === "cerrado";

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Volver
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 break-words">{ticket.titulo}</h1>
            <p className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{ticket.descripcion}</p>
          </div>
          <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
            <EstadoBadge estado={ticket.estado} />
            <PrioridadBadge prioridad={ticket.prioridad} />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Detalles</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
              <dt className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Empresa</dt>
              <dd className="font-semibold text-gray-700 text-sm">#{ticket.empresa_id}</dd>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
              <dt className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Categoria</dt>
              <dd className="font-semibold text-gray-700 text-sm">#{ticket.categoria_id}</dd>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
              <dt className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Creado</dt>
              <dd className="font-semibold text-gray-700 text-sm">{new Date(ticket.fecha_creacion).toLocaleString()}</dd>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
              <dt className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Actualizado</dt>
              <dd className="font-semibold text-gray-700 text-sm">{new Date(ticket.fecha_actualizacion).toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        {!estaCerrado && (
          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-2.5">
            {puedeProgresar && ticket.estado === "asignado" && (
              <button
                onClick={() => cambiarEstado("en_progreso")}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-semibold text-white active:scale-[0.98] transition-all"
              >
                Iniciar trabajo
              </button>
            )}
            {puedeResolver && ticket.estado === "en_progreso" && (
              <button
                onClick={() => cambiarEstado("resuelto")}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white active:scale-[0.98] transition-all"
              >
                Marcar resuelto
              </button>
            )}
            {puedeCerrar && ticket.estado === "resuelto" && (
              <button
                onClick={cerrar}
                className="rounded-xl bg-gray-800 hover:bg-gray-900 px-4 py-2 text-xs font-semibold text-white active:scale-[0.98] transition-all"
              >
                Cerrar ticket
              </button>
            )}
            {puedeReabrir && !estaCerrado && (
              <button
                onClick={reabrir}
                className="rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2 text-xs font-semibold text-white active:scale-[0.98] transition-all"
              >
                Reabrir
              </button>
            )}
            {!esCliente && (
              <select
                value={ticket.prioridad}
                onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
                className="rounded-xl border border-gray-200 bg-white text-gray-700 px-3 py-2 text-xs font-medium focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none transition-all cursor-pointer ml-auto"
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>{prioridadLabels[p]}</option>
                ))}
              </select>
            )}
          </div>
        )}
        {estaCerrado && puedeReabrir && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={reabrir}
              className="rounded-xl bg-brand-600 hover:bg-brand-700 px-4 py-2 text-xs font-semibold text-white active:scale-[0.98] transition-all"
            >
              Reabrir ticket
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">Comentarios ({comentarios.length})</h2>

          <div className="space-y-2.5">
            {comentarios.map((c) => (
              <div
                key={c.id}
                className={`rounded-2xl border p-4 transition-all ${
                  c.es_nota_interna
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-gray-100 bg-white shadow-card"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-gray-700">{c.usuario_nombre ?? "Usuario"}</span>
                    {c.es_nota_interna && (
                      <span className="bg-amber-100 text-amber-700 border border-amber-200 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                        Nota interna
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400">{new Date(c.fecha_creacion).toLocaleString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-gray-600 leading-relaxed">{c.contenido}</p>
              </div>
            ))}
          </div>

          {!estaCerrado && (
            <form onSubmit={enviarComentario} className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 space-y-3">
              <textarea
                rows={3}
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                placeholder="Escribir comentario..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 focus:bg-white outline-none transition-all resize-none"
              />
              <div className="flex items-center justify-between">
                {!esCliente && (
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={esNotaInterna}
                      onChange={(e) => setEsNotaInterna(e.target.checked)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    Nota interna (solo agentes/admins)
                  </label>
                )}
                <button
                  type="submit"
                  className="ml-auto rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 shadow-brand active:scale-[0.98] transition-all"
                >
                  Comentar
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">Adjuntos ({adjuntos.length})</h2>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 space-y-4">
            {!estaCerrado && (
              <label className="block w-full">
                <input
                  type="file"
                  multiple
                  onChange={subirAdjunto}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 transition-all cursor-pointer"
                />
              </label>
            )}

            {adjuntos.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 text-center">No hay archivos adjuntos.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                {adjuntos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3.5 py-3 text-xs hover:bg-gray-50/50 transition-colors">
                    <span className="truncate text-gray-700 font-medium max-w-[150px]" title={a.nombre_archivo}>
                      {a.nombre_archivo}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {a.tamano_bytes != null ? (a.tamano_bytes / 1024).toFixed(1) + " KB" : "0 KB"}
                    </span>
                    <button
                      onClick={async () => { await adjuntoApi.eliminar(ticketId, a.id); await cargar(); }}
                      className="text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors ml-2"
                    >
                      Borrar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
