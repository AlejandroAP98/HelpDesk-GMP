import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export function Input({ label, className = "", icon, ...props }: InputProps) {
  return (
    <label className="flex flex-col gap-2 px-1">
      {label && (
        <span className="sm:text-xs text-[10px] font-medium text-gray-500 uppercase tracking-wider block">
          {label}
        </span>
      )}
      
      <div className="flex items-center relative">
        {icon && <span className="absolute left-3 pointer-events-none border-r border-gray-200 pr-2">{icon}</span>}
        <input
          className={`w-full rounded-xl border border-gray-200 bg-gray-50 sm:px-4 sm:py-2.5 px-2.5 py-2 sm:text-sm text-[11px] text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brandCustom focus:bg-white outline-none transition-all ${className}`}
          {...props}
        />
      </div>
    </label>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <label className="flex flex-col gap-2 px-1">
      {label && (
        <span className="sm:text-xs text-[10px] font-medium text-gray-500 uppercase tracking-wider block">
          {label}
        </span>
      )}
      <textarea
        className={`w-full rounded-xl border border-gray-200 bg-gray-50 sm:px-4 sm:py-2.5 px-2.5 py-2 sm:text-sm text-[11px] text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brandCustom focus:bg-white outline-none transition-all resize-none ${className}`}
        {...props}
      />
    </label>
  );
}
