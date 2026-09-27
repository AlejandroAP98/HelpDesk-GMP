"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { LoadingState } from "@/components/ui/LoadingState";

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
      <div className="min-h-screen bg-gray-50">
        <div className="pt-16 flex justify-center">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen">
        <div className="pt-16 flex justify-center">
          <LoadingState />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
