import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
