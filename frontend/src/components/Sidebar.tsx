"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import TicketIcon from "@/app/assets/icons/TicketIcon";
import HomeIcon from "@/app/assets/icons/HomeIcon";
import InboxIcon from "@/app/assets/icons/InboxIcon";
import NewTicketIcon from "@/app/assets/icons/NewTicketIcon";
import UsersIcon from "@/app/assets/icons/UsersIcon";
import CategoryIcon from "@/app/assets/icons/CategoryIcon";
import FactoryIcon from "@/app/assets/icons/FactoryIcon";
import CheckSquareIcon from "@/app/assets/icons/CheckSquareIcon";
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
    { href: "/tareas", label: "Tareas", icon: <CheckSquareIcon/> },
  ],
  administrador: [
    { href: "/", label: "Inicio", icon: <HomeIcon /> },
    { href: "/tickets", label: "Tickets", icon: <TicketIcon /> },
    { href: "/tareas", label: "Tareas", icon: <CheckSquareIcon/> },
    { href: "/admin/bandeja", label: "Bandeja abiertos", icon: <InboxIcon/> },
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
  ],
};

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenNotifications?: () => void;
}

export default function Sidebar({ open, onClose, onOpenNotifications }: SidebarProps) {
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
          <div className="flex items-start justify-between">
            <div className="flex items-center justify-center w-full">
              <img src={logo.src} alt="Logo GMP" className="w-28 h-auto " />
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

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto border-r border-brandCustom">
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
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                Notificaciones
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
