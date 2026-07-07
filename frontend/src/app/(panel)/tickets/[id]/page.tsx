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

  if (cargando) return <p className="text-center text-slate-400 py-8">Cargando...</p>;
  if (error && !ticket) return <p className="text-center text-red-600 py-8">{error}</p>;
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
      <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-brand">
        volver
      </button>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{ticket.titulo}</h1>
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{ticket.descripcion}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <EstadoBadge estado={ticket.estado} />
            <PrioridadBadge prioridad={ticket.prioridad} />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-slate-500 inline">Empresa:</dt> <dd className="inline ml-1 font-medium">#{ticket.empresa_id}</dd></div>
          <div><dt className="text-slate-500 inline">Categoria:</dt> <dd className="inline ml-1 font-medium">#{ticket.categoria_id}</dd></div>
          <div><dt className="text-slate-500 inline">Creado:</dt> <dd className="inline ml-1">{new Date(ticket.fecha_creacion).toLocaleString()}</dd></div>
          <div><dt className="text-slate-500 inline">Actualizado:</dt> <dd className="inline ml-1">{new Date(ticket.fecha_actualizacion).toLocaleString()}</dd></div>
        </dl>

        {!estaCerrado && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            {puedeProgresar && ticket.estado === "asignado" && (
              <button onClick={() => cambiarEstado("en_progreso")} className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600">
                Iniciar trabajo
              </button>
            )}
            {puedeResolver && ticket.estado === "en_progreso" && (
              <button onClick={() => cambiarEstado("resuelto")} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700">
                Marcar resuelto
              </button>
            )}
            {puedeCerrar && ticket.estado === "resuelto" && (
              <button onClick={cerrar} className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                Cerrar ticket
              </button>
            )}
            {puedeReabrir && estaCerrado === false && (
              <button onClick={reabrir} className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700">
                Reabrir
              </button>
            )}
            {!esCliente && (
              <select
                value={ticket.prioridad}
                onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                {PRIORIDADES.map((p) => <option key={p} value={p}>Prioridad: {p}</option>)}
              </select>
            )}
          </div>
        )}
        {estaCerrado && puedeReabrir && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button onClick={reabrir} className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700">
              Reabrir ticket
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Comentarios ({comentarios.length})</h2>
        <div className="space-y-2">
          {comentarios.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border p-3 ${
                c.es_nota_interna ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">{c.usuario_nombre ?? "Usuario"}</span>
                <span>
                  {c.es_nota_interna && <span className="text-amber-700 font-semibold mr-2">[NOTA INTERNA]</span>}
                  {new Date(c.fecha_creacion).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">{c.contenido}</p>
            </div>
          ))}
        </div>

        {!estaCerrado && (
          <form onSubmit={enviarComentario} className="mt-4 space-y-2 bg-white rounded-lg border border-slate-200 p-3">
            <textarea
              rows={3}
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              placeholder="Escribir comentario..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <div className="flex items-center justify-between">
              {!esCliente && (
                <label className="text-xs flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={esNotaInterna}
                    onChange={(e) => setEsNotaInterna(e.target.checked)}
                  />
                  Nota interna (solo agentes/admins)
                </label>
              )}
              <button type="submit" className="ml-auto rounded-md bg-brand px-3 py-1 text-sm font-semibold text-white hover:bg-brand-dark">
                Comentar
              </button>
            </div>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Adjuntos ({adjuntos.length})</h2>
        {!estaCerrado && (
          <input type="file" multiple onChange={subirAdjunto} className="mb-2 text-sm" />
        )}
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {adjuntos.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="truncate">{a.nombre_archivo} <span className="text-slate-400">({a.tamano_bytes ?? 0}B)</span></span>
              <button
                onClick={async () => { await adjuntoApi.eliminar(ticketId, a.id); await cargar(); }}
                className="text-xs text-red-600 hover:underline"
              >
                borrar
              </button>
            </li>
          ))}
        </ul>
      </section>
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
