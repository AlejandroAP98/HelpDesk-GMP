"use client";

import { pushApi } from "@/lib/endpoints";

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      getPlatform: () => string;
      isPluginAvailable: (name: string) => boolean;
    };
  }
}

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

function getCapacitorPlatform(): "ios" | "android" | null {
  if (!isCapacitorNative()) return null;
  const p = window.Capacitor?.getPlatform();
  if (p === "ios" || p === "android") return p;
  return null;
}

export function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (isCapacitorNative()) return true;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
}

async function subscribeNative(): Promise<boolean> {
  const { initPush, subscribeToNativePush } = await import("./capacitor/push");
  await initPush({});
  const result = await subscribeToNativePush();
  return result.ok;
}

export async function subscribeToPush(): Promise<unknown | null> {
  if (isCapacitorNative()) {
    const ok = await subscribeNative();
    return ok ? { native: true } : null;
  }

  if (!isPushSupported()) return null;
  if (Notification.permission === "denied") return null;
  if (Notification.permission === "default") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;
  }
  const reg = await getServiceWorkerRegistration();
  if (!reg) return null;
  const { public_key } = await pushApi.getVapidKey();
  if (!public_key) {
    throw new Error("VAPID public key no configurada en el backend");
  }
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch {
    }
    try {
      await pushApi.unsubscribe(existing.endpoint);
    } catch {
    }
  }
  const newSub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(public_key),
  });
  const json = newSub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("Subscription incompleta");
  }
  await pushApi.subscribe({
    endpoint: json.endpoint,
    keys: { p256dh, auth },
    plataforma: "web",
    user_agent: navigator.userAgent.slice(0, 255),
  });
  return newSub;
}

async function unsubscribeNative(): Promise<boolean> {
  const { unsubscribeFromNativePush } = await import("./capacitor/push");
  return unsubscribeFromNativePush();
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (isCapacitorNative()) {
    return unsubscribeNative();
  }
  if (!isPushSupported()) return false;
  const reg = await getServiceWorkerRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  const ok = await sub.unsubscribe();
  try {
    await pushApi.unsubscribe(endpoint);
  } catch {
  }
  return ok;
}

export async function isCurrentlySubscribed(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (isCapacitorNative()) {
    try {
      const { getPushPermission } = await import("./capacitor/push");
      const perm = await getPushPermission();
      return perm === "granted";
    } catch {
      return false;
    }
  }

  if (!isPushSupported()) return false;
  const reg = await getServiceWorkerRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export function getPlatformInfo(): "ios" | "android" | "web" {
  if (isCapacitorNative()) {
    return getCapacitorPlatform() ?? "web";
  }
  return "web";
}

export async function autoInitNativePush(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { initPush, getPushPermission, subscribeToNativePush } = await import("./capacitor/push");
    await initPush({
      onNotification: () => {},
      onActionClick: () => {},
    });
    const perm = await getPushPermission();
    if (perm === "granted") {
      await subscribeToNativePush();
    }
  } catch (e) {
    console.warn("Auto-init push error:", e);
  }
}
