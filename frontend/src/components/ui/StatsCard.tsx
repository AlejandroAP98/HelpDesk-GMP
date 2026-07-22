import type { ReactNode } from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  className?: string;
}

export function StatsCard({ label, value, icon, className }: StatsCardProps) {
  return (
    <div className={`rounded-2xl shadow-card p-2 flex flex-col justify-between items-start ${className}`}>
      <p className="text-xs text-gray-50 font-semibold truncate px-2">{label}</p>
      <div className="flex items-center sm:gap-4 gap-2 px-2">
        <div className={`text-white`}>{icon}</div>
        <div className="min-w-0">
          <p className={`text-xl md:text-2xl text-white font-bold tracking-tight mt-0.5 animate-fade-in delay-300`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
