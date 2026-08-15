"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import TicketIcon from "@/app/assets/icons/TicketIcon";
import HomeIcon from "@/app/assets/icons/HomeIcon";
import InboxIcon from "@/app/assets/icons/InboxIcon";
import NewTicketIcon from "@/app/assets/icons/NewTicketIconSiderbar";
import UsersIcon from "@/app/assets/icons/UsersIcon";
import CategoryIcon from "@/app/assets/icons/CategoryIcon";
import FactoryIcon from "@/app/assets/icons/FactoryIcon";
import CheckSquareIcon from "@/app/assets/icons/CheckSquareIcon";
import MetricsIcon from "@/app/assets/icons/MetricsIcon";
import SedesIcon from "@/app/assets/icons/SedesIcon";
import logo from "../app/assets/logo-white.svg";

const NAV: Record<string, { href: string; label: string; icon: React.ReactNode; }[]> = {
  cliente: [
    { href: "/", label: "Inicio", icon: <HomeIcon />  },
    { href: "/tickets", label: "Mis Tickets", icon: <TicketIcon /> },
    { href: "/tickets/nuevo", label: "Crear Ticket", icon: <NewTicketIcon /> },
  ],
  agente: [
    { href: "/", label: "Inicio", icon: <HomeIcon/> },
    { href: "/tickets", label: "Tickets Asignados", icon: <TicketIcon/> },
    { href: "/tareas", label: "Mis Tareas", icon: <CheckSquareIcon/> },
  ],
  mesa_ayuda: [
    { href: "/", label: "Inicio", icon: <HomeIcon /> },
    { href: "/admin/bandeja", label: "Bandeja de Entrada", icon: <InboxIcon /> },
    { href: "/tickets", label: "Tickets", icon: <TicketIcon /> },
    { href: "/tareas", label: "Mis Tareas", icon: <CheckSquareIcon /> },
    { href: "/metricas", label: "Métricas", icon: <MetricsIcon /> },
  ],
  administrador: [
    { href: "/", label: "Inicio", icon: <HomeIcon /> },
    { href: "/admin/bandeja", label: "Bandeja de Entrada", icon: <InboxIcon/> },
    { href: "/tickets", label: "Tickets", icon: <TicketIcon /> },
    { href: "/tareas", label: "Mis Tareas", icon: <CheckSquareIcon/> },
    {
      href: "/metricas",
      label: "Métricas",
      icon: (
        <MetricsIcon/>
      ),
    },
    {
      href: "/admin/empresas",
      label: "Empresas",
      icon: (
        <FactoryIcon/>
      ),
    },
    {
      href: "/admin/usuarios",
      label: "Usuarios",
      icon: <UsersIcon/>,
    },
    {
      href: "/admin/categorias",
      label: "Categorías",
      icon: (
        <CategoryIcon/>
      ),
    },
    {
      href: "/admin/puntos-venta",
      label: "Puntos de Venta",
      icon: <SedesIcon/>,
    },
  ],
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenNotifications?: () => void;
  onOpenPassword?: () => void;
}

export default function Sidebar({ open, onClose, onOpenNotifications, onOpenPassword }: SidebarProps) {
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
          className="fixed inset-0 z-30 bg-black/30 lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-48 min-w-48 bg-bgSiderBar flex flex-col shrink-0 transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="">
          <div className="flex items-start h-full justify-between bg-brandCustom/20">
            <div className="flex items-center justify-center w-full py-4">
              <img src={logo.src} alt="Logo GMP" className="w-28  h-auto" />
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:text-gray-200 text-white transition-colors"
              aria-label="Cerrar menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-x" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto border-brandCustom overflow-hidden">
          {links.map((l) => {
            const active = l.href === "/"
              ? pathname === "/"
              : pathname === l.href || (
                  pathname.startsWith(l.href + "/") &&
                  !links.some((o) => o.href !== l.href && o.href === pathname)
                );
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onClose}
                className={`flex items-center justify-start gap-2 px-2 py-2.5  text-sm font-light transition-all duration-300 border-t border-white/10  last:border-b last:border-white/10  ${
                  active
                    ? "bg-brandCustom text-white font-normal "
                    : "text-white hover:text-brandCustom hover:font-normal hover:bg-bgCustom hover:scale-[1.03]"
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1}>
                  {l.icon }
                </svg>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="bg-brandCustom/20 p-2">
          <div>
            <p className="font-medium text-white truncate text-sm">{usuario?.nombre}</p>
            <p className="text-white/80 truncate text-xs mt-0.5">{usuario?.email}</p>
            <Button
              onClick={handleLogout}
              variant="secondary"
              className="mt-4 w-full"
            >
              Cerrar sesion
            </Button>
            {(onOpenNotifications || onOpenPassword) && (
              <div className="mt-2 flex gap-2">
                {onOpenPassword && (
                  <button
                    onClick={onOpenPassword}
                    title="Cambiar contraseña"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl p-2 text-xs font-normal text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-password-user" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 17v4m-2-1 4-2m-4 0 4 2m-9-3v4m-2-1 4-2m-4 0 4 2m12-3v4m-2-1 4-2m-4 0 4 2M9 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0m-2 8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2"/></svg>
                  </button>
                )}
                {onOpenNotifications && (
                  <button
                    title="Notificaciones"
                    onClick={onOpenNotifications}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl p-2 text-xs font-normal text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-bell-ringing" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M10 5a2 2 0 0 1 4 0 7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6M9 17v1a3 3 0 0 0 6 0v-1m6-10.273A11.05 11.05 0 0 0 18.206 3M3 6.727A11.05 11.05 0 0 1 5.792 3"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
