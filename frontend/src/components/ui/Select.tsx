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
    <label className="flex flex-col gap-1 ">
      {label && (
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-normal">
          {label}
        </span>
      )}
      <select
        className={`w-full rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50 text-gray-700 px-2.5 py-2 text-sm focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} >
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
