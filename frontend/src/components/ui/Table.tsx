import type { ReactNode } from "react";
import Link from "next/link";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  minWidth?: string;
  onRowClick?: (row: T) => string;
  rowClassName?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  minWidth = "min-w-[540px]",
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto overflow-y-hidden scrollbar-hidden rounded-2xl border border-gray-100 bg-cardCustom shadow-card">
      <table className={`w-full text-sm text-left ${minWidth}`}>
        <thead className="bg-brandCustom text-white  border-b border-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-5 py-2 sm:py-3.5 sm:text-xs text-[10px] font-medium tracking-wider uppercase"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, i:number) => {
            const baseRowClass = rowClassName ? rowClassName(row) : "";
            const clickClass = onRowClick ? "cursor-pointer" : "";

            return (
              <tr
                key={keyExtractor(row)}
                className={`hover:bg-gray-100/50 animate-fade-in opacity-0 transition-colors ${baseRowClass} ${clickClass}`}
                style={{
                  animationDelay: `${(i+1)* 20}ms`,
                  animationFillMode: "forwards",
                }}
                onClick={() => {
                  if (onRowClick) {
                    const href = onRowClick(row);
                    if (href) window.location.href = href;
                  }
                }}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-5 py-2.5 ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
