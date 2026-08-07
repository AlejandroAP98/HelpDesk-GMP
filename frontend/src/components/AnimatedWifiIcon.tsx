"use client";

export default function AnimatedWifiIcon() {
  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-[#508484]"
      >
        <path
          d="M2 8.5C5.5 5 9.5 3 12 3s6.5 2 10 5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="animate-wifi-pulse opacity-15"
        />
        <path
          d="M5 11.5C7.5 9 9.5 7.5 12 7.5s4.5 1.5 7 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="animate-wifi-pulse opacity-40 [animation-delay:0.3s]"
        />
        <path
          d="M8 14.5C9.5 13 10.5 12 12 12s2.5 1 4 2.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="animate-wifi-pulse opacity-70 [animation-delay:0.6s]"
        />
        <circle
          cx="12"
          cy="18"
          r="1.5"
          fill="currentColor"
          className="animate-wifi-dot"
        />
      </svg>
      <span className="text-sm font-normal text-[#508484] animate-pulse">Cargando...</span>
    </div>
  );
}
