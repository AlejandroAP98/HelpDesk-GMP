"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  cliente: [
    { href: "/", label: "Inicio", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
    { href: "/tickets", label: "Mis tickets", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    { href: "/tickets/nuevo", label: "Crear ticket", icon: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" },
  ],
  agente: [
    { href: "/", label: "Inicio", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
    { href: "/tickets", label: "Tickets asignados", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  ],
  administrador: [
    { href: "/", label: "Inicio", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
    { href: "/tickets", label: "Tickets", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { href: "/admin/bandeja", label: "Bandeja abiertos", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const rol = usuario?.rol ?? "cliente";
  const links = NAV[rol] ?? [];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand-sm">
            <span className="text-white font-bold text-base">H</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900">HelpDesk</h1>
            <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-widest">GMP tickets</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((l) => {
          const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <svg className={`w-5 h-5 shrink-0 ${active ? "text-brand-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
              </svg>
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <p className="font-semibold text-gray-900 truncate text-sm">{usuario?.nombre}</p>
          <p className="text-gray-400 truncate text-xs mt-0.5">{usuario?.email}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="inline-block rounded-lg bg-brand-50 border border-brand-100 px-2.5 py-1 uppercase tracking-wider text-[10px] font-bold text-brand-600">
              {rol}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-xl bg-gray-100 hover:bg-gray-200 py-2 text-gray-700 hover:text-gray-900 transition-all font-semibold text-sm border border-gray-200"
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    </aside>
  );
}
