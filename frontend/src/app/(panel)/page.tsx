"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { ticketApi, statsApi, type Ticket, type PrioridadTicket, type EstadoTicket, type Stats } from "@/lib/endpoints";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { EstadoBadge, PrioridadBadge } from "@/components/Badges";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable } from "@/components/ui/Table";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import NewTicketIcon from "../assets/icons/NewTicketIcon";
import TicketIcon from "../assets/icons/TicketIcon";
import TicketOpenedIcon from "../assets/icons/TicketOpenedIcon";
import TicketAlertIcon from "../assets/icons/TicketAlertIcon";
import TicketSolvedIcon from "../assets/icons/TicketSolvedIcon";
import TicketClosedIcon from "../assets/icons/TicketClosedIcon";
import TicketProgressIcon from "../assets/icons/TicketProgressIcon";
import AssingUserIcon from "../assets/icons/AssignUserIcon";


export default function PanelHomePage() {
  const usuario = useAuthStore((s) => s.usuario);
  const [recientes, setRecientes] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, abiertos: 0, urgentes: 0, resueltos: 0, cerrados: 0, en_progreso: 0, asignados: 0 });

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

  const esCliente = usuario?.rol === "cliente";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Hola, {usuario?.nombre?.split(" ")[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {usuario?.rol === "cliente" && "Gestiona tus tickets de soporte de manera eficiente"}
            {usuario?.rol === "agente" && "Revisa y resuelve tus tickets asignados"}
            {usuario?.rol === "administrador" && "Panel de administracion y control global"}
          </p>
        </div>
        {esCliente && (
          <Link href="/tickets/nuevo">
            <Button>
              <NewTicketIcon />
              Crear nuevo ticket
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-7 md:gap-4 gap-2 bg-cardCustom p-4 sm:p-6 rounded-2xl">
        <StatsCard label="Total tickets" value={stats.total} icon={<TicketIcon />}  className="bg-brandCustom animate-scale-in border-2 " />
        <StatsCard label="Abiertos" value={stats.abiertos} icon={<TicketOpenedIcon />}  className="animate-scale-in bg-blueCustom " />
        {
          stats.urgentes > 0 ? <StatsCard label="Urgentes" value={stats.urgentes} icon={<TicketAlertIcon />}  className="animate-pulse bg-redCustom shadow-lg shadow-red-400/70 " />
          : <StatsCard label="Urgentes" value={stats.urgentes} icon={<TicketAlertIcon />}  className="animate-scale-in bg-redCustom" />
        }
        <StatsCard label="Asignados" value={stats.asignados} icon={<AssingUserIcon />}  className="animate-scale-in bg-violetCustom" />
        <StatsCard label="En Progreso" value={stats.en_progreso} icon={<TicketProgressIcon />} className="animate-scale-in bg-yellowCustom" />
        <StatsCard label="Resueltos" value={stats.resueltos} icon={<TicketSolvedIcon />}  className="animate-scale-in bg-greenCustom" />
        <StatsCard label="Cerrados" value={stats.cerrados} icon={<TicketClosedIcon />}  className="animate-scale-in bg-grayCustom" />
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Tickets recientes</h2>
          <Link href="/tickets" className="text-sm font-medium text-brandCustom hover:text-brandCustom/80 transition-colors flex justify-center items-center gap-1">
            Ver todos
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="m9 6 6 6-6 6"/></svg>
          </Link>
        </div>

        {cargando ? (
          <LoadingState />
        ) : recientes.length === 0 ? (
          <EmptyState message="No hay tickets todavia." />
        ) : (
          <DataTable
            columns={[
              {
                key: "icono",
                header: "Detalle",
                cell: (t: Ticket) => (
                  <Link href={`/tickets/${t.id}`} className="font-regular text-sm  transition-all text-gray-500 cursor-pointer" title={`Ver ticket: ${t.titulo}`}>
                    <TicketIcon className="w-5 h-5 text-gray-400 hover:text-brandCustom transition-colors" />
                  </Link>
                ),
              },
              {
                key: "titulo",
                header: "Titulo",
                cell: (t: Ticket) => (
                  <Link href={`/tickets/${t.id}`} title={`Ver ticket: ${t.titulo}`} className="font-semibold text-sm text-gray-800 hover:text-brand-600 transition-colors">
                    {t.titulo.substring(0, 20) + "..."}
                  </Link>
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
                  <span className="text-gray-400 text-xs">{new Date(t.fecha_actualizacion).toLocaleString(undefined, { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                ),
              },
            ]}
            data={recientes}
            keyExtractor={(t: Ticket) => t.id}
            minWidth="min-w-[500px]"
          />
        )}
      </section>
    </div>
  );
}

