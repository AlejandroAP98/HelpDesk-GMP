import Link from "next/link";
import type { Ticket } from "@/lib/endpoints";
import { EstadoBadge, PrioridadBadge } from "@/components/Badges";

interface TicketCardProps {
  ticket: Ticket;
  index?: number;
}

export function TicketCard({ ticket, index = 0 }: TicketCardProps) {
  return (
    <div
      className={`group relative bg-white border border-brandCustom/30 rounded-xl
        transition-all duration-200 flex flex-col justify-between cursor-pointer
        animate-fade-in opacity-0 hover:-translate-y-0.5 hover:shadow-card-hover`}
      style={{
        animationDelay: `${index * 40}ms`,
        animationFillMode: "forwards",
      }}
    >
      <div className="flex items-center justify-between gap-2 bg-brandCustom/95 p-1 rounded-t-[0.6rem]">
        <span className="text-white uppercase transition-colors line-clamp-2 text-[10px] px-2 py-1 rounded-full w-fit h-fit">
          {ticket.empresa_nombre || "Empresa Desconocida"}
        </span>
        <span className="text-white uppercase transition-colors line-clamp-2 text-[10px] px-2 py-1 rounded-full w-fit h-fit">
          {ticket.elemento_afectado.replace("_", " ") || "Elemento Desconocido"}
        </span>
        <span className="text-[10px] text-white pr-2">
          {new Date(ticket.fecha_creacion).toLocaleString(undefined, {
            timeZone: "America/Bogota", hour12: false,
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="h-full space-y-1 flex-1 px-4">
        <div className="flex items-start justify-between gap-2 pt-2">
          <Link
            href={`/tickets/${ticket.id}`}
            title={`Ver ticket: ${ticket.titulo}`}
            className="font-normal text-gray-800 group-hover:text-gray-500 transition-colors line-clamp-2 text-sm after:absolute after:inset-0"
          >
            {ticket.titulo}
          </Link>
            <span className="text-gray-500 uppercase transition-colors line-clamp-2 text-[10px]">#{ticket.id.split("-")[0]}</span>
        </div>
        <div className="flex flex-col text-start h-full w-full pb-2">
          <span className="text-gray-500 transition-colors line-clamp-2 text-xs">
            {ticket.descripcion}
          </span>
        </div>
      </div>
      <div className="bg-brandCustom/5 px-4 py-2 rounded-b-[0.6rem] flex items-center justify-between gap-2 sm:text-xs text-[10px]">
        <div className="flex items-center gap-2">
          <EstadoBadge estado={ticket.estado} />
          <PrioridadBadge prioridad={ticket.prioridad} />
        </div>
        <div className="flex items-center gap-1">
          <span className={` ${!ticket.agente_nombre ? "text-redCustom" : "text-brandCustom"} uppercase transition-colors line-clamp-2 text-[10px] px-2 py-1 rounded-full w-fit h-fit`}>
            {ticket.agente_nombre || "SIN ASIGNAR"}
          </span>
        </div>
      </div>
    </div>
  );
}
