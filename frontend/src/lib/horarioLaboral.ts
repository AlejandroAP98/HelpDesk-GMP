/**
 * Utilidades para detectar si un timestamp cae fuera del horario laboral
 * del HelpDesk-GMP y para calcular deltas respetando esa regla.
 *
 * Debe coincidir con la regla del backend en `app/services/horario_laboral.py`:
 *   - Si el ticket se crea DENTRO del horario, el reloj arranca inmediato
 *     y corre continuo.
 *   - Si se crea FUERA, el reloj arranca al proximo HORA_INICIO_LABORAL
 *     y desde ahi corre continuo, sin volver a pausarse.
 *
 * Franja por defecto 7am-9pm en zona horaria America/Bogota.
 */

export const HORA_INICIO_LABORAL = 7;
export const HORA_FIN_LABORAL = 21;
export const TIMEZONE_NEGOCIO = "America/Bogota";

/**
 * Devuelve la hora (0-23) de una fecha en la zona horaria del negocio.
 * Si la fecha es invalida, retorna null.
 */
export function horaLocalEnNegocio(
  fecha: string | Date | null | undefined
): number | null {
  if (!fecha) return null;
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: TIMEZONE_NEGOCIO,
  });
  const parts = fmt.formatToParts(d);
  const hourPart = parts.find((p) => p.type === "hour");
  if (!hourPart) return null;
  const hour = parseInt(hourPart.value, 10);
  if (hour === 24) return 0;
  return hour;
}

/**
 * Devuelve {year, month, day, hour, minute, second} de una fecha en zona
 * horaria del negocio. Util para construir el timestamp del proximo
 * inicio de jornada sin pasar por conversiones ambiguas con DST.
 */
function fechaLocalEnNegocio(fecha: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(fecha);
  const lookup = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour") === 24 ? 0 : lookup("hour"),
    minute: lookup("minute"),
    second: lookup("second"),
  };
}

/**
 * True si la fecha cae fuera del horario laboral (7am-9pm) en zona Bogota.
 * Esto es lo que el backend considera "nacido de noche": el reloj de SLA
 * arranca al proximo inicio de jornada.
 */
export function esHorarioNoLaboral(
  fecha: string | Date | null | undefined
): boolean {
  const hour = horaLocalEnNegocio(fecha);
  if (hour === null) return false;
  return hour < HORA_INICIO_LABORAL || hour >= HORA_FIN_LABORAL;
}

function enHorarioLaboral(
  d: Date,
  horaInicio: number,
  horaFin: number
): boolean {
  const h = horaLocalEnNegocio(d);
  if (h === null) return false;
  return horaInicio <= h && h < horaFin;
}

/**
 * Calcula el timestamp del proximo inicio de jornada laboral en zona
 * Bogota para una fecha dada:
 *   - Si la hora local < horaInicio -> mismo dia a horaInicio:00:00.
 *   - Si la hora local >= horaFin -> dia siguiente a horaInicio:00:00.
 *   - En horario -> mismo instante.
 *
 * Devuelve el timestamp como ms epoch.
 */
function proximoInicioLaboralMs(
  d: Date,
  horaInicio: number,
  horaFin: number
): number {
  const local = fechaLocalEnNegocio(d);
  if (enHorarioLaboral(d, horaInicio, horaFin)) {
    return d.getTime();
  }
  const dayOffset = local.hour < horaInicio ? 0 : 1;
  return Date.UTC(
    local.year,
    local.month - 1,
    local.day + dayOffset,
    horaInicio + 5,
    0,
    0,
    0
  );
}

/**
 * Delta en milisegundos entre dos timestamps respetando la regla de
 * horario laboral del HelpDesk-GMP. Equivalente al helper de Python
 * `app.services.horario_laboral.tiempo_sla_transcurrido`.
 *
 *   - Si `inicio` cae en horario -> el reloj arranca inmediato y el
 *     delta es `fin - inicio`.
 *   - Si `inicio` cae fuera -> el reloj arranca al proximo
 *     `horaInicio` y el delta es `fin - arranque` (clamped a 0).
 *   - `fin <= inicio` -> 0.
 *
 * Devuelve un numero >= 0 listo para pasar a `formatDuration`.
 *
 * Nota: el offset UTC (+5h) esta hardcodeado para `America/Bogota`
 * (UTC-5). Si `TIMEZONE_NEGOCIO` cambia a otra zona, este helper
 * necesita refactor para derivar el offset dinamicamente.
 */
export function tiempoSlaTranscurridoMs(
  inicio: string | Date | null | undefined,
  fin: string | Date | null | undefined,
  horaInicio: number = HORA_INICIO_LABORAL,
  horaFin: number = HORA_FIN_LABORAL
): number {
  if (!inicio || !fin) return 0;
  const start = typeof inicio === "string" ? new Date(inicio) : inicio;
  const end = typeof fin === "string" ? new Date(fin) : fin;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end.getTime() <= start.getTime()) return 0;

  if (enHorarioLaboral(start, horaInicio, horaFin)) {
    return end.getTime() - start.getTime();
  }

  const arranque = proximoInicioLaboralMs(start, horaInicio, horaFin);
  return Math.max(0, end.getTime() - arranque);
}
