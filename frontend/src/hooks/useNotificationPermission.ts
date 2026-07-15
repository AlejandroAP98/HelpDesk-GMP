"use client";

import { useCallback, useEffect, useState } from "react";

import {
  isCurrentlySubscribed,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/notifications";

export type PushState = "unsupported" | "loading" | "inactive" | "active" | "denied";

export interface UseNotificationPermissionResult {
  state: PushState;
  permission: NotificationPermission | "unsupported";
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useNotificationPermission(): UseNotificationPermissionResult {
  const [state, setState] = useState<PushState>("loading");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState("unsupported");
      setPermission("unsupported");
      return;
    }
    const perm = Notification.permission;
    setPermission(perm);
    if (perm === "denied") {
      setState("denied");
      return;
    }
    const active = await isCurrentlySubscribed();
    setState(active ? "active" : "inactive");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    try {
      const sub = await subscribeToPush();
      if (sub) {
        setState("active");
        setPermission("granted");
        return true;
      }
      await refresh();
      return false;
    } catch (e) {
      console.warn("[push] subscribe fallo:", e);
      await refresh();
      return false;
    }
  }, [refresh]);

  const unsubscribe = useCallback(async () => {
    try {
      await unsubscribeFromPush();
      setState("inactive");
      return true;
    } catch (e) {
      console.warn("[push] unsubscribe fallo:", e);
      return false;
    }
  }, []);

  return { state, permission, subscribe, unsubscribe, refresh };
}
