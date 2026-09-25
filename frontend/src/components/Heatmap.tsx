"use client";

import { useMemo } from "react";

interface HeatmapCell {
  dow: number;
  hora: number;
  cantidad: number;
}

interface HeatmapProps {
  cells: HeatmapCell[];
  height?: number;
}

const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const COLOR_MIN = "#f3f4f6";

function colorFor(value: number, max: number) {
  if (max <= 0 || value <= 0) return COLOR_MIN;
  const t = value / max;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const r = Math.round(lerp(0xef, 0x0a));
  const g = Math.round(lerp(0xf4, 0x44));
  const b = Math.round(lerp(0xf6, 0x6b));
  return `rgb(${r}, ${g}, ${b})`;
}

export function Heatmap({ cells, height = 240 }: HeatmapProps) {
  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cells) {
      map.set(`${c.dow}-${c.hora}`, c.cantidad);
    }
    return map;
  }, [cells]);

  const max = useMemo(
    () => cells.reduce((m, c) => (c.cantidad > m ? c.cantidad : m), 0),
    [cells],
  );

  const PAD_L = 32;
  const PAD_T = 22;
  const PAD_R = 6;
  const PAD_B = 22;
  const CELL_W = 32;
  const CELL_H = (height - PAD_T - PAD_B) / 6;
  const width = PAD_L + 24 * CELL_W + PAD_R;
  const totalHeight = PAD_T + 7 * CELL_H + PAD_B;

  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ height: totalHeight }}
        role="img"
        aria-label="Matriz de distribución de tickets por día y hora"
      >
        {hourLabels.map((h) => {
          const x = PAD_L + (h / 24) * (24 * CELL_W);
          return (
            <text
              key={h}
              x={x}
              y={PAD_T - 6}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {h}h
            </text>
          );
        })}
        {DOW_LABELS.map((label, dow) => {
          const y = PAD_T + dow * CELL_H + CELL_H / 2 + 3;
          return (
            <text
              key={dow}
              x={PAD_L - 6}
              y={y}
              textAnchor="end"
              fontSize={10}
              fill="#9ca3af"
            >
              {label}
            </text>
          );
        })}
        {DOW_LABELS.map((_, dow) => (
          <g key={dow}>
            {Array.from({ length: 24 }, (_, h) => {
              const x = PAD_L + h * CELL_W;
              const y = PAD_T + dow * CELL_H;
              const count = lookup.get(`${dow}-${h}`) ?? 0;
              return (
                <rect
                  key={`${dow}-${h}`}
                  x={x + 1}
                  y={y + 1}
                  width={CELL_W - 2}
                  height={CELL_H - 2}
                  rx={2}
                  fill={colorFor(count, max)}
                >
                  <title>{`${DOW_LABELS[dow]} ${h}:00 - ${count} tickets`}</title>
                </rect>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
        <span>menos</span>
        <div className="flex h-2">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div
              key={t}
              className="w-3 h-2"
              style={{
                background: colorFor(t * max, max || 1),
              }}
            />
          ))}
        </div>
        <span>más</span>
        <span className="ml-auto text-gray-400">Máximo {max} tickets / franja horaria</span>
      </div>
    </div>
  );
}
