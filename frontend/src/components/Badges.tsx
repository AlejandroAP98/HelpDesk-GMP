export const PRIORIDADES = ["baja", "media", "alta", "urgente"] as const;

export const prioridadLabels: Record<string, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export const estadoStyles: Record<string, string> = {
  abierto: "bg-blueCustom/20 text-blueCustom border-blueCustom/50",
  asignado: "bg-violetCustom/20 text-violetCustom border-violetCustom/50",
  en_progreso: "bg-yellowCustom/20 text-yellowCustom border-yellowCustom/50",
  resuelto: "bg-greenCustom/20 text-greenCustom border-greenCustom/50",
  cerrado: "bg-grayCustom/20 text-grayCustom border-grayCustom/50",
};

const prioridadStyles: Record<string, string> = {
  baja: "text-gray-400 bg-gray-300/5 px-2 py-1 font-medium",
  media: "text-gray-600 bg-gray-300/5 px-2 py-1 font-medium",
  alta: "text-orange-600 bg-orange-300/5 px-2 py-1 font-semibold",
  urgente: "bg-redCustom/5 text-redCustom border-redCustom font-bold px-2 py-0.5 rounded-md",
};
export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex text-nowrap rounded-lg sm:px-2.5 px-1 py-1 sm:text-[11px] text-[9px] font-semibold tracking-wide uppercase ${estadoStyles[estado] ?? ""}`}>
      {estado.replace("_", " ")}
    </span>
  );
}

export function PrioridadBadge({ prioridad, estado= "" }: { prioridad: string, estado?: string  }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg sm:px-2.5 uppercase px-1 py-1 sm:text-[11px] text-[9px] font-semibold  ${prioridadStyles[prioridad] ?? ""}`}>
      {prioridad === "urgente" && estado !== "cerrado" &&  (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-redCustom animate-pulse" />
      )}
      {prioridadLabels[prioridad] ?? prioridad}
    </span>
  );
}

export function TotalBadge({ total }: { total: number }) {
  return (
    <span className="flex h-fit self-end justify-center items-center text-nowrap flex-nowrap text-sm font-medium text-brandCustom bg-brandCustom/5 px-3.5 py-1.5 rounded-lg  border-brandCustom/40">
      {total} ticket{total !== 1 ? "s" : ""}
    </span>
  );
}
