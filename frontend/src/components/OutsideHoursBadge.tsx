import {
  HORA_FIN_LABORAL,
  HORA_INICIO_LABORAL,
  esHorarioNoLaboral,
} from "@/lib/horarioLaboral";

interface OutsideHoursBadgeProps {
  fecha: string | Date | null | undefined;
  className?: string;
  size?: number;
}

/**
 * Indicador visual discreto (luna con estrellas) que se muestra al lado
 * de los timestamps de un ticket cuando fue creado FUERA del horario
 * laboral. Es solo decorativo: el tooltip explica el motivo y mantiene
 * coherencia con el calculo de SLA que pausa el reloj en esa franja.
 */
export function OutsideHoursBadge({
  fecha,
  className = "",
  size = 11,
}: OutsideHoursBadgeProps) {
  if (!esHorarioNoLaboral(fecha)) return null;

  return (
    <span
      role="img"
      aria-label={`Creado fuera del horario laboral (${HORA_INICIO_LABORAL}:00-${HORA_FIN_LABORAL}:00)`}
      title={`Creado fuera del horario de atención (${HORA_INICIO_LABORAL}:00-${HORA_FIN_LABORAL}:00)`}
      className={`inline-flex items-center justify-center align-middle text-white/80 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" aria-hidden="true" className="icon icon-tabler icons-tabler-outline icon-tabler-moon-stars" height={size} width={size} viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992zm5 1a2 2 0 0 0 2 2 2 2 0 0 0-2 2 2 2 0 0 0-2-2 2 2 0 0 0 2-2m2 7h2m-1-1v2"/></svg>
    </span>
  );
}
