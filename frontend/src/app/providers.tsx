"use client";

import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import UrgentToasts from "@/components/UrgentToasts";

function RealtimeListener() {
  useRealtimeNotifications();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RealtimeListener />
      <UrgentToasts />
    </>
  );
}
