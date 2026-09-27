"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ActividadLog } from "@/lib/endpoints";

const ESTADO_LABELS: Record<string, string> = {
  abierto: "Abierto",
  asignado: "Asignado",
  en_progreso: "En Progreso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

const PRIORIDAD_LABELS: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

function formatRelativeTime(fecha: string): string {
  const now = new Date();
  const then = new Date(fecha);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffH < 24) return `hace ${diffH}h`;
  if (diffD === 1) return "ayer";
  return `hace ${diffD} dias`;
}

function formatTicketId(ticketId: string | null): string {
  if (!ticketId) return "";
  return `#${ticketId.split("-")[0].toUpperCase().slice(0, 8)}`;
}

function TicketLink({ ticketId, children }: { ticketId: string | null; children: ReactNode }) {
  if (!ticketId) return <>{children}</>;
  return (
    <Link href={`/tickets/${ticketId}`} className="font-medium text-brandCustom hover:underline">
      {children}
    </Link>
  );
}

function renderActividad(item: ActividadLog): ReactNode {
  const nombre = item.usuario_nombre || "Usuario";
  const ticket = item.ticket_id ? formatTicketId(item.ticket_id) : "";
  const meta = item.metadata || {};

  switch (item.tipo_evento) {
    case "ticket_created":
      return (
        <>
          <span className="font-medium text-gray-800">{nombre}</span>
          {" creó el ticket "}
          <TicketLink ticketId={item.ticket_id}>{ticket}</TicketLink>
        </>
      );
    case "ticket_assigned":
      return (
        <>
          <span className="font-medium text-gray-800">{nombre}</span>
          {" asignó el ticket "}
          <TicketLink ticketId={item.ticket_id}>{ticket}</TicketLink>
          {" a "}
          <span className="font-medium text-gray-800">{meta.agente_nombre || "un agente"}</span>
        </>
      );
    case "state_changed":
      return (
        <>
          <span className="font-medium text-gray-800">{nombre}</span>
          {" cambió estado: "}
          <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
            {ESTADO_LABELS[meta.estado_anterior] || meta.estado_anterior}
          </span>
          {" → "}
          <span className="inline-flex items-center rounded bg-brandCustom/10 px-1.5 py-0.5 text-[10px] font-medium text-brandCustom">
            {ESTADO_LABELS[meta.estado_nuevo] || meta.estado_nuevo}
          </span>
          {" en ticket "}
          <TicketLink ticketId={item.ticket_id}>{ticket}</TicketLink>
        </>
      );
    case "priority_changed":
      return (
        <>
          <span className="font-medium text-gray-800">{nombre}</span>
          {" cambió prioridad: "}
          <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
            {PRIORIDAD_LABELS[meta.prioridad_anterior] || meta.prioridad_anterior}
          </span>
          {" → "}
          <span className="inline-flex items-center rounded bg-brandCustom/10 px-1.5 py-0.5 text-[10px] font-medium text-brandCustom ">
            {PRIORIDAD_LABELS[meta.prioridad_nueva] || meta.prioridad_nueva}
          </span>
          {" en ticket "}
          <TicketLink ticketId={item.ticket_id}>{ticket}</TicketLink>
        </>
      );
    case "ticket_reopened":
      return (
        <>
          <span className="font-medium text-gray-800">{nombre}</span>
          {" reabrió el ticket "}
          <TicketLink ticketId={item.ticket_id}>{ticket}</TicketLink>
        </>
      );
    case "comment_added":
      return (
        <>
          <span className="font-medium text-gray-800">{nombre}</span>
          {" agregó un comentario al ticket "}
          <TicketLink ticketId={item.ticket_id}>{ticket}</TicketLink>
        </>
      );
    case "attachment_uploaded":
      return (
        <>
          <span className="font-medium text-gray-800">{nombre}</span>
          {" subió un adjunto al ticket"}
          <TicketLink ticketId={item.ticket_id}>{ticket}</TicketLink>
        </>
      );
    default:
      return (
        <>
          <span className="font-medium text-gray-800">{nombre}</span>
          {" realizó una acción"}
        </>
      );
  }
}

interface ActividadPanelProps {
  items: ActividadLog[];
}

export function ActividadPanel({ items }: ActividadPanelProps) {
  if (items.length === 0) {
    return (
      <div className="w-full px-2 h-full">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Actividad reciente</h2>
        <p className="text-xs text-gray-400 text-center py-4">Sin actividad hoy</p>
      </div>
    );
  }

  return (
    <div className="w-full px-2 h-full">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Actividad reciente</h2>
      <div className="space-y-2 max-h-60 overflow-y-auto [scrollbar-gutter:stable]">
        {items.map((item, index) => (
          <div
            key={`${item.fecha}-${index}`}
            className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0 animate-fade-in"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <span className="text-gray-700 flex-1">
              {renderActividad(item)}
            </span>
            <span className="text-gray-400 text-[10px] whitespace-nowrap pr-2 mt-0.5 min-w-[60px]">
              {formatRelativeTime(item.fecha)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
