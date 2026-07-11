import type { SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  options,
  placeholder,
  className = "",
  ...props
}: SelectProps) {
  return (
    <label className="block">
      {label && (
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
          {label}
        </span>
      )}
      <select
        className={`w-full rounded-xl border border-gray-200 bg-white text-gray-700 px-4 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
