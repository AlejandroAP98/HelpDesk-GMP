"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { ticketApi, statsApi, reportesApi, empresaApi, actividadApi, type Ticket, type PrioridadTicket, type EstadoTicket, type ElementoInfraestructura, type Stats, type Graficas, type Empresa } from "@/lib/endpoints";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { useActividadStore } from "@/store/actividadStore";

export type VistaMode = "cards" | "table";
const VISTA_STORAGE_KEY = "tickets:viewMode";

function getInitialVistaMode(): VistaMode {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(VISTA_STORAGE_KEY) === "table" ? "table" : "cards";
}

export function useDashboard() {
  const usuario = useAuthStore((s) => s.usuario);
  const [recientes, setRecientes] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, abiertos: 0, urgentes: 0, resueltos: 0, cerrados: 0, en_progreso: 0, asignados: 0 });
  const [graficas, setGraficas] = useState<Graficas | null>(null);
  const [viewMode, setViewMode] = useState<VistaMode>(getInitialVistaMode);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroEmpresaId, setFiltroEmpresaId] = useState("");
  const [estado, setEstado] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [descargando, setDescargando] = useState(false);
  const actividadItems = useActividadStore((s) => s.items);
  const setActividadItems = useActividadStore((s) => s.setItems);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const [ultimos, statsData, graficasData] = await Promise.all([
          ticketApi.listar({ size: 4 }),
          statsApi.obtener(),
          statsApi.graficas(),
        ]);
        setRecientes(ultimos.items);
        setStats(statsData);
        setGraficas(graficasData);
      } catch {
        setRecientes([]);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (usuario?.rol === "administrador" || usuario?.rol === "mesa_ayuda") {
      actividadApi.listar(20).then(setActividadItems).catch(() => {});
    }
  }, [usuario?.rol, setActividadItems]);

  const setOnTicketCreated = useWsTicketStore((s) => s.setOnTicketCreated);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const empresaId = usuario?.empresa_id;

  useEffect(() => {
    setOnTicketCreated((ev) => {
      if (usuario?.rol === "agente") return;
      if (usuario?.rol === "cliente" && empresaId != null && ev.empresa_id !== empresaId) return;
      setRecientes((prev) => {
        if (prev.some((t) => t.id === ev.ticket_id)) return prev;
        const nuevo: Ticket = {
          id: ev.ticket_id,
          empresa_id: ev.empresa_id,
          empresa_nombre: ev.empresa_nombre ?? null,
          titulo: ev.titulo,
          descripcion: "",
          categoria_id: ev.categoria_id ?? 0,
          subcategoria_id: ev.subcategoria_id ?? 0,
          elemento_afectado: (ev.elemento_afectado as ElementoInfraestructura) ?? "torre",
          nombre_punto: ev.nombre_punto ?? null,
          prioridad: ev.prioridad as PrioridadTicket,
          estado: ev.estado as EstadoTicket,
          cliente_id: ev.cliente_id ?? "",
          agente_id: ev.agente_id,
          modificado_por_id: null,
          modificado_por_nombre: null,
          fecha_creacion: ev.fecha_actualizacion,
          fecha_actualizacion: ev.fecha_actualizacion,
          ip_pcs: null,
          ip_antena: null,
          mascara_red: null,
          puerta_enlace: null,
        };
        return [nuevo, ...prev].slice(0, 5);
      });
      setStats((s) => ({ ...s, total: s.total + 1 }));
      if (ev.estado === "abierto") setStats((s) => ({ ...s, abiertos: s.abiertos + 1 }));
      if (ev.prioridad === "urgente") setStats((s) => ({ ...s, urgentes: s.urgentes + 1 }));
    });

    setOnTicketUpdated((ev) => {
      setRecientes((prev) =>
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

  useEffect(() => {
    if (usuario?.rol === "administrador" || usuario?.rol === "mesa_ayuda") {
      empresaApi.listar({ size: 100 }).then((r) => setEmpresas(r.items)).catch(() => {});
    }
  }, [usuario?.rol]);

  const handleDescargar = async () => {
    setDescargando(true);
    try {
      const params: Record<string, string> = {};
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;
      if (filtroEmpresaId) params.empresa_id = filtroEmpresaId;
      if (estado) params.estado = estado;
      if (prioridad) params.prioridad = prioridad;
      await reportesApi.descargarCSV(params);
    } catch {
      console.error("Error al descargar el reporte");
    } finally {
      setDescargando(false);
    }
  };

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setFiltroEmpresaId("");
    setEstado("");
    setPrioridad("");
  };

  const hayFiltros = fechaInicio || fechaFin || filtroEmpresaId || estado || prioridad;

  const esCliente = usuario?.rol === "cliente";
  const esAgente = usuario?.rol === "agente";

  const cambiarModo = (modo: VistaMode) => {
    setViewMode(modo);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VISTA_STORAGE_KEY, modo);
    }
  };

  return {
    usuario, recientes, cargando, stats, graficas, viewMode, cambiarModo,
    fechaInicio, setFechaInicio, fechaFin, setFechaFin,
    filtroEmpresaId, setFiltroEmpresaId, estado, setEstado, prioridad, setPrioridad,
    empresas, descargando, handleDescargar, limpiarFiltros, hayFiltros,
    esCliente, esAgente, actividadItems,
  };
}
