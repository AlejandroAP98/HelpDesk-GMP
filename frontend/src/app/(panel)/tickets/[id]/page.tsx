"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  type Comentario,
  type EstadoTicket,
  type HistorialEstado,
  type PrioridadTicket,
  type ElementoInfraestructura,
} from "@/lib/endpoints";
import { useTicketDetail } from "@/hooks/useTicketDetail";
import { getTicketTimeline } from "@/lib/ticketTimeline";
import { EstadoBadge, PrioridadBadge, PRIORIDADES, prioridadLabels, estadoStyles } from "@/components/Badges";
import UserCommentsIcon from "@/app/assets/icons/UserCommentsIcon";
import ChangeStatusIcon from "@/app/assets/icons/ChangeStatusIcon";
import SendCommentIcon from "@/app/assets/icons/SendCommentIcon";
import { LoadingState } from "@/components/ui/LoadingState";
import { AdjuntosGallery } from "@/components/AdjuntosGallery";
import { QuickReplies } from "@/components/QuickReplies";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { CopyField } from "@/components/ui/CopyField";
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

  const {
    ticket, comentarios, adjuntos, historial,
    nuevoComentario, setNuevoComentario,
    esNotaInterna, setEsNotaInterna,
    cargando, error, setError,
    comentariosPage, comentariosTotalPages, cargarMasComentarios,
    adjuntosPage, adjuntosTotalPages, cargarMasAdjuntos,
    historialPage, historialTotalPages, cargarMasHistorial,
    agentes, agenteSel, setAgenteSel, reasignando, reasignar,
    handleCopiar, campoCopiado,
    enviarComentario, cambiarEstado, cerrar, reabrir, asignarme, setPrioridad, cargar,
  } = useTicketDetail(ticketId);

  if (cargando) return (
    <LoadingState />
  );
  if (error && !ticket) return (
    <div className="rounded-2xl bg-red-50 border border-red-100 px-6 py-4 flex items-center gap-3">
      <svg fill="none" stroke="currentColor" className="w-5 h-5 text-red-500 shrink-0" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
      <p className="font-medium text-red-600">{error}</p>
    </div>
  );
  if (!ticket) return null;

  const esCliente = usuario?.rol === "cliente";
  const esAgente = usuario?.rol === "agente";
  const esAdmin = usuario?.rol === "administrador";
  const esMesaAyuda = usuario?.rol === "mesa_ayuda";
  const esAgenteAsignado = ticket?.agente_id === usuario?.id;
  const esMesaAyudaAsignado = ticket?.agente_id === usuario?.id;
  const puedeProgresar = (esAgente && esAgenteAsignado) || esAdmin || (esMesaAyuda && esMesaAyudaAsignado);
  const puedeResolver = (esAgente && esAgenteAsignado) || esAdmin || (esMesaAyuda && esMesaAyudaAsignado);
  const puedeCerrar =
    (esCliente && ticket.cliente_id === usuario?.id) ||
    (esAgente && esAgenteAsignado) ||
    esAdmin ||
    (esMesaAyuda && esMesaAyudaAsignado);
  const puedeReabrir = esAdmin;
  const puedeAutoasignar = (esAdmin || esMesaAyuda) && ticket.estado === "abierto";
  const puedeReasignar = (esAdmin || esMesaAyuda) && ticket.agente_id && ticket.estado !== "cerrado" && ticket.estado !== "resuelto";
  const estaCerrado = ticket.estado === "cerrado";
  return (
    <div className="space-y-1">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center text-xs font-normal cursor-pointer text-gray-500 hover:text-gray-800 transition-colors"
      >
        <BackIcon className="w-4 h-4" />
        Volver
      </button>

      <div className="flex flex-col lg:flex-row gap-6 ">
        <div className="flex flex-col gap-4 flex-1 min-w-0 ">
          <div className="bg-cardCustom shadow-card animate-fade-in rounded-xl border border-brandCustom/30">
            <dl className="flex sm:flex-row flex-col items-center justify-between gap-2 w-full mb-2 bg-brandCustom rounded-t-[0.6rem] sm:px-6 px-4 py-2">
             <div className="flex sm:justify-start w-full justify-between sm:gap-5 gap-1 sm:pb-0 pb-1 sm:border-b-0 border-b">
                <div>
                  <dt className="text-[10px] font-medium text-white/70 tracking-wider mb-0.5">Empresa</dt>
                  <dd className="font-regular text-white text-[11px]">{ticket.empresa_nombre ?? `#${ticket.empresa_id}`}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium text-white/70 tracking-wider mb-0.5">Subcategoría</dt>
                  <dd className="font-regular text-white text-[11px]">{ticket.subcategoria_nombre ?? `#${ticket.subcategoria_id}`}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium text-white/70 tracking-wider mb-0.5">Elemento</dt>
                  <dd className="font-regular text-white text-[11px]">{elementoLabels[ticket.elemento_afectado] ?? ticket.elemento_afectado}</dd>
                </div>
             </div>
              <div className="flex sm:justify-end justify-between w-full sm:gap-4 gap-2">
                <div>
                  <dt className="text-[10px] font-medium text-white/70 tracking-wider mb-0.5">Creado</dt>
                  <dd className="font-regular text-white text-[11px]">{new Date(ticket.fecha_creacion).toLocaleString(undefined, { timeZone: "America/Bogota", dateStyle: 'short', timeStyle: 'short'})}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium text-white/70 tracking-wider mb-0.5">Actualizado</dt>
                  <dd className="font-regular text-white text-[11px]">{new Date(ticket.fecha_actualizacion).toLocaleString(undefined, { timeZone: "America/Bogota", dateStyle: 'short', timeStyle: 'short' })}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-medium text-white/70 tracking-wider mb-0.5">Agente</dt>
                  <dd className="font-regular text-white text-[11px]">{ticket.agente_nombre ?? "Sin asignar"}</dd>
                </div>
              </div>
            </dl>
            <div className="flex flex-col md:flex-row-reverse md:items-start justify-between gap-4 px-4 pb-2">
              <div className="flex flex-row md:flex-col items-center justify-end md:items-end gap-2 shrink-0" >
                <span className="font-medium text-gray-500 tracking-wide font-mono uppercase text-xs">#{ticket.id.split("-")[0]}</span>
                <EstadoBadge estado={ticket.estado} />
                <PrioridadBadge prioridad={ticket.prioridad} />
              </div>
              <div className="space-y-1 min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-gray-900 break-words">{ticket.titulo}</h1>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.descripcion}</p>
              </div>

            </div>
            {(ticket.ip_pcs || ticket.ip_antena || ticket.mascara_red || ticket.puerta_enlace || ticket.nombre_punto) && (
              <div className="sm:mt-8 mt-4 px-4 pb-2 ">
                <span className="text-xs font-medium text-gray-600 tracking-wider mb-2 block">Información adicional</span>
                <dl className="grid grid-cols-2 sm:grid-cols-4 sm:gap-4 gap-1">
                  {ticket.nombre_punto && (
                    <CopyField
                      label="Punto"
                      value={ticket.nombre_punto}
                      fieldKey="nombre_punto"
                      copied={campoCopiado}
                      onCopy={handleCopiar}
                      innerClassName="p-2"
                    />
                  )}
                  {ticket.ip_pcs && (
                    <CopyField
                      label="IP PC(s)"
                      value={ticket.ip_pcs}
                      fieldKey="ip_pcs"
                      copied={campoCopiado}
                      onCopy={handleCopiar}
                      mono
                    />
                  )}
                  {ticket.ip_antena && (
                    <CopyField
                      label="IP Antena"
                      value={ticket.ip_antena}
                      fieldKey="ip_antena"
                      copied={campoCopiado}
                      onCopy={handleCopiar}
                      mono
                    />
                  )}
                  {ticket.mascara_red && (
                    <CopyField
                      label="Máscara"
                      value={ticket.mascara_red}
                      fieldKey="mascara_red"
                      copied={campoCopiado}
                      onCopy={handleCopiar}
                      mono
                    />
                  )}
                  {ticket.puerta_enlace && (
                    <CopyField
                      label="Puerta de enlace"
                      value={ticket.puerta_enlace}
                      fieldKey="puerta_enlace"
                      copied={campoCopiado}
                      onCopy={handleCopiar}
                      mono
                    />
                  )}
                </dl>
              </div>
            )}
            {!estaCerrado &&  (
              <div className="flex justify-between px-4 py-1.5 mt-4 rounded-b-[0.6rem] bg-brandCustom/5">
                <div className="w-full flex-col justify-between">
                  {((esMesaAyudaAsignado || esAdmin) || (esCliente && ticket.estado === "resuelto") || (esAgente && esAgenteAsignado) || (esMesaAyuda && ticket.estado === "abierto"))  && (
                    <label className="sm:text-xs text-[10px] font-medium text-gray-600 tracking-wider mb-2 block pl-1">Acciones:</label>
                  )}
                  {puedeProgresar && ticket.estado === "asignado" && (
                  <button
                    onClick={() => cambiarEstado("en_progreso")}
                    className="self-end rounded-xl bg-yellowCustom hover:bg-yellowCustom/80 sm:px-4 px-2 py-2 sm:py-2.5 sm:text-xs text-[11px] font-normal text-white active:scale-[0.98] transition-all"
                  >
                    Iniciar trabajo
                  </button>
                  )}
                  {puedeAutoasignar && (
                    <button
                      onClick={asignarme}
                      className="self-end rounded-xl bg-violetCustom hover:bg-violetCustom/80 sm:px-4 px-2 py-2 sm:py-2.5 sm:text-xs text-[11px] font-normal text-white active:scale-[0.98] transition-all"
                    >
                      Asignarme
                    </button>
                  )}
                  {puedeResolver && ticket.estado === "en_progreso" && (
                    <button
                      onClick={() => cambiarEstado("resuelto")}
                      className="self-end rounded-xl bg-greenCustom hover:bg-greenCustom/80 sm:px-4 px-2 py-2 sm:py-2.5 sm:text-xs text-[11px] font-normal text-white active:scale-[0.98] transition-all"
                    >
                      Marcar resuelto
                    </button>
                  )}
                  {puedeCerrar && ticket.estado === "resuelto" && (
                    <button
                      onClick={cerrar}
                      className="self-end rounded-xl bg-grayCustom hover:bg-grayCustom/80 sm:px-4 px-2 py-2 sm:py-2.5 sm:text-xs text-[11px] font-normal text-white active:scale-[0.98] transition-all"
                    >
                      Cerrar ticket
                    </button>
                  )}
                </div>
                {!esCliente && (
                  <div className="flex flex-col self-end w-full">
                    <label className="sm:text-xs text-[10px] font-medium text-gray-600 tracking-wider mb-2 block self-end">Cambiar prioridad:</label>
                    <select
                      value={ticket.prioridad}
                      onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
                      className="rounded-xl border border-gray-400 bg-gray-50 text-textCustom sm:text-xs text-[11px] px-3 py-2 sm:py-2.5 font-normal focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer ml-auto"
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
              <div className="flex flex-col px-4 py-4  w-fit">
                <label className="text-xs font-medium text-gray-600 tracking-wider mb-2 block pl-1">Acciones:</label>
                <button
                  onClick={reabrir}
                  className="rounded-xl bg-brandCustom hover:bg-brandCustom/90 sm:text-xs text-[11px] px-3 py-2 sm:py-2.5 font-normal text-white active:scale-[0.98] transition-all"
                >
                  Reabrir ticket
                </button>
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2">
                <svg fill="none" stroke="currentColor" className="w-4 h-4 text-red-500 shrink-0" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
                <p className="text-sm font-normal text-red-600">{error}</p>
              </div>
            )}
          </div>
          {puedeReasignar && (
            <div className="flex flex-col gap-1 self-start w-auto">
              <label className="sm:text-xs text-[10px] font-medium text-gray-600 tracking-wider block">Reasignar a:</label>
              <div className="flex items-center gap-1">
                <select
                  value={agenteSel}
                  onChange={(e) => setAgenteSel(e.target.value)}
                  className="rounded-xl border border-gray-400 bg-gray-50 text-textCustom sm:text-xs text-[11px] px-3 py-2.5 font-normal focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer flex-1 sm:flex-none sm:min-w-[180px]"
                >
                  <option value="">Seleccione agente...</option>
                  {agentes.filter((a) => a.id !== ticket.agente_id).map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
                <button
                  onClick={reasignar}
                  disabled={!agenteSel || reasignando}
                  className="rounded-xl bg-violetCustom hover:bg-violetCustom/80 disabled:opacity-50 disabled:cursor-not-allowed sm:px-4 px-2 py-2 sm:py-2.5 sm:text-xs text-[11px] font-normal text-white active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  {reasignando ? "Reasignando..." : "Reasignar"}
                </button>
              </div>
            </div>
          )}
          <section className="w-full space-y-2">
            <h2 className="text-sm sm:text-md font-semibold tracking-tight text-brandCustom">Comentarios ({comentarios.length})</h2>
            <div className={`space-y-2.5 flex flex-col w-full p-4 ${comentarios.length > 0 ? 'bg-cardCustom rounded-xl' : 'bg-transparent'} `}>
              {comentarios.map((c: Comentario, index: number) => (
                <div
                  key={c.id}
                  className={`rounded-3xl border p-2.5 transition-all opacity-0 animate-fade-in w-fit ${
                    c.es_nota_interna
                      ? "border-accentCustom/40 bg-accentCustom/10 w-full !rounded-t-2xl"
                      : c.usuario_nombre
                      ? c.usuario_nombre === usuario?.nombre
                        ? "border-gray-300 bg-gray-50 drop-shadow-sm self-end rounded-tr-none"
                        : "border-brandCustom/30 bg-brandCustom/5 drop-shadow-sm rounded-tl-none"
                      : "border-gray-300 bg-white drop-shadow-sm"
                  }`}
                  style={{
                    animationDelay: `${index * 40}ms`,
                    animationFillMode: "forwards"
                  }}
                >
                  <div className="flex flex-col">
                    <div>
                      <div className="flex justify-between items-center gap-2 w-full ">
                        <div className="flex justify-between items-center h-full gap-2 mb-1">
                          <div className={`w-7 h-7 rounded-full ${c.usuario_nombre !== usuario?.nombre  ? 'text-brandCustom bg-brandCustom/10' : 'text-grayCustom bg-grayCustom/10'} flex items-center justify-center`}>
                            <UserCommentsIcon />
                          </div>
                          <span className={`font-semibold text-xs ${c.usuario_nombre !== usuario?.nombre  ? 'text-brandCustom' : 'text-grayCustom'}`}>{c.usuario_nombre ? (c.usuario_nombre === usuario?.nombre ? "Yo" : c.usuario_nombre) : "Usuario" }</span>
                        </div>
                        <span className="text-gray-400 text-[9px] self-start ">{new Date(c.fecha_creacion).toLocaleString(undefined, { timeZone: "America/Bogota" })}</span>
                      </div>
                    </div>
                    {c.es_nota_interna && (
                      <span className="bg-accentCustom flex w-fit self-end text-white border border-accentCustom rounded-md px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide">
                        Nota interna
                      </span>
                    )}
                  </div>
                  <p className="sm:text-sm text-xs pl-2 whitespace-pre-wrap text-textCustom leading-relaxed">{c.contenido}</p>

                </div>
              ))}
            </div>

            {comentariosPage < comentariosTotalPages && (
              <LoadMoreButton onClick={cargarMasComentarios} label="Cargar mas comentarios..." />
            )}
            {!estaCerrado && (
              <form onSubmit={enviarComentario} className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 space-y-3">
                {!esCliente && (
                  <QuickReplies onInsert={(text) => setNuevoComentario((prev) => prev + text)} />
                )}
                <textarea
                  rows={3}
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  placeholder="Escribir comentario..."
                  className={`w-full border border-gray-200
                  ${esNotaInterna ? "bg-accentCustom/5 focus:ring-accentCustom" : " focus:ring-brandCustom"}
                  rounded-xl px-4 py-2.5 sm:text-sm text-xs text-gray-900 placeholder-gray-400 focus:border-brandCustom focus:ring-1 focus:bg-white outline-none transition-all resize-none`}
                />
                <div className="flex sm:flex-row items-center sm:items-center justify-between gap-2">
                  {!esCliente && (
                    <label className="text-xs font-normal text-gray-600 flex items-center gap-2 cursor-pointer select-none">
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
                    className="sm:ml-auto rounded-xl bg-brandCustom px-4 py-2 sm:text-sm text-[12px] font-regular text-white hover:bg-brandCustom/90 shadow-brand active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    Comentar
                    <SendCommentIcon className="w-5 h-5" />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm sm:text-md font-semibold tracking-tight text-brandCustom">Adjuntos ({adjuntos.length})</h2>
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <AdjuntosGallery
                ticketId={ticketId}
                adjuntos={adjuntos}
                puedeSubir={!estaCerrado}
                puedeBorrar={() => true}
                onChanged={cargar}
                onError={setError}
              />
              {adjuntosPage < adjuntosTotalPages && (
                <LoadMoreButton onClick={cargarMasAdjuntos} label="Cargar mas adjuntos..." />
              )}
            </div>
          </section>
          <section className="space-y-2">
            <h2 className="text-sm sm:text-md font-semibold tracking-tight text-brandCustom mb-3">Tiempos</h2>
            {(() => {
              const timeline = getTicketTimeline(ticket);
              const hasAnyDate = timeline.some((item) => item.date !== null);
              if (!hasAnyDate) return null;
              return (
                <div className="relative border border-gray-100 shadow-card p-3 bg-cardCustom rounded-2xl">
                  <div className="absolute left-[24px] top-[14px] bottom-[40px] w-0.5 bg-gray-200" />
                  <div className="space-y-0">
                    {timeline.map((item, idx) => (
                      <div key={item.label} className="relative flex gap-3 opacity-0 animate-fade-in" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "forwards" }}>
                        <div className={`relative z-10 w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 ${item.dotColor}`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center justify-between">
                            <p className={`text-[11px] font-medium ${item.date ? "text-gray-800" : "text-gray-400"}`}>{item.label}</p>
                            {item.duration && (
                              <span className="text-[10px] font-semibold text-brandCustom bg-brandCustom/10 rounded-md px-1.5 py-0.5 shrink-0">
                                {item.duration}
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] ${item.date ? "text-gray-500" : "text-gray-300"}`}>{item.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
          <section className="space-y-2">
            <h2 className="text-sm sm:text-md font-semibold tracking-tight text-brandCustom">Historial de estados</h2>
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              {historial.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">Sin cambios de estado registrados.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />
                  <ul className="space-y-4">
                    {historial.map((h: HistorialEstado, index: number) => (
                      <li key={h.id} className="relative flex gap-3 pl-7 opacity-0 animate-fade-in" style={{ animationDelay: `${index * 40}ms` }}>
                        <div className="absolute left-0 top-1 w-[22px] h-[22px] text-brandCustom rounded-full bg-gray-200 border-2 border-gray-200 flex items-center justify-center shrink-0">
                          <ChangeStatusIcon strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase border ${estadoStyles[h.estado_anterior] ?? ""}`}>
                              {h.estado_anterior.replace("_", " ")}
                            </span>
                            <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase border ${estadoStyles[h.estado_nuevo] ?? ""}`}>
                              {h.estado_nuevo.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">
                            {h.usuario_nombre ?? "Usuario"} &middot; {new Date(h.fecha).toLocaleString(undefined, { timeZone: "America/Bogota" })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {historialPage < historialTotalPages && (
                <LoadMoreButton onClick={cargarMasHistorial} label="Cargar mas historial..." />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
