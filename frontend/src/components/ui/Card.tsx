import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = "", padding = true }: CardProps) {
  return (
    <div
      className={`bg-cardCustom rounded-2xl border border-cardCustom/50 shadow-card ${padding ? "p-6 sm:p-8" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
