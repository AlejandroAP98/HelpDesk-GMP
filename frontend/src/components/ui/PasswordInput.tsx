"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export function PasswordInput({ label, className = "", icon, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <label className="flex flex-col gap-2 px-1">
      {label && (
        <span className="sm:text-xs text-[10px] font-medium text-gray-500 uppercase tracking-wider block">
          {label}
        </span>
      )}
      <div className="relative">
        <div className="flex items-center relative">
          {icon && <span className="absolute left-3 pointer-events-none border-r border-gray-200 pr-2">{icon}</span>}
          <input
            type={show ? "text" : "password"}
            className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brandCustom focus:bg-white outline-none transition-all ${className}`}
            {...props}
          />
        </div>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={-1}
          title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-eye" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/><path d="M21 12q-3.6 6-9 6t-9-6q3.6-6 9-6t9 6"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-eye-closed" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M21 9q-3.6 4-9 4T3 9m0 6 2.5-3.8M21 14.976 18.508 11.2M9 17l.5-4m5.5 4-.5-4"/></svg>
          )}
        </button>
      </div>
    </label>
  );
}
