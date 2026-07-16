"use client";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

export async function fetchAdjuntoBlob(
  relativeUrl: string,
  token: string,
): Promise<string> {
  const cached = cache.get(relativeUrl);
  if (cached) return cached;

  const existing = inflight.get(relativeUrl);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(`${apiBase}${relativeUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      inflight.delete(relativeUrl);
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cache.set(relativeUrl, url);
    inflight.delete(relativeUrl);
    return url;
  })();

  inflight.set(relativeUrl, promise);
  return promise;
}

export function evictAdjuntoBlob(relativeUrl: string): void {
  const url = cache.get(relativeUrl);
  if (url) {
    URL.revokeObjectURL(url);
    cache.delete(relativeUrl);
  }
  inflight.delete(relativeUrl);
}

export function evictAllAdjuntoBlobs(): void {
  for (const url of cache.values()) {
    URL.revokeObjectURL(url);
  }
  cache.clear();
  inflight.clear();
}
