"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      setSession(data);
      router.push("/");
    } catch {
      setError("Credenciales invalidas o usuario inexistente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-5 shadow-lg shadow-brand-200">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            HelpDesk<span className="text-brand-600">.</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">Inicie sesion para continuar</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-card border border-gray-100 p-8 space-y-5">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 focus:bg-white outline-none transition-all"
                placeholder="admin@helpdesk.com"
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Contrasena</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 focus:bg-white outline-none transition-all"
                placeholder="............"
                autoComplete="current-password"
              />
            </label>
          </div>

          {error && (
            <div className="animate-fade-in rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3 text-sm font-semibold text-white hover:from-brand-500 hover:to-brand-400 shadow-brand active:scale-[0.98] disabled:opacity-50 transition-all duration-200"
          >
            {loading ? "Verificando..." : "Ingresar al Panel"}
          </button>

          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Demo Access</p>
            <p className="text-xs text-gray-500 font-mono">admin@helpdesk.com / Admin123456</p>
          </div>
        </form>
      </div>
    </main>
  );
}
