"use client";

import { useEffect } from "react";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import UrgentToasts from "@/components/UrgentToasts";
import { useAuthStore } from "@/store/authStore";
import { silentRefresh } from "@/lib/api";
import { getTokenExp } from "@/lib/token";

const REFRESH_MARGIN_S = 120;
const TICK_MS = 30_000;

function TokenRefresher() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      const current = useAuthStore.getState().token;
      if (!current) return;
      const exp = getTokenExp(current);
      if (exp === null) return;
      const remaining = exp - Date.now() / 1000;
      if (remaining <= REFRESH_MARGIN_S) {
        void silentRefresh();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [token]);

  return null;
}

function RealtimeListener() {
  useRealtimeNotifications();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TokenRefresher />
      <RealtimeListener />
      <UrgentToasts />
    </>
  );
}
