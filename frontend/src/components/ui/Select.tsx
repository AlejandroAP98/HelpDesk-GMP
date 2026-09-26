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
    <label className="flex flex-col">
      {label && (
        <span className="sm:text-[11px] text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">
          {label}
        </span>
      )}
      <select
        className={`w-full rounded-xl sm:min-w-32 border disabled:opacity-50 disabled:cursor-not-allowed bg-white text-gray-700 px-2.5 py-2.5 text-xs focus:ring-1 focus:ring-brandCustom outline-none transition-all cursor-pointer ${className}`}
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
