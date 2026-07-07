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
      <body className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-700">Error en runtime</h2>
          <pre className="mt-2 text-xs text-slate-700 overflow-auto">
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
          <button
            onClick={reset}
            className="mt-4 rounded bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}