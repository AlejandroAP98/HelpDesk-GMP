"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 shadow-card">
          <h2 className="text-xl font-bold text-red-600 tracking-tight">Error en ejecucion</h2>
          <pre className="mt-4 text-xs text-gray-600 overflow-auto p-4 rounded-xl border border-gray-100 bg-gray-50 leading-relaxed max-h-60">
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
          <button
            onClick={reset}
            className="mt-6 rounded-xl bg-brandCustom px-5 py-2.5 text-sm font-semibold text-white hover:bg-brandCustom/90 shadow-brand active:scale-[0.98] transition-all"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}