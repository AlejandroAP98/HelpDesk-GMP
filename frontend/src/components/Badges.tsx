export const PRIORIDADES = ["baja", "media", "alta", "urgente"] as const;

export const prioridadLabels: Record<string, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export const estadoStyles: Record<string, string> = {
  abierto: "bg-blue-50 text-blue-700 border-blue-100",
  asignado: "bg-purple-50 text-purple-700 border-purple-100",
  en_progreso: "bg-amber-50 text-amber-700 border-amber-100",
  resuelto: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cerrado: "bg-gray-100 text-gray-500 border-gray-200",
};

const prioridadStyles: Record<string, string> = {
  baja: "bg-gray-100 text-gray-500 border-gray-200",
  media: "bg-sky-50 text-sky-700 border-sky-100",
  alta: "bg-orange-50 text-orange-700 border-orange-100",
  urgente: "bg-red-50 text-red-600 border-red-100 font-bold",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase border ${estadoStyles[estado] ?? ""}`}>
      {estado.replace("_", " ")}
    </span>
  );
}

export function PrioridadBadge({ prioridad }: { prioridad: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase border ${prioridadStyles[prioridad] ?? ""}`}>
      {prioridad === "urgente" && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
      {prioridadLabels[prioridad] ?? prioridad}
    </span>
  );
}
