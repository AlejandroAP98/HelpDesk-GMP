export const PRIORIDADES = ["baja", "media", "alta", "urgente"] as const;

export const prioridadLabels: Record<string, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export const estadoStyles: Record<string, string> = {
  abierto: "text-blueCustom",
  asignado: "text-violetCustom",
  en_progreso: "text-yellowCustom",
  resuelto: "text-greenCustom",
  cerrado: "text-grayCustom",
};

const prioridadStyles: Record<string, string> = {
  baja: "text-gray-500 bg-gray-200/30 font-normal",
  media: "text-gray-600 bg-gray-300/60 font-normal",
  alta: "text-white bg-orange-500/70 font-medium",
  urgente: "text-white bg-redCustom/80 font-medium",
};
const estadoPorcentaje: Record<string, number> = {
  abierto: 0,
  asignado: 25,
  en_progreso: 50,
  resuelto: 75,
  cerrado: 100,
};

const porcentajeRellenos: Record<number, string> = {
  25: "M21 12a9 9 0 0 0-9-9m0 0v9h9",
  50: "M12 21a9 9 0 0 0 0-18m0 0v18",
  75: "M3 12a9 9 0 1 0 9-9m0 0v9H3",
  100: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
};

export function EstadoBadge({ estado }: { estado: string }) {
  const pct = estadoPorcentaje[estado];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 bg-brandCustom/5 text-nowrap rounded-md py-1 sm:text-[11px] text-[9px] font-medium tracking-wide uppercase ${estadoStyles[estado] ?? ""}`}>
      {pct !== undefined && (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="#508484" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={`icon icon-tabler icons-tabler-outline icon-tabler-percentage-${pct}`} viewBox="0 0 24 24">
          <path fill="none" stroke="none" d="M0 0h24v24H0z" />
          {pct > 0 && pct < 100 && <path fill="#508484" stroke="none" d={porcentajeRellenos[pct]} />}
          {pct === 100
            ? <path fill="#508484" stroke="none" d={porcentajeRellenos[100]} />
            : <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />}
        </svg>
      )}
      <span title={`Progreso del ticket ${pct}%`} >{estado.replace("_", " ")}</span>
    </span>
  );
}

export function PrioridadBadge({ prioridad }: { prioridad: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 uppercase sm:text-[10px] text-[9px] ${prioridadStyles[prioridad] ?? ""} [clip-path:polygon(10px_0,100%_0,calc(100%_-_8px)_50%,100%_100%,10px_100%,0_50%)]`}
      >
      <span className="w-full h-full text-center px-2.5 py-0.5">{prioridadLabels[prioridad] ?? prioridad}</span>
    </span>
  );
}

export function TotalBadge({ total }: { total: number }) {
  return (
    <span className="flex h-auto justify-center items-center text-nowrap flex-nowrap text-[11px] font-normal text-brandCustom bg-brandCustom/5 px-2 py-1 rounded-lg  border-brandCustom/40">
      {total} ticket{total !== 1 ? "s" : ""}
    </span>
  );
}
