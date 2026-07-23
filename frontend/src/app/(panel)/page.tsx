"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { ticketApi, statsApi, reportesApi, empresaApi, type Ticket, type PrioridadTicket, type EstadoTicket, type Stats, type Empresa } from "@/lib/endpoints";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { EstadoBadge, PrioridadBadge } from "@/components/Badges";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable } from "@/components/ui/Table";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import NewTicketIcon from "../assets/icons/NewTicketIcon";
import TicketIcon from "../assets/icons/TicketIcon";
import TicketOpenedIcon from "../assets/icons/TicketOpenedIcon";
import TicketAlertIcon from "../assets/icons/TicketAlertIcon";
import TicketSolvedIcon from "../assets/icons/TicketSolvedIcon";
import TicketClosedIcon from "../assets/icons/TicketClosedIcon";
import TicketProgressIcon from "../assets/icons/TicketProgressIcon";
import AssingUserIcon from "../assets/icons/AssignUserIcon";

type VistaMode = "cards" | "table";
const VISTA_STORAGE_KEY = "tickets:viewMode";

function getInitialVistaMode(): VistaMode {
  if (typeof window === "undefined") return "cards";
  return window.localStorage.getItem(VISTA_STORAGE_KEY) === "table" ? "table" : "cards";
}

