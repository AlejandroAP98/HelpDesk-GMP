"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  maxResults?: number;
  onInputChange?: (query: string) => void;
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  disabled = false,
  loading = false,
  emptyMessage = "Sin resultados",
  maxResults = 200,
  onInputChange,
}: SearchableSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value ?? "")) ?? null,
    [options, value]
  );

  const displayValue = open
    ? query
    : selected
    ? selected.label
    : "";

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options.slice(0, maxResults);
    const matches = options.filter((o) => {
      const hay = normalize(o.label);
      if (hay.includes(q)) return true;
      if (o.sublabel && normalize(o.sublabel).includes(q)) return true;
      return false;
    });
    return matches.slice(0, maxResults);
  }, [options, query, maxResults]);

  useEffect(() => {
    if (highlightIndex >= filtered.length) {
      setHighlightIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered, highlightIndex]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.querySelectorAll("li")[highlightIndex] as
      | HTMLElement
      | undefined;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setHighlightIndex(0);
    setOpen(true);
    onInputChange?.(v);
  };

  const handleFocus = () => {
    if (!disabled) {
      setOpen(true);
      setQuery("");
      setHighlightIndex(0);
    }
  };

  const selectOption = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
    setQuery("");
  };

  const closeAndReset = () => {
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlightIndex];
      if (opt) selectOption(opt.value);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : capitalize(displayValue)}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-xl border bg-white text-gray-700 px-2.5 py-2.5 text-xs sm:text-xs focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-primary-500" />
          </div>
        )}
        {!loading && !disabled && (
          <button
            type="button"
            onClick={() => (open ? closeAndReset() : setOpen(true))}
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-3 h-3 transition-transform"
              style={{ transform: open ? "rotate(180deg)" : "" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-96 overflow-y-auto"
          role="listbox"
        >
          {loading ? (
            <li className="px-4 py-6 text-xs sm:text-sm text-gray-400 text-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-primary-500 mx-auto mb-2" />
              Cargando...
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-4 py-6 text-xs sm:text-sm text-gray-400 text-center">{emptyMessage}</li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={idx === highlightIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(opt.value);
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`px-4 py-2.5 cursor-pointer transition-colors capitalize text-xs border-b border-gray-200 last:border-b-0 ${
                  idx === highlightIndex || String(opt.value) === String(value ?? "")
                    ? "bg-gray-100 text-primary-600"
                    : "text-gray-700 hover:bg-gray-100"
                } ${
                  String(opt.value) === String(value ?? "") ? "text-brandCustom" : ""
                }`}
              >
                <span>{capitalize(opt.label)}</span>
                {opt.sublabel && (
                  <span className="text-gray-400 ml-1.5 text-xs ">({opt.sublabel})</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default SearchableSelect;
