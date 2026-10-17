#!/usr/bin/env node
/**
 * Verifica que el helper de horario laboral del frontend coincida con la
 * regla de negocio y con los casos de prueba del backend.
 *
 * No importa el modulo TS para evitar dependencias de transpilacion;
 * replica la logica lo suficiente como para validar los valores esperados.
 *
 * Uso:
 *   node scripts/verify-horario.mjs
 */

const HORA_INICIO = 7;
const HORA_FIN = 21;
const TZ = "America/Bogota";

function horaLocalBogota(fechaIso) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: TZ,
  });
  const part = fmt.formatToParts(new Date(fechaIso)).find((p) => p.type === "hour");
  let h = parseInt(part.value, 10);
  if (h === 24) h = 0;
  return h;
}

function partesLocalBogota(fechaIso) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = fmt.formatToParts(new Date(fechaIso));
  const get = (t) => parseInt(p.find((x) => x.type === t)?.value ?? "0", 10);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function enHorario(fechaIso) {
  const h = horaLocalBogota(fechaIso);
  return HORA_INICIO <= h && h < HORA_FIN;
}

function inicioLaboralMs(fechaIso) {
  if (enHorario(fechaIso)) return new Date(fechaIso).getTime();
  const loc = partesLocalBogota(fechaIso);
  const offset = loc.hour < HORA_INICIO ? 0 : 1;
  // Bogota es UTC-5, por lo que 07:00 Bogota == 12:00 UTC.
  return Date.UTC(loc.year, loc.month - 1, loc.day + offset, HORA_INICIO + 5, 0, 0, 0);
}

function tiempoSlaMs(inicioIso, finIso) {
  const start = new Date(inicioIso).getTime();
  const end = new Date(finIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  if (enHorario(inicioIso)) return end - start;
  return Math.max(0, end - inicioLaboralMs(inicioIso));
}

function fmtHoras(ms) {
  return `${(ms / 3_600_000).toFixed(2)}h`;
}

function fmtMin(ms) {
  return `${(ms / 60_000).toFixed(0)}m`;
}

const casos = [
  // [FIX-HORARIO] originales (timestamps UTC naive de la DB)
  { id: "C1", inicio: "2026-10-10T07:00:00.000Z", fin: "2026-10-10T15:00:00.000Z", esperadoMs: 3 * 3_600_000, desc: "02:00 -> 10:00 Bogota -> 3h" },
  { id: "C2", inicio: "2026-10-10T14:00:00.000Z", fin: "2026-10-10T16:00:00.000Z", esperadoMs: 2 * 3_600_000, desc: "09:00 -> 11:00 Bogota -> 2h" },
  { id: "C3", inicio: "2026-10-10T23:00:00.000Z", fin: "2026-10-11T14:00:00.000Z", esperadoMs: 15 * 3_600_000, desc: "18:00 -> 09:00+1 Bogota -> 15h" },
  { id: "C4", inicio: "2026-10-11T01:00:00.000Z", fin: "2026-10-11T07:00:00.000Z", esperadoMs: 6 * 3_600_000, desc: "20:00 -> 02:00+1 Bogota -> 6h" },
  { id: "C5", inicio: "2026-10-11T03:00:00.000Z", fin: "2026-10-11T10:00:00.000Z", esperadoMs: 0, desc: "22:00 -> 05:00+1 Bogota -> 0h" },
  { id: "C6", inicio: "2026-10-11T04:00:00.000Z", fin: "2026-10-11T14:00:00.000Z", esperadoMs: 2 * 3_600_000, desc: "23:00 -> 09:00+1 Bogota -> 2h" },
  { id: "C7", inicio: "2026-10-10T19:00:00.000Z", fin: "2026-10-10T19:00:00.000Z", esperadoMs: 0, desc: "14:00 igual -> 0h" },

  // [FIX-HORARIO-EXTRA]
  { id: "E1", inicio: "2026-10-14T12:00:00.000Z", fin: "2026-10-14T14:00:00.000Z", esperadoMs: 2 * 3_600_000, desc: "creado 07:00 exacto -> 2h" },
  { id: "E2", inicio: "2026-10-15T01:59:00.000Z", fin: "2026-10-15T02:30:00.000Z", esperadoMs: 31 * 60_000, desc: "creado 20:59 -> 31m" },
  { id: "E3", inicio: "2026-10-15T02:00:00.000Z", fin: "2026-10-15T13:00:00.000Z", esperadoMs: 1 * 3_600_000, desc: "creado 21:00 exacto -> 1h" },
  { id: "E4", inicio: "2026-10-14T15:00:00.000Z", fin: "2026-10-17T15:00:00.000Z", esperadoMs: 72 * 3_600_000, desc: "3 dias despues -> 72h" },
  { id: "E5", inicio: "2026-10-14T15:00:00.000Z", fin: "2026-10-14T19:00:00.000Z", esperadoMs: 4 * 3_600_000, desc: "base 4h (pausa aparte)" },
  { id: "E6", inicio: "2026-10-15T03:00:00.000Z", fin: "2026-10-15T12:00:00.000Z", esperadoMs: 0, desc: "creado 22:00, asignado 07:00 -> 0h" },
  { id: "E7", inicio: "2026-10-12T04:00:00.000Z", fin: "2026-10-12T15:00:00.000Z", esperadoMs: 3 * 3_600_000, desc: "sab 23:00 -> dom 10:00 = 3h" },
  { id: "E8", inicio: "2026-10-14T15:00:00.000Z", fin: "2026-10-14T14:00:00.000Z", esperadoMs: 0, desc: "fin anterior a inicio -> 0h" },
];

let fallos = 0;
for (const c of casos) {
  const obtenido = tiempoSlaMs(c.inicio, c.fin);
  const ok = obtenido === c.esperadoMs;
  if (!ok) fallos += 1;
  const unit = c.esperadoMs >= 3_600_000 ? fmtHoras : fmtMin;
  const icon = ok ? "✓" : "✗";
  console.log(
    `${icon} ${c.id}: ${c.desc} (esperado ${unit(c.esperadoMs)}, obtenido ${unit(obtenido)})`
  );
}

if (fallos > 0) {
  console.error(`\n${fallos} caso(s) fallaron.`);
  process.exit(1);
}
console.log(`\n${casos.length} casos verificados correctamente.`);
