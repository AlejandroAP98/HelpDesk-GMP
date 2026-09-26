"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface FilterDropdownProps {
  activeCount: number;
  onClear?: () => void;
  children: ReactNode;
  className?: string;
  buttonLabel?: string;
}

export function FilterDropdown({
  activeCount,
  onClear,
  children,
  className = "",
  buttonLabel = "Filtros",
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const handleClear = () => {
    onClear?.();
  };

  return (
    <div ref={containerRef} className={`relative xl:hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
          open
            ? "border-brandCustom bg-brandCustom/5 text-brandCustom"
            : activeCount > 0
              ? "border-brandCustom/40 bg-brandCustom/5 text-brandCustom"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M6 12h12m-8 6h4"/></svg>
        <span className="font-medium">{buttonLabel}</span>
        {activeCount > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brandCustom px-1 text-[10px] font-semibold leading-none text-white">
            {activeCount}
          </span>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className={`transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filtros"
          className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-xs origin-top-right rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
        >
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar filtros"
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex flex-col gap-3">{children}</div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
            {activeCount > 0 && onClear ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-gray-500 underline-offset-2 transition-colors hover:text-gray-800 hover:underline"
              >
                Limpiar todo
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-brandCustom px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brandCustom/90"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
