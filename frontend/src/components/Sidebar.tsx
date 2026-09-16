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
import { whatsappUrl, mailtoUrl, contactoEmail } from "@/lib/contacto";
import logo from "../app/assets/logo-white.svg";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV: Record<string, NavSection[]> = {
  cliente: [
    {
      items: [
        { href: "/", label: "Inicio", icon: <HomeIcon /> },
        { href: "/tickets", label: "Mis Tickets", icon: <TicketIcon /> },
        { href: "/tickets/nuevo", label: "Crear Ticket", icon: <NewTicketIcon /> },
      ],
    },
  ],
  agente: [
    {
      items: [
        { href: "/", label: "Inicio", icon: <HomeIcon /> },
        { href: "/tickets", label: "Tickets Asignados", icon: <TicketIcon /> },
        { href: "/tareas", label: "Mis Tareas", icon: <CheckSquareIcon /> },
      ],
    },
  ],
  mesa_ayuda: [
    {
      items: [
        { href: "/", label: "Inicio", icon: <HomeIcon /> },
        { href: "/admin/bandeja", label: "Bandeja de Entrada", icon: <InboxIcon /> },
        { href: "/tickets", label: "Tickets", icon: <TicketIcon /> },
        { href: "/tareas", label: "Mis Tareas", icon: <CheckSquareIcon /> },
        { href: "/metricas", label: "Métricas", icon: <MetricsIcon /> },
      ],
    },
  ],
  administrador: [
    {
      title: "General",
      items: [
        { href: "/", label: "Inicio", icon: <HomeIcon /> },
        { href: "/admin/bandeja", label: "Bandeja de Entrada", icon: <InboxIcon /> },
        { href: "/tickets", label: "Tickets", icon: <TicketIcon /> },
        { href: "/tareas", label: "Mis Tareas", icon: <CheckSquareIcon /> },
        { href: "/metricas", label: "Métricas", icon: <MetricsIcon /> },
      ],
    },
    {
      title: "Administración",
      items: [
        { href: "/admin/empresas", label: "Empresas", icon: <FactoryIcon /> },
        { href: "/admin/usuarios", label: "Usuarios", icon: <UsersIcon /> },
        { href: "/admin/categorias", label: "Categorías", icon: <CategoryIcon /> },
        { href: "/admin/puntos-venta", label: "Puntos de Venta", icon: <SedesIcon /> },
      ],
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
            <div className="flex items-center justify-center w-full py-2">
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

        <nav className="flex-1 overflow-y-auto border-brandCustom overflow-hidden mt-4">
          {links.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              {section.title && (
                <div className="px-1.5 pt-2.5 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                    {section.title}
                  </span>
                </div>
              )}
              {section.items.map((l) => {
                const active = l.href === "/"
                  ? pathname === "/"
                  : pathname === l.href || (
                      pathname.startsWith(l.href + "/") &&
                      !section.items.some((o) => o.href !== l.href && o.href === pathname)
                    );
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={onClose}
                    className={`flex items-center justify-start gap-2 px-2 py-2.5 text-xs font-normal transition-all duration-300 border-b border-white/10 ${
                      active
                        ? "bg-brandCustom text-white font-semibold"
                        : "text-white hover:text-brandCustom hover:font-normal hover:bg-bgCustom"
                    }`}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1}>
                      {l.icon}
                    </svg>
                    {l.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="bg-brandCustom/20">
          {(whatsappUrl || mailtoUrl) && rol !== "agente" && rol !== "mesa_ayuda" && (
            <div>
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">Contactenos</span>
              <div className="mt-1 flex flex-col gap-0.5">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className="flex items-center gap-2 px-2 py-2 text-[11px] text-white/90 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-brand-whatsapp shrink-0" viewBox="0 0 24 24"><path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9"/><path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"/></svg>
                    WhatsApp
                  </a>
                )}
                {mailtoUrl && (
                  <a
                    href={mailtoUrl}
                    onClick={onClose}
                    title={contactoEmail ?? undefined}
                    className="flex items-center gap-2 px-2 py-2 text-[11px] text-white/90 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-mail shrink-0" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10"/><path d="M3 7l9 6l9 -6"/></svg>
                    <span className="truncate">Correo</span>
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="mb-1 px-2">
             <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">usuario</span>
          </div>
          {(onOpenNotifications || onOpenPassword) && (
            <div className="flex flex-col gap-0.5">
              {onOpenPassword && (
                <button
                  onClick={onOpenPassword}
                  className="flex items-center gap-2 px-2 py-2 text-[11px] text-white/90 hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-password-user shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 17v4m-2-1 4-2m-4 0 4 2m-9-3v4m-2-1 4-2m-4 0 4 2m12-3v4m-2-1 4-2m-4 0 4 2M9 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0m-2 8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2"/></svg>
                  <span className="truncate">Cambiar contraseña</span>
                </button>
              )}
              {onOpenNotifications && (
                <button
                  onClick={onOpenNotifications}
                  className="flex items-center gap-2 px-2 py-2 text-[11px] text-white/90 hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-bell-ringing shrink-0" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M10 5a2 2 0 0 1 4 0 7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6M9 17v1a3 3 0 0 0 6 0v-1m6-10.273A11.05 11.05 0 0 0 18.206 3M3 6.727A11.05 11.05 0 0 1 5.792 3"/></svg>
                  <span className="truncate">Notificaciones</span>
                </button>
              )}
            </div>
          )}
          <div className="my-3 px-2.5">
            <Button
              onClick={handleLogout}
              variant="secondary"
              className="w-full text-xs"
            >
              Cerrar sesion
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
