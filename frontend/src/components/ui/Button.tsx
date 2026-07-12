import type { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  children: ReactNode;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  loading = false,
  children,
  className = "",
  disabled,
  icon,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50";

  const styles = {
    primary: "bg-brandCustom text-white hover:bg-brandCustom/90 shadow-brand",
    secondary: "border border-gray-300 bg-white hover:bg-gray-50 text-grayCustom",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  };

  return (
    <button
      className={`${base} ${styles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2 ">
          {children}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" className=" w-4 h-4 icon icon-tabler icons-tabler-outline icon-tabler-loader-2 animate-spin" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 3a9 9 0 1 0 9 9"/></svg></div>
      ) : (
        <div className="flex items-center gap-2">
          {children}
          {icon}
        </div>
      )}
    </button>
  );
}
