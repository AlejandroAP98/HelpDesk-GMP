"use client";

interface ViewModeToggleProps {
  value: "cards" | "table";
  onChange: (modo: "cards" | "table") => void;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex w-fit border-b border-brandCustom/50 bg-grayCustom/10 rounded-lg h-fit self-end gap-1">
      <button
        onClick={() => onChange("cards")}
        title="Vista tarjetas"
        className={`p-1.5 rounded-md transition-all ${
          value === "cards"
            ? "bg-brandCustom text-white"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-layout-grid" viewBox="0 0 24 24"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>
      </button>
      <button
        onClick={() => onChange("table")}
        title="Vista tabla"
        className={`p-1.5 rounded-md transition-all ${
          value === "table"
            ? "bg-brandCustom text-white"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-table" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  );
}
