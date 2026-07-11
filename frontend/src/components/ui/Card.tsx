import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = "", padding = true }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-card ${padding ? "p-6 sm:p-8" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
