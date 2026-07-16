"use client";

import { pushApi } from "@/lib/endpoints";

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
}

function getCapacitorPlatform(): "ios" | "android" | null {
  if (!isCapacitorNative()) return null;
  const p = window.Capacitor?.getPlatform?.();
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

async function waitForCapacitor(maxMs = 5000): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Capacitor && window.Capacitor.isNativePlatform?.()) return true;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 100));
    if (window.Capacitor && window.Capacitor.isNativePlatform?.()) {
      return true;
    }
  }
  return false;
}

async function subscribeNative(): Promise<boolean> {
  console.log("[push] subscribeNative: intentando...");
  try {
    const { initPush, subscribeToNativePush } = await import("./capacitor/push");
    await initPush({
      onNotification: () => {},
      onActionClick: () => {},
    });
    const result = await subscribeToNativePush();
    console.log("[push] subscribeNative result:", result);
    return result.ok;
  } catch (e) {
    console.error("[push] subscribeNative error:", e);
    return false;
  }
}

export async function subscribeToPush(): Promise<unknown | null> {
  if (isCapacitorNative()) {
    console.log("[push] detectado Capacitor nativo, usando FCM");
    const ok = await subscribeNative();
    return ok ? { native: true } : null;
  }

  const isNative = await waitForCapacitor(3000);
  if (isNative) {
    console.log("[push] Capacitor detectado tras espera, usando FCM");
    const ok = await subscribeNative();
    return ok ? { native: true } : null;
  }

  console.log("[push] no es nativo, usando Web Push VAPID");
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
  try {
    const { unsubscribeFromNativePush } = await import("./capacitor/push");
    return unsubscribeFromNativePush();
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (isCapacitorNative() || (await waitForCapacitor(2000))) {
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

  if (isCapacitorNative() || (await waitForCapacitor(3000))) {
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

export async function getNativePermissionState(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
  if (isCapacitorNative() || (await waitForCapacitor(3000))) {
    try {
      const { getPushPermission } = await import("./capacitor/push");
      return await getPushPermission();
    } catch {
      return "unsupported";
    }
  }
  return "unsupported";
}

export async function autoInitNativePush(): Promise<void> {
  console.log("[push] autoInitNativePush: starting...");
  const isNative = await waitForCapacitor(5000);
  if (!isNative) {
    console.log("[push] autoInitNativePush: no es nativo, saltando");
    return;
  }
  console.log("[push] autoInitNativePush: Capacitor detectado, inicializando...");
  try {
    const { initPush, getPushPermission, subscribeToNativePush } = await import("./capacitor/push");
    await initPush({
      onNotification: () => {},
      onActionClick: () => {},
    });
    const perm = await getPushPermission();
    console.log("[push] autoInitNativePush: perm状态=", perm);
    if (perm === "granted") {
      await subscribeToNativePush();
      console.log("[push] autoInitNativePush: suscrito automaticamente");
    }
  } catch (e) {
    console.warn("[push] autoInitNativePush error:", e);
  }
}

export function getPlatformInfo(): "ios" | "android" | "web" {
  if (isCapacitorNative()) {
    return getCapacitorPlatform() ?? "web";
  }
  return "web";
}

export function isNotificationApiAvailable(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}