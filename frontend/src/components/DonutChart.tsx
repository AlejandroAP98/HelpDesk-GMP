interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

const RADIUS = 40;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ data, size = 160, centerLabel, centerValue }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let accumulated = 0;
  const segments = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0;
    const dashArray = `${pct * CIRCUMFERENCE} ${CIRCUMFERENCE}`;
    const dashOffset = -accumulated * CIRCUMFERENCE;
    accumulated += pct;
    return { ...d, dashArray, dashOffset, pct };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={STROKE}
          />
          {segments.map((seg, i) => (
            <circle
              key={seg.label}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </svg>
        {centerLabel != null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold text-gray-800">{centerValue ?? total}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{centerLabel}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-[10px] text-gray-600">
              {seg.label}{" "}
              <span className="font-semibold text-gray-800">{seg.value}</span>
              <span className="text-gray-400 ml-0.5">({Math.round(seg.pct * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
