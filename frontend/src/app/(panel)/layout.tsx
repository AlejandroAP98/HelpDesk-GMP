"use client";

import { ReactNode, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import NotificationSettings from "@/components/NotificationSettings";
import CambiarPassword from "@/components/CambiarPassword";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const usuario = useAuthStore((s) => s.usuario);
  const esCliente = usuario?.rol === "cliente";

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenNotifications={() => setShowSettings(true)}
          onOpenPassword={() => setShowPassword(true)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden sticky top-0 z-20 bg-bgSiderBar px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-white"
                aria-label="Abrir menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-menu" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v0H0z"/><path d="M4 8h16M4 16h16"/></svg>
              </button>
              <span className="text-white text-lg font-bold">Soporte GMP</span>
            </div>
            {!esCliente && (
              <a href="https://app.gmpredes.online/" target="_blank" rel="noopener noreferrer" className="self-end justify-end sm:hidden block">
                <Button className="bg-gradient-to-r from-accentCustom text-nowrap to-red-600 hover:from-red-700 hover:to-red-700 !font-regular !sm:text-base !text-[12px] !self-end !rounded-lg">
                  Reportes GMP
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-external-link" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6m-7 1 9-9m-5 0h5v5"/></svg>
                </Button>
              </a>
              )}
          </header>
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto px-4 py-6 sm:px-6 w-full animate-fade-in min-h-screen">
              {children}
            </div>
          </main>
        </div>
        {showSettings && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowSettings(false)}
          >
            <div
              className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-bgCustom p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Configuracion</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  aria-label="Cerrar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="mt-4">
                <NotificationSettings />
              </div>
            </div>
          </div>
        )}
        {showPassword && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowPassword(false)}
          >
            <div
              className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-bgCustom p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Cambiar contrasena</h2>
                <button
                  onClick={() => setShowPassword(false)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                  aria-label="Cerrar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="mt-4">
                <CambiarPassword />
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}