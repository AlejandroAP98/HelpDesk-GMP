import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
    <div className={`flex items-center justify-between gap-4 flex-no ${className ?? ""}`}>
      <div className="min-w-0">
        <h1 className="text-md sm:text-lg font-semibold tracking-tight text-brandCustom">{title}</h1>
        {subtitle ? (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
    <div className="border-b border-t border-t-gray-100 border-b-gray-300"></div>
    </div>
  );
}
