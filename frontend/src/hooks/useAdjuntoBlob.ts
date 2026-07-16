"use client";

import { useEffect, useState } from "react";

import { fetchAdjuntoBlob } from "@/lib/adjuntoBlob";
import { useAuthStore } from "@/store/authStore";

export function useAdjuntoBlob(relativeUrl: string | null | undefined): {
  url: string | null;
  loading: boolean;
  error: string | null;
} {
  const token = useAuthStore((s) => s.token);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!relativeUrl || !token) {
      setUrl(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdjuntoBlob(relativeUrl, token)
      .then((u) => {
        if (!cancelled) {
          setUrl(u);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar la imagen");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [relativeUrl, token]);

  return { url, loading, error };
}
