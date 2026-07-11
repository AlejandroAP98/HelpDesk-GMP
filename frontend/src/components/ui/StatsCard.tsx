import type { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: "brand" | "amber" | "red" | "emerald";
}

const colorMap = {
  brand: { bg: "bg-brand-50", text: "text-brand-600", icon: "text-brand-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", icon: "text-amber-500" },
  red: { bg: "bg-red-50", text: "text-red-600", icon: "text-red-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "text-emerald-500" },
};

export function StatsCard({ label, value, icon, color = "brand" }: StatsCardProps) {
  const c = colorMap[color];

  return (
    <div className="bg-cardCustom rounded-2xl shadow-card p-5 sm:p-6 animate-scale-in">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
          <div className={`w-5 h-5 ${c.icon}`}>{icon}</div>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-500 truncate">{label}</p>
          <p className={`text-2xl font-bold tracking-tight mt-0.5 ${c.text}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
