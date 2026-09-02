import type { Ticket } from "@/lib/endpoints";

export interface TimeLineItem {
  label: string;
  subtitle: string;
  date: Date | null;
  duration?: string;
  color: string;
  dotColor: string;
  icon: React.ReactNode;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (remHours > 0) parts.push(`${remHours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

export function parseTicketDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
}

export function getTicketTimeline(ticket: Ticket): TimeLineItem[] {
  const creacion = parseTicketDate(ticket.fecha_creacion);
  const asignacion = parseTicketDate(ticket.fecha_asignacion);
  const primeraResp = parseTicketDate(ticket.fecha_primera_respuesta);
  const resolucion = parseTicketDate(ticket.fecha_resolucion);

  const fmt = (d: Date) => d.toLocaleString(undefined, { timeZone: "America/Bogota", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const items: TimeLineItem[] = [
    {
      label: "Ticket creado",
      subtitle: creacion ? fmt(creacion) : "Pendiente",
      date: creacion,
      color: "bg-blueCustom",
      dotColor: "text-white bg-blueCustom ",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-pencil-plus" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5 4 4M16 19h6m-3-3v6"/></svg>
      ),
    },
    {
      label: "Asignado a agente",
      subtitle: asignacion ? fmt(asignacion) : "Sin asignar",
      date: asignacion,
      duration: creacion && asignacion ? formatDuration(asignacion.getTime() - creacion.getTime()) : undefined,
      color: "bg-violetCustom",
      dotColor: asignacion ? "text-white bg-violetCustom" : "border-gray-300 text-gray-300 bg-gray-50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
      ),
    },
    {
      label: "Primera respuesta",
      subtitle: primeraResp ? fmt(primeraResp) : "Sin respuesta",
      date: primeraResp,
      duration: creacion && primeraResp ? formatDuration(primeraResp.getTime() - creacion.getTime()) : undefined,
      color: "bg-yellowCustom",
      dotColor: primeraResp ? "text-white bg-yellowCustom" : "border-gray-300 text-gray-300 bg-gray-50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ),
    },
    {
      label: "Resuelto",
      subtitle: resolucion ? fmt(resolucion) : "Sin resolver",
      date: resolucion,
      duration: creacion && resolucion ? formatDuration(resolucion.getTime() - creacion.getTime()) : undefined,
      color: "bg-greenCustom",
      dotColor: resolucion ? " text-white bg-greenCustom" : "border-gray-300 text-gray-300 bg-gray-50",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      ),
    },
  ];
  return items;
}
