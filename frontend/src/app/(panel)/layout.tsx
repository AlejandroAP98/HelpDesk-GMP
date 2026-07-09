"use client";

import { ReactNode, useState } from "react";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-bgCustom">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Abrir menu"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brandCustom to-brandCustom flex items-center justify-center">
                <span className="text-white font-bold text-xs">H</span>
              </div>
              <span className="text-sm font-bold tracking-tight text-gray-900">HelpDesk</span>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto px-4 py-6 sm:px-6 w-full animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
