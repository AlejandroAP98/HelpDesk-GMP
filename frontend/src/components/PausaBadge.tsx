"use client";

import { useEffect, useState } from "react";

function formatDuracion(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "0m";
  const totalMinutos = Math.floor(segundos / 60);
  if (totalMinutos < 60) return `${totalMinutos}m`;
  const dias = Math.floor(totalMinutos / (60 * 24));
  const horas = Math.floor((totalMinutos % (60 * 24)) / 60);
  const mins = totalMinutos % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${mins}m`;
  return `${mins}m`;
}

export function PausaBadge({
  motivo,
  fechaPausa,
  segundosAcumulado,
  className,
  mostrarInfo,
}: {
  motivo?: string | null;
  fechaPausa?: string | null;
  segundosAcumulado?: number;
  className?: string;
  mostrarInfo?: boolean;
}) {
  const inicial =
    (segundosAcumulado ?? 0) +
    (fechaPausa ? Math.floor((Date.now() - new Date(fechaPausa).getTime()) / 1000) : 0);
  const [ahoraSegundos, setAhoraSegundos] = useState(inicial);

  useEffect(() => {
    if (!fechaPausa) return;
    const tick = () => {
      const delta = Math.floor((Date.now() - new Date(fechaPausa).getTime()) / 1000);
      setAhoraSegundos((segundosAcumulado ?? 0) + Math.max(delta, 0));
    };
    tick();
    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, [fechaPausa, segundosAcumulado]);

  const duracion = formatDuracion(ahoraSegundos);
  const motivoCorto = motivo && motivo.length > 40 ? `${motivo.slice(0, 40)}...` : motivo;

  return (
    <span
      title={motivo ?? "Ticket en pausa"}
      className={`flex items-center gap-1 px-2 py-1 bg-amberCustom text-nowrap sm:text-[11px] text-[10px] font-medium tracking-wide ${className}`}
    >
      <span className="text-white uppercase font-medium">EN ESPERA...</span>
      {mostrarInfo && <div className="flex items-center gap-1">
        <span className="text-white capitalize">{motivoCorto ? `→ ${motivoCorto}` : ""}</span>
        <span className="text-white">[{duracion}]</span>
      </div>
      }
    </span>
  );
}