export default function PanelHomePage() {
  const usuario = useAuthStore((s) => s.usuario);
  const [recientes, setRecientes] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, abiertos: 0, urgentes: 0, resueltos: 0, cerrados: 0, en_progreso: 0, asignados: 0 });
  const [viewMode, setViewMode] = useState<VistaMode>(getInitialVistaMode);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroEmpresaId, setFiltroEmpresaId] = useState("");
  const [estado, setEstado] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const [ultimos, statsData] = await Promise.all([
          ticketApi.listar({ size: 5 }),
          statsApi.obtener(),
        ]);
        setRecientes(ultimos.items);
        setStats(statsData);
      } catch {
        setRecientes([]);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const setOnTicketCreated = useWsTicketStore((s) => s.setOnTicketCreated);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const empresaId = usuario?.empresa_id;

  useEffect(() => {
    setOnTicketCreated((ev) => {
      if (usuario?.rol === "cliente" && empresaId != null && ev.empresa_id !== empresaId) return;
      setRecientes((prev) => {
        if (prev.some((t) => t.id === ev.ticket_id)) return prev;
        const nuevo: Ticket = {
          id: ev.ticket_id,
          empresa_id: ev.empresa_id,
          titulo: ev.titulo,
          descripcion: "",
          categoria_id: 0,
          prioridad: ev.prioridad as PrioridadTicket,
          estado: ev.estado as EstadoTicket,
          cliente_id: ev.cliente_id ?? "",
          agente_id: ev.agente_id,
          modificado_por_id: null,
          modificado_por_nombre: null,
          fecha_creacion: ev.fecha_actualizacion,
          fecha_actualizacion: ev.fecha_actualizacion,
          subcategoria_id: 0,
          elemento_afectado: "torre",
          ip_pcs: null,
          ip_antena: null,
          mascara_red: null,
          puerta_enlace: null,
          nombre_punto: null,
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
    if (usuario?.rol === "administrador" || usuario?.rol === "agente" || usuario?.rol === "mesa_ayuda") {
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
  
  const cambiarModo = (modo: VistaMode) => {
    setViewMode(modo);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VISTA_STORAGE_KEY, modo);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Hola, {usuario?.nombre?.split(" ")[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {usuario?.rol === "cliente" && "Gestiona tus tickets de soporte"}
            {usuario?.rol === "agente" && "Revisa y resuelve tus tickets asignados"}
            {usuario?.rol === "mesa_ayuda" && "Supervisa, asigna y mide el rendimiento del equipo"}
            {usuario?.rol === "administrador" && "Panel de administracion y control global"}
          </p>
        </div>
        {esCliente && (
          <Link href="/tickets/nuevo">
            <Button>
              <NewTicketIcon />
              Nuevo ticket
            </Button>
          </Link>
        )}
      </div>
      <section className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-7 md:gap-4 gap-2 bg-cardCustom p-4 sm:p-6 rounded-2xl items-center animate-fadeIn">
        <StatsCard label="Total tickets" value={stats.total} icon={<TicketIcon />}  className="bg-brandCustom animate-scale-in " />
        <StatsCard label="Abiertos" value={stats.abiertos} icon={<TicketOpenedIcon />}  className="animate-scale-in bg-blueCustom " />
        {
          stats.urgentes > 0 ? <StatsCard label="Urgentes" value={stats.urgentes} icon={<TicketAlertIcon />}  className="animate-pulse bg-redCustom shadow-lg shadow-red-400/70 " />
          : <StatsCard label="Urgentes" value={stats.urgentes} icon={<TicketAlertIcon />}  className="animate-scale-in bg-redCustom" />
        }
        <StatsCard label="Asignados" value={stats.asignados} icon={<AssingUserIcon />}  className="animate-scale-in bg-violetCustom" />
        <StatsCard label="En Progreso" value={stats.en_progreso} icon={<TicketProgressIcon />} className="animate-scale-in bg-yellowCustom" />
        <StatsCard label="Resueltos" value={stats.resueltos} icon={<TicketSolvedIcon />}  className="animate-scale-in bg-greenCustom" />
        <StatsCard label="Cerrados" value={stats.cerrados} icon={<TicketClosedIcon />}  className="animate-scale-in bg-grayCustom" />
      </section>
      <section className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4 sm:p-5 flex flex-col gap-4">
        <h2 className="text-base font-bold tracking-tight text-gray-900">
          Reporte de tickets
        </h2>
        <div className=" flex justify-between gap-2 w-full">
          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-col">
              <label className="sm:text-xs text-[10px] px-1 font-semibold text-gray-500 uppercase tracking-normal">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white text-gray-700 text-xs px-3 py-2 focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
              />
            </div>
            <div className="flex flex-col">
              <label className="sm:text-xs text-[10px] px-1 font-semibold text-gray-500 uppercase tracking-normal">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white text-gray-700 text-xs px-3 py-2 focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
              />
            </div>
            {!esCliente && (
              <Select
                label="Empresa"
                value={filtroEmpresaId}
                onChange={(e) => setFiltroEmpresaId(e.target.value)}
                options={empresas.map((e) => ({ value: String(e.id), label: e.nombre }))}
                placeholder="Todas"
                className="w-full sm:w-44 !text-xs"
              />
            )}
            <Select
              label="Estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              options={[
                { value: "abierto", label: "Abierto" },
                { value: "asignado", label: "Asignado" },
                { value: "en_progreso", label: "En Progreso" },
                { value: "resuelto", label: "Resuelto" },
                { value: "cerrado", label: "Cerrado" },
              ]}
              placeholder="Todos"
              className="w-full sm:w-40 !text-xs"
            />
            <Select
              label="Prioridad"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              options={[
                { value: "urgente", label: "Urgente" },
                { value: "alta", label: "Alta" },
                { value: "media", label: "Media" },
                { value: "baja", label: "Baja" },
              ]}
              placeholder="Todas"
              className="w-full sm:w-36 !text-xs"
            />
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
          <Button
            onClick={handleDescargar}
            loading={descargando}
            variant="secondary"
            disabled={descargando}
            className=" self-end w-fit h-fit !bg-greenCustom !text-white hover:!bg-greenCustom/80"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-file-type-csv" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12V5a2 2 0 0 1 2-2h7l5 5v4M7 16.5a1.5 1.5 0 0 0-3 0v3a1.5 1.5 0 0 0 3 0m3 .75c0 .414.336.75.75.75H12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h1.25a.75.75 0 0 1 .75.75m3-.75 2 6 2-6"/></svg> }
          >
            Descargar
          </Button>
      </section>
      <section className="bg-cardCustom rounded-2xl border border-gray-100 shadow-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Tickets Recientes</h2>
          <div className="flex items-center sm:gap-2 gap-1">
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
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
              </button>
            </div>
            <Link href="/tickets" className="text-xs text-nowrap sm:text-sm font-medium text-brandCustom hover:text-brandCustom/80 transition-colors flex justify-center items-center gap-1">
              Ver todos
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="m9 6 6 6-6 6"/></svg>
            </Link>
          </div>
        </div>

        {cargando ? (
          <LoadingState />
        ) : recientes.length === 0 ? (
          <EmptyState message="No hay tickets todavia." />
        ) : viewMode === "table" ? (
          <DataTable
            columns={[
              {
                key: "ticket_number",
                header: "# Ticket",
                cell: (t: Ticket) => (
                  <Link href={`/tickets/${t.id}`} title={`Ver ticket: ${t.titulo}`} className="text-xs font-medium text-gray-500 hover:text-brand-600 transition-colors">
                    #{t.id.split('-')[0].toUpperCase()}
                  </Link>
                ),
              },
              {
                key: "titulo",
                header: "Titulo",
                cell: (t: Ticket) => (
                  <Link href={`/tickets/${t.id}`} title={`Ver ticket: ${t.titulo}`} className="font-medium text-gray-800 hover:text-brand-600 transition-colors">
                    {t.titulo.substring(0, 20) + "..."}
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
                cell: (t: Ticket) => <PrioridadBadge prioridad={t.prioridad} />,
              },
              {
                key: "actualizado",
                header: "Actualizado",
                cell: (t: Ticket) => (
                  <span className="text-gray-400 sm:text-xs text-[10px]">{new Date(t.fecha_actualizacion).toLocaleString(undefined, { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                ),
              },
            ]}
            data={recientes}
            keyExtractor={(t: Ticket) => t.id}
            minWidth="min-w-[500px]"
          />
        )
        : (
          <div className="bg-cardCustom rounded-2xl min-h-[40vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 sm:gap-4 gap-3 sm:p-6">
            {recientes.map((t: Ticket, index: number) => (
              <div
                key={t.id}
                className={`group relative bg-white 
                  rounded-xl shadow-sm hover:shadow-md hover:border-brandCustom/40 transition-all flex flex-col justify-between gap-2 cursor-pointer
                  animate-fadeIn opacity-0`}
                style={{
                  animationDelay: `${index * 40}ms`,
                  animationFillMode: "forwards",
                }}
              >
                <div className="flex items-center justify-between gap-2 bg-brandCustom p-2 rounded-t-xl">
                  <span className="text-white uppercase transition-colors line-clamp-2 text-[10px] px-2 py-1 rounded-full w-fit h-fit">
                    {t.empresa_nombre}
                  </span>
                  <span className="text-white uppercase transition-colors line-clamp-2 text-[10px] px-2 py-1 rounded-full w-fit h-fit">
                    {t.elemento_afectado.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 px-4 pt-2">
                  <Link
                    href={`/tickets/${t.id}`}
                    title={`Ver ticket: ${t.titulo}`}
                    className="font-medium text-gray-800 group-hover:text-gray-500 transition-colors line-clamp-2 text-sm sm:text-base after:absolute after:inset-0"
                  >
                    {t.titulo}
                  </Link>
                  <span className="text-gray-500 uppercase transition-colors line-clamp-2 text-[9px]">#{t.id.split("-")[0]}</span>
                </div>
                <div className="flex flex-col text-start h-full w-full">
                  <span className="px-4 text-gray-500 transition-colors line-clamp-2 text-xs">
                    {t.descripcion}
                  </span>
                </div>
                <div className="bg-grayCustom/5 px-2 py-2 border-t border-grayCustom/10 rounded-b-xl flex items-center justify-between gap-2 text-gray-400 sm:text-xs text-[10px]">
                  <div className="flex items-center gap-2">
                    <EstadoBadge estado={t.estado}/>
                    <PrioridadBadge prioridad={t.prioridad} estado={t.estado}/>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px]">
                      {new Date(t.fecha_creacion).toLocaleString(undefined, {
                        timeZone: "America/Bogota",
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </section>
    </div>
  );
}

