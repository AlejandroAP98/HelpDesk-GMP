"use client";

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "";

export const api = axios.create({ baseURL });

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

let refreshing: Promise<string | null> | null = null;

export async function silentRefresh(): Promise<string | null> {
  const { refreshToken, logout, setSession } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    return null;
  }
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const r = await axios.post(`${baseURL}/api/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const data = r.data;
      setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        usuario: data.usuario,
      });
      return data.access_token as string;
    } catch {
      logout();
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (status === 401 && !original._retry) {
      original._retry = true;
      const newToken = await silentRefresh();
      if (!newToken) {
        return Promise.reject(err);
      }
      if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }
    return Promise.reject(err);
  }
);
