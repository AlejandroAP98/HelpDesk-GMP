"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

const NAV: Record<string, { href: string; label: string }[]> = {
  cliente: [
    { href: "/", label: "Inicio" },
    { href: "/tickets", label: "Mis tickets" },
    { href: "/tickets/nuevo", label: "Crear ticket" },
  ],
  agente: [
    { href: "/", label: "Inicio" },
    { href: "/tickets", label: "Tickets asignados" },
  ],
  administrador: [
    { href: "/", label: "Inicio" },
    { href: "/tickets", label: "Tickets" },
    { href: "/admin/bandeja", label: "Bandeja abiertos" },
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
    <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
      <div className="px-4 py-5 border-b border-slate-700">
        <h1 className="text-lg font-bold">HelpDesk</h1>
        <p className="text-xs text-slate-400">GMP tickets</p>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {links.map((l) => {
          const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                active ? "bg-brand text-white" : "hover:bg-slate-800"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-700 text-xs">
        <p className="font-semibold text-slate-200 truncate">{usuario?.nombre}</p>
        <p className="text-slate-400">{usuario?.email}</p>
        <p className="mt-1 inline-block rounded bg-slate-700 px-2 py-0.5 uppercase tracking-wide text-[10px]">
          {rol}
        </p>
        <button
          onClick={handleLogout}
          className="mt-2 w-full rounded border border-slate-700 px-2 py-1 hover:bg-slate-800"
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}