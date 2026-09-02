"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { metricasApi, statsApi, type MetricasTiempos, type MetricasVolumen, type MetricasInfraestructura, type MetricasRendimiento, type MetricasTiempoPorAgente, type MetricasReaperturas, type MetricasSLA, type Graficas } from "@/lib/endpoints";

export function useMetricas() {
  const usuario = useAuthStore((s) => s.usuario);
  const router = useRouter();
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [cargando, setCargando] = useState(true);
  const [tiempos, setTiempos] = useState<MetricasTiempos | null>(null);
  const [volumen, setVolumen] = useState<MetricasVolumen | null>(null);
  const [infra, setInfra] = useState<MetricasInfraestructura | null>(null);
  const [rendimiento, setRendimiento] = useState<MetricasRendimiento | null>(null);
  const [tiempoAgente, setTiempoAgente] = useState<MetricasTiempoPorAgente | null>(null);
  const [reaperturas, setReaperturas] = useState<MetricasReaperturas | null>(null);
  const [sla, setSla] = useState<MetricasSLA | null>(null);
  const [graficas, setGraficas] = useState<Graficas | null>(null);

  const hayFiltros = fechaInicio || fechaFin;

  useEffect(() => {
    if (usuario && usuario.rol !== "administrador" && usuario.rol !== "mesa_ayuda") {
      router.replace("/");
    }
  }, [usuario, router]);

  useEffect(() => {
    if (usuario?.rol !== "administrador" && usuario?.rol !== "mesa_ayuda") return;
    (async () => {
      setCargando(true);
      try {
        const params: Record<string, string> = {};
        if (fechaInicio) params.fecha_inicio = fechaInicio;
        if (fechaFin) params.fecha_fin = fechaFin;
        const [t, v, i, r, ta, rp, sl, gf] = await Promise.all([
          metricasApi.tiempos(params),
          metricasApi.volumen(params),
          metricasApi.infraestructura(params),
          metricasApi.rendimientoAgente(params),
          metricasApi.tiempoPorAgente(params),
          metricasApi.reaperturas(params),
          metricasApi.sla(params),
          statsApi.graficas(),
        ]);
        setTiempos(t);
        setVolumen(v);
        setInfra(i);
        setRendimiento(r);
        setTiempoAgente(ta);
        setReaperturas(rp);
        setSla(sl);
        setGraficas(gf);
      } catch {
        console.error("Error al cargar las métricas");
      } finally {
        setCargando(false);
      }
    })();
  }, [usuario?.rol, fechaInicio, fechaFin]);

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
  };

  return {
    usuario, fechaInicio, setFechaInicio, fechaFin, setFechaFin,
    cargando, hayFiltros, limpiarFiltros,
    tiempos, volumen, infra, rendimiento, tiempoAgente, reaperturas, sla, graficas,
  };
}
