"use client";

import { useAuthStore } from "@/store/authStore";
import { useMetricas } from "@/hooks/useMetricas";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatsCard } from "@/components/ui/StatsCard";
import { DonutChart } from "@/components/DonutChart";
import { Heatmap } from "@/components/Heatmap";
import TicketSolvedIcon from "@/app/assets/icons/TicketSolvedIcon";
import Link from "next/link";
import { ESTADO_DONUT_COLORS, ESTADO_DONUT_LABELS, PRIORIDAD_DONUT_COLORS, PRIORIDAD_DONUT_LABELS } from "@/lib/chartConstants";

const ESTADO_COLORS: Record<string, string> = {
  abierto: "bg-blueCustom",
  asignado: "bg-violetCustom",
  en_progreso: "bg-yellowCustom",
  resuelto: "bg-greenCustom",
  cerrado: "bg-grayCustom",
};

const ESTADO_LABELS: Record<string, string> = {
  abierto: "Abierto",
  asignado: "Asignado",
  en_progreso: "En Progreso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

const ESTADO_ORDEN: Array<keyof typeof ESTADO_LABELS> = [
  "abierto",
  "asignado",
  "en_progreso",
  "resuelto",
  "cerrado",
];

const ELEMENTO_LABELS: Record<string, string> = {
  torre: "Torre",
  celda: "Celda",
  punto_venta: "Punto de Venta",
};

export default function MetricasPage() {
  const {
    usuario, fechaInicio, setFechaInicio, fechaFin, setFechaFin,
    cargando, hayFiltros, limpiarFiltros,
    tiempos, volumen, infra, rendimiento, tiempoAgente, reaperturas, sla, graficas, distribucion,
  } = useMetricas();

  if (usuario?.rol !== "administrador" && usuario?.rol !== "mesa_ayuda") return null;
  if (cargando) return <LoadingState />;

  const maxEstado = Math.max(1, ...(volumen?.por_estado.map((e) => e.cantidad) ?? [1]));
  const maxEmpresa = Math.max(1, ...(volumen?.top_empresas.map((e) => e.cantidad) ?? [1]));
  const maxUbicacion = Math.max(1, ...(infra?.top_ubicaciones.map((u) => u.cantidad) ?? [1]));
  const totalEstado = volumen?.por_estado.reduce((s, e) => s + e.cantidad, 0) ?? 0;
  const totalPrioridad = volumen?.por_prioridad.reduce((s, p) => s + p.cantidad, 0) ?? 0;
  const totalElemento = infra?.por_elemento.reduce((s, e) => s + e.cantidad, 0) ?? 0;
  const estadoOrdenado = ESTADO_ORDEN.map((e) =>
    volumen?.por_estado.find((x) => x.estado === e)
  ).filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas"
        subtitle="Indicadores de rendimiento y análisis de tickets"
      />

      <div className="space-y-3">
        <div className="md:flex grid grid-cols-2 sm:justify-start gap-3">
          <div className="flex flex-col">
            <label className="sm:text-xs text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="rounded-xl border border-gray-200 text-gray-700 text-xs px-3 py-2 focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
            />
          </div>
          <div className="flex flex-col">
            <label className="sm:text-xs text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="rounded-xl border border-gray-200 text-gray-700 text-xs px-3 py-2 focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
            />
          </div>
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="text-xs self-end text-gray-500 hover:text-gray-800 underline transition-colors mb-0.5"
              >
                Limpiar filtros
              </button>
            )}
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-cardCustom p-4 sm:p-6 rounded-2xl animate-fade-in">
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-4 shadow-card">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Solucionados esta semana</p>
          <p className="text-5xl font-bold text-grayCustom animate-fade-in">{graficas?.cerrados_semana ?? 0}</p>
        </div>
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-4">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Tickets pendientes por estado</p>
          {graficas && graficas.no_cerrados_por_estado.length > 0 ? (
            <DonutChart
              data={graficas.no_cerrados_por_estado.map((e) => ({
                label: ESTADO_DONUT_LABELS[e.estado] ?? e.estado,
                value: e.cantidad,
                color: ESTADO_DONUT_COLORS[e.estado] ?? "#9ca3af",
              }))}
              size={130}
              centerLabel="pendientes"
            />
          ) : (
            <p className="text-xs text-gray-400 py-8">Sin datos</p>
          )}
        </div>
        <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl p-4">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Tickets pendientes por prioridad</p>
          {graficas && graficas.no_cerrados_por_prioridad.length > 0 ? (
            <DonutChart
              data={graficas.no_cerrados_por_prioridad.map((p) => ({
                label: PRIORIDAD_DONUT_LABELS[p.prioridad] ?? p.prioridad,
                value: p.cantidad,
                color: PRIORIDAD_DONUT_COLORS[p.prioridad] ?? "#9ca3af",
              }))}
              size={130}
              centerLabel="pendientes"
            />
          ) : (
            <p className="text-xs text-gray-400 py-8">Sin datos</p>
          )}
        </div>
      </section>
      
      <div className="space-y-6 bg-cardCustom rounded-2xl p-4 sm:p-6">
        {/* Sección 1: Tiempos */}
        <section className="space-y-4">
          <h2 className="text-base font-medium text-gray-900 tracking-tight">Tiempos de respuesta</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatsCard
              label="Tiempo Medio de Resolución"
              value={tiempos?.mttr_horas != null ? `${tiempos.mttr_horas} h` : "—"}
              icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-alarm-average" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M5 13a7 7 0 1 0 14 0 7 7 0 0 0-14 0m2-9L4.25 6M17 4l2.75 2"/><path d="M8 13h1l2 3 2-6 2 3h1"/></svg>}
              className="bg-brandCustom"
            />
            <StatsCard
              label="Primera Respuesta"
              value={tiempos?.tiempo_primera_respuesta_minutos != null ? `${tiempos.tiempo_primera_respuesta_minutos} min` : "—"}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-message-reply" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/><path d="m11 8-3 3 3 3m5-3H8"/></svg>}
              className="bg-yellowCustom"
            />
            <StatsCard
              label="% FRT cumplido"
              value={
                tiempos?.porcentaje_frt_cumplido != null
                  ? `${tiempos.porcentaje_frt_cumplido}%`
                  : "—"
              }
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-message-check" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M8 9h8m-8 4h6m4-9a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/><path d="m9 14 2 2 4-4"/></svg>
              }
              className={
                tiempos?.porcentaje_frt_cumplido == null
                  ? "bg-grayCustom"
                  : tiempos.porcentaje_frt_cumplido >= 90
                    ? "bg-greenCustom"
                    : "bg-redCustom"
              }
            />
            <StatsCard
              label="Tickets resueltos"
              value={tiempos?.tickets_resueltos_analizados ?? 0}
              icon={
                <TicketSolvedIcon />
              }
              className="bg-greenCustom"
            />
            <StatsCard
              label="Con Primera respuesta"
              value={tiempos?.tickets_con_primera_respuesta ?? 0}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-message" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M8 9h8m-8 4h6m4-9a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/></svg>
              }
              className="bg-violetCustom"
            />
          </div>
        </section>

        {/* Sección 2: Volumen */}
        <section className="space-y-4">
          <h2 className="text-base font-medium text-gray-900 tracking-tight">Volumen de tickets</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Por estado */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-medium text-gray-500 tracking-wider mb-3">Por estado</h3>
              <div className="space-y-2.5">
                {estadoOrdenado.map((item, index: number) => (
                  <div key={item.estado}  className="space-y-1 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-normal text-gray-700">{ESTADO_LABELS[item.estado] ?? item.estado}</span>
                      <span className="text-[11px] font-semibold text-gray-500">
                        {item.cantidad}
                        {totalEstado > 0 && (
                          <span className="text-gray-400 ml-1">({Math.round((item.cantidad / totalEstado) * 100)}%)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${ESTADO_COLORS[item.estado] ?? "bg-gray-300"}`}
                        style={{ width: `${(item.cantidad / maxEstado) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por prioridad (donut) */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-medium text-gray-500 tracking-wider mb-3">Por prioridad</h3>
              {volumen?.por_prioridad.length ? (
                <DonutChart
                  data={volumen.por_prioridad.map((p) => ({
                    label: PRIORIDAD_DONUT_LABELS[p.prioridad] ?? p.prioridad,
                    value: p.cantidad,
                    color: PRIORIDAD_DONUT_COLORS[p.prioridad] ?? "#9ca3af",
                  }))}
                  size={140}
                  centerLabel="total"
                  centerValue={totalPrioridad}
                />
              ) : (
                <p className="text-xs text-gray-400 py-8 text-center">Sin datos</p>
              )}
            </div>

            {/* Top empresas */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-medium text-gray-500 tracking-wider mb-3">Top empresas</h3>
              <div className="space-y-2.5">
                {volumen?.top_empresas.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
                )}
                {volumen?.top_empresas.map((item, idx) => (
                  <div key={item.empresa_id} className="space-y-1 animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-gray-400 w-4">{idx + 1}.</span>
                        <span className="text-[11px] font-normal text-gray-700 truncate max-w-[120px]">{item.empresa_nombre ?? `#${item.empresa_id}`}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500">{item.cantidad}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brandCustom transition-all duration-500"
                        style={{ width: `${(item.cantidad / maxEmpresa) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Heatmap de entradas */}
          <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 tracking-wider">Matriz de distribución</h3>
              <span className="text-[10px] text-gray-400">{distribucion?.total ?? 0} tickets en el periodo</span>
            </div>
            {distribucion && distribucion.por_dia_hora.length > 0 ? (
              <Heatmap cells={distribucion.por_dia_hora} height={240} />
            ) : (
              <p className="text-xs text-gray-400 py-8 text-center">Sin datos</p>
            )}
          </div>
        </section>

        {/* Sección 3: Infraestructura */}
        <section className="space-y-4">
          <h2 className="text-base font-medium text-gray-900 tracking-tight">Infraestructura</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Por elemento (donut) */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-medium text-gray-500 tracking-wider mb-3">Fallas por elemento</h3>
              {infra?.por_elemento.length ? (
                <DonutChart
                  data={infra.por_elemento.map((e) => ({
                    label: ELEMENTO_LABELS[e.elemento] ?? e.elemento,
                    value: e.cantidad,
                    color: e.elemento === "torre" ? "#ef4444" : e.elemento === "celda" ? "#f59e0b" : "#2563eb",
                  }))}
                  size={140}
                  centerLabel="total"
                  centerValue={totalElemento}
                />
              ) : (
                <p className="text-xs text-gray-400 py-8 text-center">Sin datos</p>
              )}
            </div>

            {/* Top ubicaciones */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-medium text-gray-500 tracking-wider mb-3">Top 5 ubicaciones</h3>
              <div className="space-y-2.5">
                {infra?.top_ubicaciones.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
                )}
                {infra?.top_ubicaciones.map((item, idx) => (
                  <div key={item.nombre_punto} className="space-y-1 animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-gray-400 w-4">{idx + 1}.</span>
                        <span className="text-[11px] font-normal text-gray-700 truncate max-w-[180px]">{item.nombre_punto}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500">{item.cantidad}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-grayCustom transition-all duration-500"
                        style={{ width: `${(item.cantidad / maxUbicacion) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Sección 4: Rendimiento por agente */}
      <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 sm:p-6 space-y-4">
        <h2 className="text-base font-medium text-gray-900 tracking-tight">Rendimiento por técnico</h2>
        {rendimiento?.por_agente.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
        ) : (
          <div className="space-y-4">
            {rendimiento?.por_agente.map((a, index: number) => (
              <div key={a.agente_id} className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <h3 className="text-[11px] font-medium text-gray-700 mb-3">{a.agente_nombre ?? `Agente #${a.agente_id.slice(0, 8)}`}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-brandCustom/10 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-medium text-brandCustom uppercase tracking-wider">Tickets</p>
                    <p className="text-xl font-semibold text-brandCustom mt-1">{a.asignados}</p>
                  </div>
                  <div className="bg-greenCustom/10 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-medium text-greenCustom uppercase tracking-wider">Resueltos</p>
                    <p className="text-xl font-semibold text-greenCustom mt-1">{a.resueltos}</p>
                  </div>
                  <div className="bg-grayCustom/10 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-medium text-grayCustom uppercase tracking-wider">Cerrados</p>
                    <p className="text-xl font-semibold text-grayCustom mt-1">{a.cerrados}</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-gray-400 tracking-normal mt-3">Tiempo Medio de resolución: </span>
                <span className="text-xs font-medium text-gray-500 tracking-normal mt-3">{tiempoAgente?.por_agente?.find((x) => x.agente_id === a.agente_id)?.mttr_horas}h</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección 5: Reaperturas */}
      <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-900 tracking-tight">Reaperturas de tickets</h2>
          {reaperturas && reaperturas.total_reaperturas > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-redCustom/10 px-2.5 py-1 text-xs font-semibold text-redCustom">
              {reaperturas.total_reaperturas} reapertura{reaperturas.total_reaperturas !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {reaperturas?.tickets.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin reaperturas en el periodo seleccionado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4">Ticket</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4">Título</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4">Técnico</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4">Veces reabierto</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2">Última reapertura</th>
                </tr>
              </thead>
              <tbody>
                {reaperturas?.tickets.map((t, index: number) => (
                  <tr key={t.ticket_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                    <td className="py-2.5 pr-4">
                      <Link href={`/tickets/${t.ticket_id}`} className="hover:text-brandCustom">
                        <span className="text-[11px] font-mono font-medium text-gray-500 hover:text-brandCustom">#{t.ticket_id.split("-")[0].toUpperCase()}</span>
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[11px] font-normal text-gray-700 truncate block max-w-[200px]">{t.titulo}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[11px] text-gray-500">{t.agente_nombre ?? "—"}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center  justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.veces_reabierto >= 3 ? "bg-redCustom/10 text-redCustom" : "bg-yellowCustom/10 text-yellowCustom"}`}>
                        {t.veces_reabierto}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className="text-[11px] text-gray-400">{t.fecha_reapertura}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sección 6: Cumplimiento SLA */}
      <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-gray-900 tracking-tight">Cumplimiento SLA</h2>
            {sla && (
              <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="bg-yellowCustom/5 border border-yellowCustom/20 rounded-xl p-3">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Primera Respuesta</span>
                  <p className="text-lg font-semibold text-gray-800 mt-1.5">≤ {sla.sla_objetivo_frt_horas}h</p>
                </div>
                <div className="bg-redCustom/5 border border-redCustom/20 rounded-xl p-3">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Urgente / Alta</span>
                  <p className="text-lg font-semibold text-gray-800 mt-1.5">Torre y Celda ≤ {sla.sla_objetivo_mttr_torre_celda_horas}h</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Puntos de Venta ≤ {sla.sla_objetivo_mttr_horas}h · Remotos ≤ {sla.sla_objetivo_mttr_remoto_horas}h</p>
                </div>
                <div className="bg-brandCustom/5 border border-brandCustom/20 rounded-xl p-3">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Media</span>
                  <p className="text-lg font-semibold text-gray-800 mt-1.5">≤ {sla.sla_objetivo_mttr_media_horas}h</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">4 días · para todo</p>
                </div>
                <div className="bg-grayCustom/5 border border-grayCustom/20 rounded-xl p-3">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Baja</span>
                  <p className="text-lg font-semibold text-gray-800 mt-1.5">≤ {sla.sla_objetivo_mttr_baja_horas}h</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">6 días · para todo</p>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (!sla?.por_empresa.length) return;
              const header = [
                "Empresa",
                "Tickets Totales",
                "Tickets en SLA",
                "% SLA",
                `FRT (h) [Obj: ${sla.sla_objetivo_frt_horas}h] `,
                `MTTR Urg/Alta (h) [Obj: ${sla.sla_objetivo_mttr_torre_celda_horas}h] `,
                `MTTR Media (h) [Obj: ${sla.sla_objetivo_mttr_media_horas}h] `,
                `MTTR Baja (h) [Obj: ${sla.sla_objetivo_mttr_baja_horas}h] `,
                "Tickets Mes Anterior",
                "% SLA Mes Anterior",
                "FRT Mes Anterior (h)",
                "MTTR Mes Anterior (h)",
              ].join(",");
              const rows = sla.por_empresa.map((e) => [
                `"${e.empresa_nombre ?? `#${e.empresa_id}`}"`,
                e.total_tickets,
                e.tickets_en_sla,
                e.porcentaje_sla,
                e.frt_horas ?? "",
                e.mttr_urgente_horas ?? "",
                e.mttr_media_horas ?? "",
                e.mttr_baja_horas ?? "",
                e.total_tickets_mes_anterior ?? "",
                e.porcentaje_sla_mes_anterior ?? "",
                e.frt_horas_mes_anterior ?? "",
                e.mttr_horas_mes_anterior ?? "",
              ].join(","));
              const blob = new Blob(["\uFEFF" + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `sla_${fechaInicio || "inicio"}_${fechaFin || "hoy"}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-greenCustom px-3 py-2 text-[11px] font-medium text-white hover:bg-greenCustom/80 transition-colors"
          >
            Descargar 
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-file-type-csv" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12V5a2 2 0 0 1 2-2h7l5 5v4M7 16.5a1.5 1.5 0 0 0-3 0v3a1.5 1.5 0 0 0 3 0m3 .75c0 .414.336.75.75.75H12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h1.25a.75.75 0 0 1 .75.75m3-.75 2 6 2-6"/></svg>
          </button>
        </div>
        {sla?.por_empresa.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin datos de SLA en el periodo seleccionado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4">Empresa</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4 text-center">Tickets</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4 text-center">Cumplimiento SLA</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4 text-center">% SLA</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4 text-center">TPR</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4 text-center">TMR Urg/Alta</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4 text-center">TMR Media</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 pr-4 text-center">TMR Baja</th>
                  <th className="text-[10px] font-medium text-gray-500 uppercase tracking-wider pb-2 text-center">vs Mes Ant.</th>
                </tr>
              </thead>
              <tbody>
                {sla?.por_empresa.map((e, index: number) => {
                  const pctDiff = e.porcentaje_sla_mes_anterior != null
                    ? Math.round((e.porcentaje_sla - e.porcentaje_sla_mes_anterior) * 10) / 10
                    : null;
                  return (
                    <tr key={e.empresa_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                      <td className="py-2.5 pr-4">
                        <span className="text-[11px] font-normal text-gray-700">{e.empresa_nombre ?? `#${e.empresa_id}`}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className="text-[11px] font-semibold text-gray-600">{e.total_tickets}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className="text-[11px] font-semibold text-greenCustom">{e.tickets_en_sla}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          e.porcentaje_sla >= 90 ? "bg-greenCustom/10 text-greenCustom"
                            : e.porcentaje_sla >= 70 ? "bg-yellowCustom/10 text-yellowCustom"
                            : "bg-redCustom/10 text-redCustom"
                        }`}>
                          {e.porcentaje_sla}%
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={`text-[11px] font-normal ${e.frt_horas != null && e.frt_horas <= sla!.sla_objetivo_frt_horas ? "text-greenCustom" : "text-redCustom"}`}>
                          {e.frt_horas != null ? `${e.frt_horas}h` : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={`text-[11px] font-normal ${e.mttr_urgente_horas != null && e.mttr_urgente_horas <= sla!.sla_objetivo_mttr_torre_celda_horas ? "text-greenCustom" : e.mttr_urgente_horas != null ? "text-redCustom" : "text-gray-400"}`}>
                          {e.mttr_urgente_horas != null ? `${e.mttr_urgente_horas}h` : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={`text-[11px] font-normal ${e.mttr_media_horas != null && e.mttr_media_horas <= sla!.sla_objetivo_mttr_media_horas ? "text-greenCustom" : e.mttr_media_horas != null ? "text-redCustom" : "text-gray-400"}`}>
                          {e.mttr_media_horas != null ? `${e.mttr_media_horas}h` : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center">
                        <span className={`text-[11px] font-normal ${e.mttr_baja_horas != null && e.mttr_baja_horas <= sla!.sla_objetivo_mttr_baja_horas ? "text-greenCustom" : e.mttr_baja_horas != null ? "text-redCustom" : "text-gray-400"}`}>
                          {e.mttr_baja_horas != null ? `${e.mttr_baja_horas}h` : "—"}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        {pctDiff != null ? (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${pctDiff > 0 ? "text-greenCustom" : pctDiff < 0 ? "text-redCustom" : "text-gray-400"}`}>
                            {pctDiff > 0 ? "▲" : pctDiff < 0 ? "▼" : "—"}
                            {Math.abs(pctDiff)}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
