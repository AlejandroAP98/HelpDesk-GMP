"use client";

import CopyInfoIcon from "@/app/assets/icons/CopyInfoIcon";

interface CopyFieldProps {
  label: string;
  value: string;
  fieldKey: string;
  copied: string | null;
  onCopy: (fieldKey: string, value: string) => void;
  innerClassName?: string;
  mono?: boolean;
}

export function CopyField({
  label,
  value,
  fieldKey,
  copied,
  onCopy,
  innerClassName = "",
  mono = false,
}: CopyFieldProps) {
  return (
    <div className="bg-borderCustom/20 border border-gray-100 rounded-xl sm:px-2 px-1 flex items-center justify-between">
      <div className={`min-w-0 ${innerClassName}`}>
        <dt className="text-[10px] text-gray-500 font-normal tracking-wider mb-0.5">{label}</dt>
        <dd className={`font-medium text-gray-700 text-[11px] truncate ${mono ? "font-mono" : ""}`}>{value}</dd>
      </div>
      <button
        type="button"
        onClick={() => onCopy(fieldKey, value)}
        className={`shrink-0 transition-colors p-0.5 ${copied === fieldKey ? "text-greenCustom" : "text-gray-400 hover:text-brandCustom"}`}
        title="Copiar"
      >
        <CopyInfoIcon copied={copied === fieldKey} />
      </button>
    </div>
  );
}
