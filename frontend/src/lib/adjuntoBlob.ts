"use client";

const MAX_CACHE_ENTRIES = 30;

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

function evictOldest(): void {
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    const url = cache.get(oldestKey);
    if (url) URL.revokeObjectURL(url);
    cache.delete(oldestKey);
  }
}

export async function fetchAdjuntoBlob(
  relativeUrl: string,
  token: string,
): Promise<string> {
  const cached = cache.get(relativeUrl);
  if (cached) {
    cache.delete(relativeUrl);
    cache.set(relativeUrl, cached);
    return cached;
  }

  const existing = inflight.get(relativeUrl);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(`${apiBase}${relativeUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      inflight.delete(relativeUrl);
      if (res.status === 404) {
        throw new Error("not_found");
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    evictOldest();
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
