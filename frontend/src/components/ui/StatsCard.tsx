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
      <p className="text-[10px] sm:text-xs text-wrap text-gray-50 font-medium truncate px-1">{label}</p>
      <div className="flex items-center sm:gap-4 gap-2 w-full justify-between sm:px-2">
        <div className={`text-white`}>{icon}</div>
        <div className="min-w-0 text-wrap">
          <p className={`text-lg md:text-xl text-white font-semibold tracking-tight animate-fade-in delay-300`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
