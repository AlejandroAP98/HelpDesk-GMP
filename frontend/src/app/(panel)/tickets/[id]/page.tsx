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
  type ElementoInfraestructura,
  type EstadoTicket,
  type HistorialEstado,
  type PrioridadTicket,
  type Ticket,
} from "@/lib/endpoints";
import { EstadoBadge, PrioridadBadge, PRIORIDADES, prioridadLabels, estadoStyles } from "@/components/Badges";
import UserCommentsIcon from "@/app/assets/icons/UserCommentsIcon";
import ChangeStatusIcon from "@/app/assets/icons/ChangeStatusIcon";
import SendCommentIcon from "@/app/assets/icons/SendCommentIcon";
import CopyInfoIcon from "@/app/assets/icons/CopyInfoIcon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/Button";
import BackIcon from "@/app/assets/icons/BackIcon";

const elementoLabels: Record<ElementoInfraestructura, string> = {
  torre: "Torre",
  celda: "Celda",
  mastil: "Mástil",
  punto_venta: "Punto de venta",
};

export default function TicketDetallePage() {
  const params = useParams();
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const ticketId = String(params.id);

  const subscribeTicket = useWsTicketStore((s) => s.subscribeTicket);
  const unsubscribeTicket = useWsTicketStore((s) => s.unsubscribeTicket);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const setOnTicketAssigned = useWsTicketStore((s) => s.setOnTicketAssigned);
  const setOnTicketCommented = useWsTicketStore((s) => s.setOnTicketCommented);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [historial, setHistorial] = useState<HistorialEstado[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [esNotaInterna, setEsNotaInterna] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comentariosPage, setComentariosPage] = useState(1);
  const [comentariosTotalPages, setComentariosTotalPages] = useState(1);
  const [adjuntosPage, setAdjuntosPage] = useState(1);
  const [adjuntosTotalPages, setAdjuntosTotalPages] = useState(1);
  const [historialPage, setHistorialPage] = useState(1);
  const [historialTotalPages, setHistorialTotalPages] = useState(1);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [t, cs, as, hs] = await Promise.all([
        ticketApi.obtener(ticketId),
        comentarioApi.listar(ticketId, { page: 1, size: 20 }),
        adjuntoApi.listar(ticketId, { page: 1, size: 20 }),
        ticketApi.historial(ticketId, { page: 1, size: 20 }),
      ]);
      setTicket(t);
      setComentarios(cs.items);
      setComentariosTotalPages(cs.pages);
      setComentariosPage(1);
      setAdjuntos(as.items);
      setAdjuntosTotalPages(as.pages);
      setAdjuntosPage(1);
      setHistorial(hs.items);
      setHistorialTotalPages(hs.pages);
      setHistorialPage(1);
    } catch {
      setError("No se pudo cargar el ticket");
    } finally {
      setCargando(false);
    }
  }, [ticketId]);

  const cargarMasComentarios = async () => {
    const nextPage = comentariosPage + 1;
    if (nextPage > comentariosTotalPages) return;
    try {
      const data = await comentarioApi.listar(ticketId, { page: nextPage, size: 20 });
      setComentarios((prev) => [...prev, ...data.items]);
      setComentariosPage(nextPage);
      setComentariosTotalPages(data.pages);
    } catch {
      /* ignore */
    }
  };

  const cargarMasAdjuntos = async () => {
    const nextPage = adjuntosPage + 1;
    if (nextPage > adjuntosTotalPages) return;
    try {
      const data = await adjuntoApi.listar(ticketId, { page: nextPage, size: 20 });
      setAdjuntos((prev) => [...prev, ...data.items]);
      setAdjuntosPage(nextPage);
      setAdjuntosTotalPages(data.pages);
    } catch {
      /* ignore */
    }
  };

  const cargarMasHistorial = async () => {
    const nextPage = historialPage + 1;
    if (nextPage > historialTotalPages) return;
    try {
      const data = await ticketApi.historial(ticketId, { page: nextPage, size: 20 });
      setHistorial((prev) => [...prev, ...data.items]);
      setHistorialPage(nextPage);
      setHistorialTotalPages(data.pages);
    } catch {
      /* ignore */
    }
  };

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

    setOnTicketAssigned((ev) => {
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
      setOnTicketAssigned(null);
      setOnTicketCommented(null);
    };
  }, [ticketId, usuario?.rol, subscribeTicket, unsubscribeTicket, setOnTicketUpdated, setOnTicketAssigned, setOnTicketCommented]);
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

  if (cargando) return (
    <LoadingState />
  );
  if (error && !ticket) return (
    <div className="rounded-2xl bg-red-50 border border-red-100 px-6 py-4 flex items-center gap-3">
      <svg fill="none" stroke="currentColor" className="w-5 h-5 text-red-500 shrink-0" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
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
        className="inline-flex items-center text-sm font-medium border-gray-300 border border-1  rounded-xl px-2 py-2 cursor-pointer text-gray-500 hover:text-gray-800 transition-colors"
      >
        <BackIcon className="w-5 h-5" />
        Volver
      </button>

      <div className="flex flex-col lg:flex-row gap-6 ">
        {/* Columna izquierda: Info + Comentarios (en mobile: info primero, comentarios despues) */}
        <div className="flex flex-col gap-6 flex-1 min-w-0 ">
          {/* Informacion del ticket */}
          <div className="bg-cardCustom rounded-2xl shadow-card">
            <dl className="flex items-center justify-between  gap-2 w-full mb-6 bg-brandCustom rounded-t-2xl sm:px-6 px-4 py-4">
             <div className="flex sm:flex-row flex-col self-start sm:gap-10 gap-2">
                <div>
                  <dt className="text-[10px] font-semibold text-gray-100 tracking-wider mb-0.5">ID Ticket</dt>
                  <dd className="font-regular text-white text-[11px] ">#{ticket.id}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold text-gray-100 tracking-wider mb-0.5">Empresa</dt>
                  <dd className="font-regular text-white text-[11px]">#{ticket.empresa_id}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold text-gray-100 tracking-wider mb-0.5">Subcategoría</dt>
                  <dd className="font-regular text-white text-[11px]">{ticket.subcategoria_nombre ?? `#${ticket.subcategoria_id}`}</dd>
              </div>
               <div>
                  <dt className="text-[10px] font-semibold text-gray-100 tracking-wider mb-0.5">Elemento</dt>
                  <dd className="font-regular text-white text-[11px]">{elementoLabels[ticket.elemento_afectado] ?? ticket.elemento_afectado}</dd>
                </div>
             </div>
              <div className="flex sm:flex-row flex-col self-start sm:gap-4 gap-2">
                <div>
                  <dt className="text-[10px] font-semibold text-gray-100 tracking-wider mb-0.5">Creado</dt>
                  <dd className="font-regular text-white text-[11px]">{new Date(ticket.fecha_creacion).toLocaleString(undefined, { timeZone: "America/Bogota" })}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold text-gray-100 tracking-wider mb-0.5">Actualizado</dt>
                  <dd className="font-regular text-white text-[11px]">{new Date(ticket.fecha_actualizacion).toLocaleString(undefined, { timeZone: "America/Bogota" })}</dd>
                </div>
              </div>
            </dl>
            <div className="flex flex-col md:flex-row-reverse md:items-start justify-between gap-4 px-4 pb-4">
              <div className="flex flex-row md:flex-col items-center justify-end md:items-end gap-2 shrink-0 " >
                <EstadoBadge estado={ticket.estado} />
                <PrioridadBadge prioridad={ticket.prioridad} />
              </div>
              <div className="space-y-2 min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-gray-900 break-words">{ticket.titulo}</h1>
                <p className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{ticket.descripcion}</p>
              </div>
              
            </div>
            {(ticket.ip_pcs || ticket.ip_antena || ticket.mascara_red || ticket.puerta_enlace || ticket.nombre_punto) && (
              <div className="sm:mt-8 mt-4 px-4 pb-4 ">
                <span className="text-xs font-semibold text-gray-600 tracking-wider mb-2 block">Información adicional</span>
                <dl className="grid grid-cols-2 sm:grid-cols-4 sm:gap-4 gap-1">
                  {ticket.nombre_punto && (
                    <div className="bg-borderCustom/20 border border-gray-100 rounded-xl sm:px-2 px-1 flex items-center justify-between">
                      <div className="min-w-0 p-2">
                        <dt className="text-[10px] text-gray-400 font-medium tracking-wider mb-0.5">Punto</dt>
                        <dd className="font-semibold text-gray-700 text-[11px] truncate">{ticket.nombre_punto}</dd>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard.writeText(ticket.nombre_punto!)} className="shrink-0 text-gray-400 hover:text-brandCustom transition-colors p-0.5" title="Copiar">
                        <CopyInfoIcon/>
                      </button>
                    </div>
                  )}
                  {ticket.ip_pcs && (
                    <div className="bg-borderCustom/20 border border-gray-100 rounded-xl sm:px-2 px-1 flex items-center justify-between">
                      <div className="min-w-0">
                        <dt className="text-[10px] text-gray-400 font-medium tracking-wider mb-0.5">IP PC(s)</dt>
                        <dd className="font-semibold font-mono text-gray-700 text-[11px] truncate">{ticket.ip_pcs}</dd>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard.writeText(ticket.ip_pcs!)} className="shrink-0 text-gray-400 hover:text-brandCustom transition-colors p-0.5" title="Copiar">
                        <CopyInfoIcon />
                      </button>
                    </div>
                  )}
                  {ticket.ip_antena && (
                    <div className="bg-borderCustom/20 border border-gray-100 rounded-xl sm:px-2 px-1 flex items-center justify-between">
                      <div className="min-w-0">
                        <dt className="text-[10px] text-gray-400 font-medium tracking-wider mb-0.5">IP Antena</dt>
                        <dd className="font-semibold font-mono text-gray-700 text-[11px] truncate">{ticket.ip_antena}</dd>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard.writeText(ticket.ip_antena!)} className="shrink-0 text-gray-400 hover:text-brandCustom transition-colors p-0.5" title="Copiar">
                        <CopyInfoIcon />
                      </button>
                    </div>
                  )}
                  {ticket.mascara_red && (
                    <div className="bg-borderCustom/20 border border-gray-100 rounded-xl sm:px-2 px-1 flex items-center justify-between">
                      <div className="min-w-0">
                        <dt className="text-[10px] text-gray-400 font-medium tracking-wider mb-0.5">Máscara</dt>
                        <dd className="font-semibold font-mono text-gray-700 text-[11px] truncate">{ticket.mascara_red}</dd>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard.writeText(ticket.mascara_red!)} className="shrink-0 text-gray-400 hover:text-brandCustom transition-colors p-0.5" title="Copiar">
                        <CopyInfoIcon />
                      </button>
                    </div>
                  )}
                  {ticket.puerta_enlace && (
                    <div className="bg-borderCustom/20 border border-gray-100 rounded-xl sm:px-2 px-1 flex items-center justify-between">
                      <div className="min-w-0">
                        <dt className="text-[10px] text-gray-400 font-medium tracking-wider mb-0.5">Puerta de enlace</dt>
                        <dd className="font-semibold font-mono text-gray-700 text-[11px] truncate">{ticket.puerta_enlace}</dd>
                      </div>
                      <button type="button" onClick={() => navigator.clipboard.writeText(ticket.puerta_enlace!)} className="shrink-0 text-gray-400 hover:text-brandCustom transition-colors p-0.5" title="Copiar">
                        <CopyInfoIcon />
                      </button>
                    </div>
                  )}
                </dl>
              </div>
            )}
            {!estaCerrado &&  (
              <div className="flex justify-between p-4 rounded-b-2xl">
                <div className="w-full flex-col justify-between">
                  {((!esCliente && (ticket.estado !== "abierto")) || (esCliente && ticket.estado === "resuelto")) && (
                    <label className="text-xs font-semibold text-gray-600 tracking-wider mb-2 block pl-1">Acciones</label>
                  )}
                  {puedeProgresar && ticket.estado === "asignado" && (
                  <button
                    onClick={() => cambiarEstado("en_progreso")}
                    className="self-end rounded-xl bg-yellowCustom hover:bg-yellowCustom/80 px-4 py-2.5 text-xs font-medium text-white active:scale-[0.98] transition-all"
                  >
                    Iniciar trabajo
                  </button>
                  )}
                  {puedeResolver && ticket.estado === "en_progreso" && (
                    <button
                      onClick={() => cambiarEstado("resuelto")}
                      className="self-end rounded-xl bg-greenCustom hover:bg-greenCustom/80 px-4 py-2.5 text-xs font-medium text-white active:scale-[0.98] transition-all"
                    >
                      Marcar resuelto
                    </button>
                  )}
                  {puedeCerrar && ticket.estado === "resuelto" && (
                    <button
                      onClick={cerrar}
                      className="self-end rounded-xl bg-grayCustom hover:bg-grayCustom/80 px-4 py-2.5 text-xs font-medium text-white active:scale-[0.98] transition-all"
                    >
                      Cerrar ticket
                    </button>
                  )}
                  {puedeReabrir && !estaCerrado && ticket.estado === "cerrado" && (
                    <button
                      onClick={reabrir}
                      className="self-end rounded-xl bg-brandCustom hover:bg-brandCustom/80 px-4 py-2.5 text-xs font-medium text-white active:scale-[0.98] transition-all"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
                {!esCliente && (
                  <div className="flex flex-col self-end w-full">
                    <label className="text-xs font-semibold text-gray-600 tracking-wider mb-2 block self-end">Cambiar prioridad</label>
                    <select
                      value={ticket.prioridad}
                      onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
                      className="rounded-xl border border-gray-400 bg-gray-50 text-textCustom px-3 py-2.5 text-xs font-medium focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer ml-auto"
                      >
                      {PRIORIDADES.map((p) => (
                        <option key={p} value={p}>{prioridadLabels[p]}</option>
                      ))}
                    </select>
                  </div>
                  )}
              </div>
            )}
            {estaCerrado && puedeReabrir && !esCliente && (
              <div className="flex flex-col p-4 rounded-b-2xl w-fit">
                <label className="text-xs font-semibold text-gray-600 tracking-wider mb-2 block pl-1">Acciones</label>
                <button
                  onClick={reabrir}
                  className="rounded-xl bg-brandCustom hover:bg-brandCustom/90 px-4 py-2.5 text-xs font-medium text-white active:scale-[0.98] transition-all"
                >
                  Reabrir ticket
                </button>
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2">
                <svg fill="none" stroke="currentColor" className="w-4 h-4 text-red-500 shrink-0" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Comentarios: debajo de info en ambas vistas */}
          <section className="w-full space-y-4 ">
            <h2 className="text-lg font-bold tracking-tight text-gray-900">Comentarios ({comentarios.length})</h2>
            <div className="space-y-2.5">
              {comentarios.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-2xl border px-4 py-2.5 transition-all ${c.es_nota_interna
                    ? "border-accentCustom/40 bg-accentCustom/10"
                    : "border-gray-100 bg-cardCustom shadow-card"
                    }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full text-brandCustom bg-brandCustom/10 flex items-center justify-center">
                        <UserCommentsIcon />
                      </div>
                      <span className="font-semibold text-gray-700">{c.usuario_nombre ?? "Usuario"}</span>
                      {c.es_nota_interna && (
                        <span className="bg-accentCustom text-white border border-accentCustom rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                          Nota interna
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500">{new Date(c.fecha_creacion).toLocaleString(undefined, { timeZone: "America/Bogota" })}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-textCustom leading-relaxed">{c.contenido}</p>
                </div>
              ))}
            </div>

            {comentariosPage < comentariosTotalPages && (
              <button
                onClick={cargarMasComentarios}
                className="w-full text-center text-sm font-medium text-brand-600 hover:text-brand-700 py-2 transition-colors"
              >
                Cargar mas comentarios...
              </button>
            )}

            {!estaCerrado && (
              <form onSubmit={enviarComentario} className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 space-y-3">
                <textarea
                  rows={3}
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  placeholder="Escribir comentario..."
                  className={`w-full border border-gray-200
                  ${esNotaInterna ? "bg-accentCustom/5 focus:ring-accentCustom" : " focus:ring-brandCustom"}
                  rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brandCustom focus:ring-1 focus:bg-white outline-none transition-all resize-none`}
                />
                <div className="flex sm:flex-row items-center sm:items-center justify-between gap-2">
                  {!esCliente && (
                    <label className="text-xs font-medium text-gray-600 flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={esNotaInterna}
                        onChange={(e) => setEsNotaInterna(e.target.checked)}
                        className="rounded border-borderCustom text-brandCustom focus:ring-brandCustom focus:ring-offset-0"
                      />
                      Nota interna
                    </label>
                  )}
                  <button
                    type="submit"
                    className="sm:ml-auto rounded-xl bg-brandCustom px-4 py-2 text-sm font-regular text-white hover:bg-brandCustom/90 shadow-brand active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    Comentar
                    <SendCommentIcon className="w-5 h-5" />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* Columna derecha: Historial + Adjuntos */}
        <div className="w-full lg:w-80 shrink-0 space-y-6">

          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-gray-900">Adjuntos ({adjuntos.length})</h2>
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 space-y-4">
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
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3.5 py-3 text-xs hover:bg-gray-50/50 transition-colors">
                      <span className="truncate text-gray-700 font-medium min-w-0" title={a.nombre_archivo}>
                        {a.nombre_archivo}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono shrink-0">
                        {a.tamano_bytes != null ? (a.tamano_bytes / 1024).toFixed(1) + " KB" : "0 KB"}
                      </span>
                      <button
                        onClick={async () => { await adjuntoApi.eliminar(ticketId, a.id); await cargar(); }}
                        className="text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors shrink-0"
                      >
                        Borrar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {adjuntosPage < adjuntosTotalPages && (
                <button
                  onClick={cargarMasAdjuntos}
                  className="w-full text-center text-sm font-medium text-brand-600 hover:text-brand-700 py-2 transition-colors"
                >
                  Cargar mas adjuntos...
                </button>
              )}
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight text-gray-900">Historial de estados</h2>
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              {historial.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">Sin cambios de estado registrados.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />
                  <ul className="space-y-4">
                    {historial.map((h) => (
                      <li key={h.id} className="relative flex gap-3 pl-7">
                        <div className="absolute left-0 top-1 w-[22px] h-[22px] text-brandCustom rounded-full bg-gray-200 border-2 border-gray-200 flex items-center justify-center shrink-0">
                          <ChangeStatusIcon strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border ${estadoStyles[h.estado_anterior] ?? ""}`}>
                              {h.estado_anterior.replace("_", " ")}
                            </span>
                            <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border ${estadoStyles[h.estado_nuevo] ?? ""}`}>
                              {h.estado_nuevo.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {h.usuario_nombre ?? "Usuario"} &middot; {new Date(h.fecha).toLocaleString(undefined, { timeZone: "America/Bogota" })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {historialPage < historialTotalPages && (
                <button
                  onClick={cargarMasHistorial}
                  className="w-full text-center text-sm font-medium text-brand-600 hover:text-brand-700 py-2 transition-colors"
                >
                  Cargar mas historial...
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
