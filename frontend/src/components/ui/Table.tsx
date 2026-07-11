import type { ReactNode } from "react";
import Link from "next/link";

interface Column<T> {
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
  minWidth = "min-w-[560px]",
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-card">
      <table className={`w-full text-sm text-left ${minWidth}`}>
        <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-5 py-3.5 text-xs font-semibold tracking-wider uppercase"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((row) => {
            const baseRowClass = rowClassName ? rowClassName(row) : "";
            const clickClass = onRowClick ? "cursor-pointer" : "";

            return (
              <tr
                key={keyExtractor(row)}
                className={`hover:bg-gray-50/50 transition-colors ${baseRowClass} ${clickClass}`}
                onClick={() => {
                  if (onRowClick) {
                    const href = onRowClick(row);
                    if (href) window.location.href = href;
                  }
                }}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-5 py-3.5 ${col.className ?? ""}`}>
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
