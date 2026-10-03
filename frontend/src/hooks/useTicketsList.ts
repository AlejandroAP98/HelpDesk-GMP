"use client";

import { useEffect, useRef, useState } from "react";
import { ticketApi, adminApi, empresaApi, puntoVentaApi, type Ticket, type Empresa, type PuntoVenta, type EstadoTicket, type PrioridadTicket, type VistaTicket } from "@/lib/endpoints";
import type { Usuario } from "@/store/authStore";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { useAuthStore } from "@/store/authStore";

export type VistaMode = "cards" | "table";
export type OrdenMode = "prioridad" | "fecha";

const VISTA_STORAGE_KEY = "tickets:viewMode";
const ORDEN_STORAGE_KEY = "tickets:ordenMode";

export function getInitialVistaMode(): VistaMode {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(VISTA_STORAGE_KEY) === "table" ? "table" : "cards";
}

function getInitialOrdenMode(): OrdenMode {
  if (typeof window === "undefined") return "prioridad";
  return window.localStorage.getItem(ORDEN_STORAGE_KEY) === "fecha" ? "fecha" : "prioridad";
}

export function useTicketsList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState("todos");
  const [prioridad, setPrioridad] = useState("todas");
  const [vista, setVista] = useState<VistaTicket>("activos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [cargando, setCargando] = useState(true);
  const [viewMode, setViewMode] = useState<VistaMode>(getInitialVistaMode);
  const [orden, setOrden] = useState<OrdenMode>(getInitialOrdenMode);
  const [filtroEmpresaId, setFiltroEmpresaId] = useState("");
  const [filtroAgenteId, setFiltroAgenteId] = useState("");
  const [filtroPuntoVentaId, setFiltroPuntoVentaId] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [agentes, setAgentes] = useState<Usuario[]>([]);
  const [pvResults, setPvResults] = useState<PuntoVenta[]>([]);
  const [pvSearch, setPvSearch] = useState("");
  const [pvSearchDebounced, setPvSearchDebounced] = useState("");
  const [pvLoading, setPvLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pvDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const setOnTicketAssigned = useWsTicketStore((s) => s.setOnTicketAssigned);
  const usuario = useAuthStore((s) => s.usuario);

  const esAdminOMesaAyuda = usuario?.rol === "administrador" || usuario?.rol === "mesa_ayuda";

  useEffect(() => {
    if (esAdminOMesaAyuda) {
      Promise.all([
        empresaApi.listar({ size: 100 }),
        adminApi.listarUsuarios({ rol: "agente", size: 100, activo: true }),
        adminApi.listarUsuarios({ rol: "mesa_ayuda", size: 100, activo: true }),
      ]).then(([empresasRes, agentesRes, mesasRes]) => {
        setEmpresas(empresasRes.items);
        setAgentes([...agentesRes.items, ...mesasRes.items]);
      }).catch(() => {});
    }
  }, [esAdminOMesaAyuda]);

  useEffect(() => {
    if (pvDebounceRef.current) clearTimeout(pvDebounceRef.current);
    pvDebounceRef.current = setTimeout(() => {
      setPvSearchDebounced(pvSearch.trim());
    }, 300);
    return () => { if (pvDebounceRef.current) clearTimeout(pvDebounceRef.current); };
  }, [pvSearch]);

  useEffect(() => {
    if (usuario?.rol === "agente") return;
    let cancelado = false;
    const empresaEfectiva = usuario?.rol === "cliente"
      ? usuario.empresa_id
      : (filtroEmpresaId ? Number(filtroEmpresaId) : null);
    const buscar = async () => {
      try {
        setPvLoading(true);
        const r = await puntoVentaApi.listar({
          empresa_id: empresaEfectiva ?? undefined,
          q: pvSearchDebounced || undefined,
          size: 50,
          activo: true,
        });
        if (!cancelado) {
          setPvResults(r.items);
        }
      } catch {
        if (!cancelado) setPvResults([]);
      } finally {
        if (!cancelado) setPvLoading(false);
      }
    };
    buscar();
    return () => { cancelado = true; };
  }, [pvSearchDebounced, filtroEmpresaId, usuario?.rol, usuario?.empresa_id]);

  useEffect(() => {
    setFiltroPuntoVentaId("");
    setPvSearch("");
    setPvSearchDebounced("");
  }, [filtroEmpresaId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBusquedaDebounced(busqueda.trim());
      setPage(1);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [busqueda]);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const params: Record<string, unknown> = { page, size: 12 };
        if (vista !== "todos") params.vista = vista;
        if (estado !== "todos") params.estado = estado;
        if (prioridad !== "todas") params.prioridad = prioridad;
        if (fechaInicio) params.fecha_inicio = fechaInicio;
        if (fechaFin) params.fecha_fin = fechaFin;
        if (orden === "fecha") params.orden = "fecha";
        if (filtroEmpresaId) params.empresa_id = filtroEmpresaId;
        if (filtroAgenteId) params.agente_id = filtroAgenteId;
        if (filtroPuntoVentaId) params.punto_venta_id = filtroPuntoVentaId;
        if (busquedaDebounced.length >= 2) params.q = busquedaDebounced;
        const data = await ticketApi.listar(params);
        setTickets(data.items);
        setTotal(data.total);
        setTotalPages(data.pages);
      } catch {
        setTickets([]);
        setTotal(0);
      } finally {
        setCargando(false);
      }
    })();
  }, [page, estado, prioridad, vista, fechaInicio, fechaFin, orden, filtroEmpresaId, filtroAgenteId, filtroPuntoVentaId, busquedaDebounced]);

  const hayFiltrosFecha = fechaInicio || fechaFin;
  const limpiarFiltrosFecha = () => {
    setFechaInicio("");
    setFechaFin("");
    setPage(1);
  };

  useEffect(() => {
    setOnTicketUpdated((ev) => {
      setTickets((prev) =>
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

    setOnTicketAssigned((ev) => {
      if (ev.agente_id !== usuario?.id) return;
      setTickets((prev) => {
        if (prev.some((t) => t.id === ev.ticket_id)) return prev;
        const nuevo: Ticket = {
          id: ev.ticket_id,
          empresa_id: ev.empresa_id,
          empresa_nombre: ev.empresa_nombre ?? null,
          titulo: ev.titulo,
          descripcion: "",
          categoria_id: 0,
          subcategoria_id: 0,
          elemento_afectado: "punto_venta",
          ip_pcs: null,
          ip_antena: null,
          mascara_red: null,
          puerta_enlace: null,
          nombre_punto: null,
          punto_venta_id: null,
          prioridad: ev.prioridad as PrioridadTicket,
          estado: ev.estado as EstadoTicket,
          cliente_id: ev.cliente_id ?? "",
          agente_id: ev.agente_id,
          modificado_por_id: null,
          modificado_por_nombre: null,
          fecha_creacion: ev.fecha_actualizacion,
          fecha_actualizacion: ev.fecha_actualizacion,
        };
        return [nuevo, ...prev];
      });
    });

    return () => {
      setOnTicketUpdated(null);
      setOnTicketAssigned(null);
    };
  }, [setOnTicketUpdated, setOnTicketAssigned, usuario?.id]);

  const cambiarVista = (nueva: VistaTicket) => {
    setVista(nueva);
    setEstado("todos");
    setPage(1);
  };

  const cambiarModo = (modo: VistaMode) => {
    setViewMode(modo);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VISTA_STORAGE_KEY, modo);
    }
  };

  const cambiarOrden = () => {
    const nuevoOrden = orden === "prioridad" ? "fecha" : "prioridad";
    setOrden(nuevoOrden);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ORDEN_STORAGE_KEY, nuevoOrden);
    }
  };

  const limpiarBusqueda = () => {
    setBusqueda("");
    setBusquedaDebounced("");
    setPage(1);
  };

  const limpiarTodo = () => {
    setEstado("todos");
    setPrioridad("todas");
    setFiltroEmpresaId("");
    setFiltroAgenteId("");
    setFiltroPuntoVentaId("");
    setFechaInicio("");
    setFechaFin("");
    setPage(1);
    setPvSearch("");
  };

  const activeFilterCount =
    (estado !== "todos" ? 1 : 0) +
    (prioridad !== "todas" ? 1 : 0) +
    (filtroEmpresaId ? 1 : 0) +
    (filtroAgenteId ? 1 : 0) +
    (filtroPuntoVentaId ? 1 : 0) +
    (fechaInicio ? 1 : 0) +
    (fechaFin ? 1 : 0);

  return {
    tickets, total, totalPages, page, setPage,
    estado, setEstado, prioridad, setPrioridad, vista,
    fechaInicio, setFechaInicio, fechaFin, setFechaFin,
    cargando, viewMode, orden,
    filtroEmpresaId, setFiltroEmpresaId, filtroAgenteId, setFiltroAgenteId,
    filtroPuntoVentaId, setFiltroPuntoVentaId,
    empresas, agentes, pvResults, pvSearch, setPvSearch, pvLoading,
    busqueda, setBusqueda,
    hayFiltrosFecha, limpiarFiltrosFecha, limpiarBusqueda, limpiarTodo,
    activeFilterCount,
    cambiarVista, cambiarModo, cambiarOrden,
    usuario, esAdminOMesaAyuda,
  };
}
