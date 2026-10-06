"use client";

import Link from "next/link";
import type { Ticket } from "@/lib/endpoints";
import { EstadoBadge, PrioridadBadge } from "@/components/Badges";
import type { Column } from "@/components/ui/Table";

export interface TicketColumnsOptions {
  tituloClass: string;
  descripcionMax: number;
  fechaOpts: Intl.DateTimeFormatOptions;
  prioridadConEstado?: boolean;
  asignadoDestacar?: boolean;
  creadoPor?: string;
}

export function buildTicketTableColumns({
  tituloClass,
  descripcionMax,
  fechaOpts,
  prioridadConEstado = false,
  asignadoDestacar = false,
  creadoPor = ""
}: TicketColumnsOptions): Column<Ticket>[] {
  return [
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
          <span className={tituloClass}>
            {t.titulo.length > 30 ? `${t.titulo.substring(0, 30)}...` : t.titulo}
          </span>
          <span className="text-gray-500 text-[10px] line-clamp-1">
            {t.descripcion.length > descripcionMax ? `${t.descripcion.substring(0, descripcionMax)}...` : t.descripcion}
          </span>
          <span className="text-gray-400 text-[9px] mt-0.5">
            {new Date(t.fecha_creacion).toLocaleDateString(undefined, fechaOpts)}
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
      key: "creado_por",
      header: "Creado",
      cell: (t: Ticket) => (
        <span className="text-gray-500 sm:text-xs text-[10px]">
          {t.cliente_nombre ?? "-"}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (t: Ticket) => <EstadoBadge estado={t.estado} pausa={t.en_pausa} />,
    },
    {
      key: "prioridad",
      header: "Prioridad",
      cell: (t: Ticket) =>
        prioridadConEstado
          ? <PrioridadBadge prioridad={t.prioridad} />
          : <PrioridadBadge prioridad={t.prioridad} />,
    },
    {
      key: "asignado",
      header: "Asignado",
      cell: (t: Ticket) => (
        <span className={`text-gray-500 sm:text-xs text-[10px] ${asignadoDestacar && !t.agente_nombre ? "text-redCustom" : asignadoDestacar ? "text-bgSiderBar" : ""}`}>
          {t.agente_nombre ? t.agente_nombre : "Sin asignar"}
        </span>
      ),
    },
  ];
}

export const TICKET_LISTADO_FECHA: Intl.DateTimeFormatOptions = {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

export const TICKET_RECIENTE_FECHA: Intl.DateTimeFormatOptions = {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "short",
};
