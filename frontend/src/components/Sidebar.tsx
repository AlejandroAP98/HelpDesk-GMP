"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import TicketIcon from "@/app/assets/icons/TicketIcon";
import HomeIcon from "@/app/assets/icons/HomeIcon";
import InboxIcon from "@/app/assets/icons/InboxIcon";

const NAV: Record<string, { href: string; label: string; icon: React.ReactNode }[]> = {
  cliente: [
    { href: "/", label: "Inicio", icon: <HomeIcon/> },
    { href: "/tickets", label: "Mis tickets", icon: <TicketIcon/> },
    { href: "/tickets/nuevo", label: "Crear ticket", icon: <TicketIcon/> },
  ],
  agente: [
    { href: "/", label: "Inicio", icon: <HomeIcon/> },
    { href: "/tickets", label: "Tickets asignados", icon: <TicketIcon/> },
  ],
  administrador: [
    { href: "/", label: "Inicio", icon: <HomeIcon/> },
    { href: "/tickets", label: "Tickets", icon: <TicketIcon /> },
    { href: "/admin/bandeja", label: "Bandeja abiertos", icon: <InboxIcon/> },
  ],
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
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
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex flex-col shrink-0 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brandCustom to-brandCustom flex items-center justify-center shadow-brandCustom">
                <span className="text-white font-bold text-base">H</span>
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-gray-900">HelpDesk</h1>
                <p className="text-[10px] font-semibold text-brandCustom uppercase tracking-widest">GMP tickets</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Cerrar menu"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-brand-50 text-brandCustom"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <svg className={`w-5 h-5 shrink-0 ${active ? "text-brandCustom" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
                  {l.icon}
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
    </>
  );
}
