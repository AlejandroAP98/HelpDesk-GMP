"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Cargando...
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Redirigiendo a login...
      </div>
    );
  }
  return <>{children}</>;
}
