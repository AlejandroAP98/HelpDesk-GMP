"use client";

import { ReactNode, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import logo from "../assets/logo-white.svg";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-bgCustom">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden sticky top-0 z-20 bg-bgSiderBar px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-white"
              aria-label="Abrir menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-menu" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M4 8h16M4 16h16"/></svg>
            </button>
            <span className="text-white text-lg font-bold">Help Desk</span>
          </header>
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto px-4 py-6 sm:px-6 w-full animate-fade-in min-h-screen">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
