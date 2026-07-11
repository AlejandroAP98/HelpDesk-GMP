"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { ticketApi, type Ticket, type PrioridadTicket, type EstadoTicket } from "@/lib/endpoints";
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



interface Stats {
  total: number;
  abiertos: number;
  urgentes: number;
  resueltos: number;
}

export default function PanelHomePage() {
  const usuario = useAuthStore((s) => s.usuario);
  const [recientes, setRecientes] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, abiertos: 0, urgentes: 0, resueltos: 0 });

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const [ultimos, totalData, abiertosData, urgentesData, resueltosData] = await Promise.all([
          ticketApi.listar({ size: 5 }),
          ticketApi.listar({ size: 1 }),
          ticketApi.listar({ estado: "abierto", size: 1 }),
          ticketApi.listar({ prioridad: "urgente", size: 1 }),
          ticketApi.listar({ estado: "resuelto", size: 1 }),
        ]);
        setRecientes(ultimos.items);
        setStats({
          total: totalData.total,
          abiertos: abiertosData.total,
          urgentes: urgentesData.total,
          resueltos: resueltosData.total,
        });
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total tickets" value={stats.total} icon={<TicketIcon />} color="brand" />
        <StatsCard label="Abiertos" value={stats.abiertos} icon={<TicketOpenedIcon />} color="amber" />
        <StatsCard label="Urgentes" value={stats.urgentes} icon={<TicketAlertIcon />} color="red" />
        <StatsCard label="Resueltos" value={stats.resueltos} icon={<TicketSolvedIcon />} color="emerald" />
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Tickets recientes</h2>
          <Link href="/tickets" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
            Ver todos &rarr;
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
                key: "titulo",
                header: "Titulo",
                cell: (t: Ticket) => (
                  <Link href={`/tickets/${t.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors">
                    {t.titulo}
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
                  <span className="text-gray-400 text-xs">{new Date(t.fecha_actualizacion).toLocaleDateString()}</span>
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

