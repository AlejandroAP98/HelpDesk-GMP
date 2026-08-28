"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ticketApi, adminApi, empresaApi, type Ticket, type Empresa, type EstadoTicket, type PrioridadTicket, type VistaTicket } from "@/lib/endpoints";
import type { Usuario } from "@/store/authStore";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { useAuthStore } from "@/store/authStore";
import { EstadoBadge, PrioridadBadge, TotalBadge } from "@/components/Badges";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { TicketCard } from "@/components/TicketCard";
import NewTicketIcon from "@/app/assets/icons/NewTicketIcon";


const ESTADOS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "abierto", label: "Abierto" },
  { value: "asignado", label: "Asignado" },
  { value: "en_progreso", label: "En progreso" },
  { value: "resuelto", label: "Resuelto" },
  { value: "cerrado", label: "Cerrado" },
];

const PRIORIDADES: { value: string; label: string }[] = [
  { value: "todas", label: "Todos" },
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const VISTAS: { value: VistaTicket; label: string }[] = [
  { value: "activos", label: "Activos" },
  { value: "historial", label: "Historial" },
  { value: "todos", label: "Todos" },
];

const ESTADOS_POR_VISTA: Record<VistaTicket, { value: string; label: string }[]> = {
  activos: [
    { value: "todos", label: "Todos" },
    { value: "abierto", label: "Abierto" },
    { value: "asignado", label: "Asignado" },
    { value: "en_progreso", label: "En progreso" },
  ],
  historial: [
    { value: "todos", label: "Todos" },
    { value: "resuelto", label: "Resuelto" },
    { value: "cerrado", label: "Cerrado" },
  ],
  todos: ESTADOS,
};

type VistaMode = "cards" | "table";
type OrdenMode = "prioridad" | "fecha";
const VISTA_STORAGE_KEY = "tickets:viewMode";
const ORDEN_STORAGE_KEY = "tickets:ordenMode";

function getInitialVistaMode(): VistaMode {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(VISTA_STORAGE_KEY) === "table" ? "table" : "cards";
}

function getInitialOrdenMode(): OrdenMode {
  if (typeof window === "undefined") return "prioridad";
  return window.localStorage.getItem(ORDEN_STORAGE_KEY) === "fecha" ? "fecha" : "prioridad";
}

export default function TicketsListPage() {
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
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [agentes, setAgentes] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const setOnTicketAssigned = useWsTicketStore((s) => s.setOnTicketAssigned);
  const usuario = useAuthStore((s) => s.usuario);

  const esAdminOMesaAyuda = usuario?.rol === "administrador" || usuario?.rol === "mesa_ayuda";

  useEffect(() => {
    if (esAdminOMesaAyuda) {
      Promise.all([
        empresaApi.listar({ size: 100 }),
        adminApi.listarUsuarios({ rol: "agente", size: 100 }),
        adminApi.listarUsuarios({ rol: "mesa_ayuda", size: 100 }),
      ]).then(([empresasRes, agentesRes, mesasRes]) => {
        setEmpresas(empresasRes.items);
        setAgentes([...agentesRes.items, ...mesasRes.items]);
      }).catch(() => {});
    }
  }, [esAdminOMesaAyuda]);

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
  }, [page, estado, prioridad, vista, fechaInicio, fechaFin, orden, filtroEmpresaId, filtroAgenteId, busquedaDebounced]);

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

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-7rem)] justify-between gap-2">
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Tickets"
          subtitle={`Hola, ${usuario?.nombre?.split(" ")[0]}, gestiona tus tickets aquí`}
          actions={
            usuario?.rol !== 'agente' ? (
              <Link href="/tickets/nuevo">
                <Button
                  className="text-nowrap text-xs sm:text-sm"
                  variant="primary"
                  disabled={cargando}
                  icon={<NewTicketIcon />}
                >
                  Nuevo ticket
                </Button>
              </Link>
            ) : undefined
          }
        />  
        <div className="flex gap-4 flex-col-reverse justify-between">
          <div className="flex rounded-lg sm:gap-8 gap-2 justify-between items-end">
            <div className="flex items-center gap-1">
              <div className="flex w-fit border-b border-grayCustom/50 bg-grayCustom/10 gap-0 rounded-lg h-fit">
              {VISTAS.map((v) => (
              <button
                key={v.value}
                onClick={() => cambiarVista(v.value)}
                className={`px-4 py-1.5 text-xs transition-all duration-100 ease-in rounded-md font-normal last:border-none border-grayCustom ${
                  vista === v.value
                    ? "bg-brandCustom text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {v.label}
              </button>
            ))}
            </div>
            <button
                onClick={cambiarOrden}
                title={orden === "prioridad" ? "Ordenar por fecha" : "Ordenar por prioridad"}
                className="p-1.5 rounded-md transition-all text-grayCustom/90 hover:text-brandCustom hover:bg-brandCustom/10"
              >
                {orden === "fecha" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="m4 15 3 3 3-3M7 6v12m7-13a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zm3 9-3.5 6h7z"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="m4 15 3 3 3-3M7 6v12M17 3a2 2 0 0 1 2 2v3a2 2 0 1 1-4 0V5a2 2 0 0 1 2-2m-2 13a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/><path d="M19 16v3a2 2 0 0 1-2 2h-1.5"/></svg>
                  )}
            </button>
            </div>
            <div className="flex w-fit border-b border-brandCustom/50 bg-grayCustom/10 rounded-lg h-fit self-end gap-1">
              <button
                onClick={() => cambiarModo("cards")}
                title="Vista tarjetas"
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "cards"
                    ? "bg-brandCustom text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-layout-grid" viewBox="0 0 24 24"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>
              </button>
              <button
                onClick={() => cambiarModo("table")}
                title="Vista tabla"
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "table"
                    ? "bg-brandCustom text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-table" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
              </button>
            </div>
          </div>
          <div className="flex flex-col-reverse 2xl:flex-row w-full gap-2 justify-between">
            <div className="relative flex sm:max-w-sm w-full 2xl:mt-4 self-start">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por #ticket o titulo..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:font-regular placeholder-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brandCustom focus:bg-white outline-none transition-all"
              />
              {busqueda && (
                <button
                  onClick={() => { setBusqueda(""); setBusquedaDebounced(""); setPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            <div className="grid xl:flex grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1 w-full xl:justify-end">
              <Select
                label="Estado"
                value={estado}
                onChange={(e) => { setEstado(e.target.value); setPage(1); }}
                options={ESTADOS_POR_VISTA[vista]}
              />
              <Select
                label="Prioridad"
                value={prioridad}
                onChange={(e) => { setPrioridad(e.target.value); setPage(1); }}
                options={PRIORIDADES}
              />
              {esAdminOMesaAyuda && (
                <Select
                  label="Empresa"
                  value={filtroEmpresaId}
                  onChange={(e) => { setFiltroEmpresaId(e.target.value); setPage(1); }}
                  options={[{ value: "", label: "Todas" }, ...empresas.map((e) => ({ value: String(e.id), label: e.nombre }))]}
                />
              )}
              {esAdminOMesaAyuda && (
                <Select
                  label="Agente"
                  value={filtroAgenteId}
                  onChange={(e) => { setFiltroAgenteId(e.target.value); setPage(1); }}
                  options={[{ value: "", label: "Todos" }, ...agentes.map((a) => ({ value: a.id, label: a.nombre }))]}
                />
              )}
              <div className="flex flex-col">
                <label className="sm:text-[11px] text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">
                  Desde
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => { setFechaInicio(e.target.value); setPage(1); }}
                  className="rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50 text-gray-700 px-2.5 py-2 text-xs focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer"
                />
              </div>
              <div className="flex flex-col">
                <label className="sm:text-[11px] text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">
                  Hasta
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => { setFechaFin(e.target.value); setPage(1); }}
                  className="rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50 text-gray-700 px-2.5 py-2 text-xs focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer"
                />
              </div>
              <TotalBadge total={total} />
              {hayFiltrosFecha && (
                <button
                  onClick={limpiarFiltrosFecha}
                  className="text-xs self-end text-gray-500 hover:text-gray-800 underline transition-colors mb-0.5"
                >
                  Limpiar fechas
                </button>
              )}
            </div>
          </div>
        </div>
        {cargando ? (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <LoadingState />
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState message="No hay tickets para estos filtros." />
        ) : viewMode === "table" ? (
        <DataTable
          columns={[
            {
              key: "ticket_number",
              header: "# Ticket",
              cell: (t: Ticket) => (
                <Link
                  href={`/tickets/${t.id}`}
                  title={`Ver ticket: ${t.titulo}`}
                  className="font-normal text-xs text-gray-500 hover:text-brandCustom transition-colors uppercase"
                >
                  #{t.id.split('-')[0].toUpperCase()}
                </Link>
              ),
            },
            {
              key: "titulo",
              header: "Información",
              cell: (t: Ticket) => (
                <Link
                  href={`/tickets/${t.id}`}
                  title={`Ver ticket: ${t.titulo}`}
                  className="flex flex-col gap-0.5 hover:text-brandCustom transition-colors"
                >
                  <span className="font-medium text-gray-800 text-sm capitalize">
                    {t.titulo.length > 30 ? `${t.titulo.substring(0, 30)}...` : t.titulo}
                  </span>
                  <span className="text-gray-500 text-[10px] line-clamp-1">
                    {t.descripcion.length > 60 ? `${t.descripcion.substring(0, 60)}...` : t.descripcion}
                  </span>
                  <span className="text-gray-400 text-[9px] mt-0.5">
                    {new Date(t.fecha_creacion).toLocaleDateString(undefined, {
                      timeZone: "America/Bogota",
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </Link>
              ),
            },
            {
              key: "empresa_nombre",
              header: "Empresa",
              cell: (t: Ticket) => (
                <span className="text-gray-500 sm:text-xs text-[10px]">
                  {t.empresa_nombre}
                </span>
              ),
            },
            {
              key: "estado",
              header: "Estado",
              cell: (t: Ticket) => <EstadoBadge estado={t.estado} />,
            },
            {
              key: "prioridad",
              header: "Prioridad",
              cell: (t: Ticket) => <PrioridadBadge prioridad={t.prioridad} estado={t.estado} />,
            },
            {
              key: "asignado",
              header: "Asignado",
              cell: (t: Ticket) => (
                <span className={`text-gray-500 sm:text-xs text-[10px] ${!t.agente_nombre ? "text-redCustom" : "text-bgSiderBar"}`}>
                  {t.agente_nombre ? t.agente_nombre : "Sin asignar"}
                </span>
              ),
            },
          ]}
          data={tickets}
          keyExtractor={(t: Ticket) => t.id}
        />
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tickets.map((t: Ticket, index: number) => (
            <TicketCard key={t.id} ticket={t} index={index} />
          ))}
        </div>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
