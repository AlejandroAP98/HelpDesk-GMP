"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import TicketIcon from "@/app/assets/icons/TicketIcon";
import HomeIcon from "@/app/assets/icons/HomeIcon";
import InboxIcon from "@/app/assets/icons/InboxIcon";
import NewTicketIcon from "@/app/assets/icons/NewTicketIcon";
import logo from "../app/assets/logo-white.svg";

const NAV: Record<string, { href: string; label: string; icon: React.ReactNode }[]> = {
  cliente: [
    { href: "/", label: "Inicio", icon: <HomeIcon /> },
    { href: "/tickets", label: "Mis tickets", icon: <TicketIcon/> },
    { href: "/tickets/nuevo", label: "Crear ticket", icon: <NewTicketIcon/> },
  ],
  agente: [
    { href: "/", label: "Inicio", icon: <HomeIcon/> },
    { href: "/tickets", label: "Tickets asignados", icon: <TicketIcon/> },
  ],
  administrador: [
    { href: "/", label: "Inicio", icon: <HomeIcon /> },
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
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-bgSiderBar flex flex-col shrink-0 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="py-4 border-b border-brandCustom">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-center w-full">
              <img src={logo.src} alt="Logo GMP" className="w-28 h-auto " />
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:text-gray-200 text-white transition-colors"
              aria-label="Cerrar menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" className="icon icon-tabler icons-tabler-outline icon-tabler-x" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto border-r border-brandCustom">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href) && pathname === "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5  text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-brandCustom text-white"
                    : "text-white hover:text-brandCustom hover:bg-bgCustom "
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1}>
                  {l.icon}
                </svg>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-brandCustom">
          <div className="bg-brandCustom/10 rounded-2xl p-4  ">
            <p className="font-semibold text-white truncate text-sm">{usuario?.nombre}</p>
            <p className="text-white/80 truncate text-xs mt-0.5">{usuario?.email}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="inline-block rounded-lg bg-brandCustom px-2.5 py-1 uppercase tracking-wider text-[10px] font-bold text-white">
                {rol}
              </span>
            </div>
            <Button
              onClick={handleLogout}
              variant="secondary"
              className="mt-3 w-full py-2"
            >
              Cerrar sesion
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
