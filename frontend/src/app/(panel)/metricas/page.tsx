"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { metricasApi, type MetricasTiempos, type MetricasVolumen, type MetricasInfraestructura } from "@/lib/endpoints";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatsCard } from "@/components/ui/StatsCard";
import TicketSolvedIcon from "@/app/assets/icons/TicketSolvedIcon";

const ESTADO_COLORS: Record<string, string> = {
  abierto: "bg-blue-500",
  asignado: "bg-violet-500",
  en_progreso: "bg-yellow-500",
  resuelto: "bg-green-500",
  cerrado: "bg-gray-500",
};

const ESTADO_LABELS: Record<string, string> = {
  abierto: "Abierto",
  asignado: "Asignado",
  en_progreso: "En Progreso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

const PRIORIDAD_COLORS: Record<string, string> = {
  urgente: "bg-redCustom",
  alta: "bg-yellowCustom",
  media: "bg-blueCustom",
  baja: "bg-grayCustom",
};

const PRIORIDAD_LABELS: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const ELEMENTO_LABELS: Record<string, string> = {
  torre: "Torre",
  celda: "Celda",
  mastil: "Mástil",
  punto_venta: "Punto de Venta",
};

export default function MetricasPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const router = useRouter();
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [cargando, setCargando] = useState(true);
  const [tiempos, setTiempos] = useState<MetricasTiempos | null>(null);
  const [volumen, setVolumen] = useState<MetricasVolumen | null>(null);
  const [infra, setInfra] = useState<MetricasInfraestructura | null>(null);

  useEffect(() => {
    if (usuario && usuario.rol !== "administrador") {
      router.replace("/");
    }
  }, [usuario, router]);

  useEffect(() => {
    if (usuario?.rol !== "administrador") return;
    (async () => {
      setCargando(true);
      try {
        const params: Record<string, string> = {};
        if (fechaInicio) params.fecha_inicio = fechaInicio;
        if (fechaFin) params.fecha_fin = fechaFin;
        const [t, v, i] = await Promise.all([
          metricasApi.tiempos(params),
          metricasApi.volumen(params),
          metricasApi.infraestructura(params),
        ]);
        setTiempos(t);
        setVolumen(v);
        setInfra(i);
      } catch {
        /* ignore */
      } finally {
        setCargando(false);
      }
    })();
  }, [usuario?.rol, fechaInicio, fechaFin]);

  if (usuario?.rol !== "administrador") return null;
  if (cargando) return <LoadingState />;

  const maxEstado = Math.max(1, ...(volumen?.por_estado.map((e) => e.cantidad) ?? [1]));
  const maxPrioridad = Math.max(1, ...(volumen?.por_prioridad.map((p) => p.cantidad) ?? [1]));
  const maxEmpresa = Math.max(1, ...(volumen?.top_empresas.map((e) => e.cantidad) ?? [1]));
  const maxElemento = Math.max(1, ...(infra?.por_elemento.map((e) => e.cantidad) ?? [1]));
  const maxUbicacion = Math.max(1, ...(infra?.top_ubicaciones.map((u) => u.cantidad) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Métricas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Indicadores de rendimiento y análisis de tickets
          </p>
        </div>
      </div>

      <div className="rounded-2xl flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="flex flex-col">
          <label className="text-[10px] font-semibold text-gray-500 tracking-wider mb-1">Fecha inicio</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white text-gray-700 text-xs px-3 py-2 focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-semibold text-gray-500 tracking-wider mb-1">Fecha fin</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white text-gray-700 text-xs px-3 py-2 focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
          />
        </div>
        {(fechaInicio || fechaFin) && (
          <button
            onClick={() => { setFechaInicio(""); setFechaFin(""); }}
            className="text-xs text-gray-500 hover:text-gray-800 underline transition-colors mb-0.5"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      
      <div className="space-y-6 bg-cardCustom rounded-2xl p-4 sm:p-6">
        {/* Sección 1: Tiempos */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Tiempos de respuesta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard
              label="Tiempo Medio de Resolución"
              value={tiempos?.mttr_horas != null ? `${tiempos.mttr_horas}h` : "—"}
              icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" className="icon icon-tabler icons-tabler-outline icon-tabler-alarm-average" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M5 13a7 7 0 1 0 14 0 7 7 0 0 0-14 0m2-9L4.25 6M17 4l2.75 2"/><path d="M8 13h1l2 3 2-6 2 3h1"/></svg>}
              className="bg-brandCustom"
            />
            <StatsCard
              label="Primera Respuesta"
              value={tiempos?.tiempo_primera_respuesta_minutos != null ? `${tiempos.tiempo_primera_respuesta_minutos}min` : "—"}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" className="icon icon-tabler icons-tabler-outline icon-tabler-message-reply" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/><path d="m11 8-3 3 3 3m5-3H8"/></svg>}
              className="bg-yellowCustom"
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" className="icon icon-tabler icons-tabler-outline icon-tabler-message" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M8 9h8m-8 4h6m4-9a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/></svg>}
              className="bg-violetCustom"
            />
          </div>
        </section>

        {/* Sección 2: Volumen */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Volumen de tickets</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Por estado */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-semibold text-gray-500 tracking-wider mb-3">Por estado</h3>
              <div className="space-y-2.5">
                {volumen?.por_estado.map((item) => (
                  <div key={item.estado} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-medium text-gray-700">{ESTADO_LABELS[item.estado] ?? item.estado}</span>
                      <span className="text-[11px] font-bold text-gray-500">{item.cantidad}</span>
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

            {/* Por prioridad */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-semibold text-gray-500 tracking-wider mb-3">Por prioridad</h3>
              <div className="space-y-2.5">
                {volumen?.por_prioridad.map((item) => (
                  <div key={item.prioridad} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-medium text-gray-700">{PRIORIDAD_LABELS[item.prioridad] ?? item.prioridad}</span>
                      <span className="text-[11px] font-bold text-gray-500">{item.cantidad}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${PRIORIDAD_COLORS[item.prioridad] ?? "bg-gray-300"}`}
                        style={{ width: `${(item.cantidad / maxPrioridad) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top empresas */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-semibold text-gray-500 tracking-wider mb-3">Top empresas</h3>
              <div className="space-y-2.5">
                {volumen?.top_empresas.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
                )}
                {volumen?.top_empresas.map((item, idx) => (
                  <div key={item.empresa_id} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 w-4">{idx + 1}.</span>
                        <span className="text-[11px] font-medium text-gray-700 truncate max-w-[120px]">{item.empresa_nombre ?? `#${item.empresa_id}`}</span>
                      </div>
                      <span className="text-[11px] font-bold text-gray-500">{item.cantidad}</span>
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
        </section>

        {/* Sección 3: Infraestructura */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Infraestructura</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Por elemento */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-semibold text-gray-500 tracking-wider mb-3">Fallas por elemento</h3>
              <div className="space-y-2.5">
                {infra?.por_elemento.map((item) => (
                  <div key={item.elemento} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-medium text-gray-700">{ELEMENTO_LABELS[item.elemento] ?? item.elemento}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400">{item.porcentaje}%</span>
                        <span className="text-[11px] font-bold text-gray-500">{item.cantidad}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accentCustom transition-all duration-500"
                        style={{ width: `${(item.cantidad / maxElemento) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top ubicaciones */}
            <div className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
              <h3 className="text-xs font-semibold text-gray-500 tracking-wider mb-3">Top 5 ubicaciones</h3>
              <div className="space-y-2.5">
                {infra?.top_ubicaciones.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>
                )}
                {infra?.top_ubicaciones.map((item, idx) => (
                  <div key={item.nombre_punto} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 w-4">{idx + 1}.</span>
                        <span className="text-[11px] font-medium text-gray-700 truncate max-w-[180px]">{item.nombre_punto}</span>
                      </div>
                      <span className="text-[11px] font-bold text-gray-500">{item.cantidad}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-redCustom transition-all duration-500"
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
      
    </div>
  );
}
