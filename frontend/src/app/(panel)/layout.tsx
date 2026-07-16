"use client";

import { ReactNode, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import NotificationSettings from "@/components/NotificationSettings";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-bgCustom">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenNotifications={() => setShowSettings(true)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden sticky top-0 z-20 bg-bgSiderBar px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-white"
              aria-label="Abrir menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-menu" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v0H0z"/><path d="M4 8h16M4 16h16"/></svg>
            </button>
            <span className="text-white text-lg font-bold">Soporte Técnico GMP Redes</span>
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
      </div>
    </AuthGuard>
  );
}