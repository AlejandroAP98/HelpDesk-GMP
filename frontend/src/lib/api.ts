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

let refreshing = false;

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (status === 401 && !original._retry) {
      original._retry = true;
      const rt = useAuthStore.getState().refreshToken;
      if (!rt || refreshing) {
        useAuthStore.getState().logout();
        return Promise.reject(err);
      }
      refreshing = true;
      try {
        const r = await axios.post(`${baseURL}/api/auth/refresh`, { refresh_token: rt });
        const data = r.data;
        useAuthStore.getState().setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          usuario: data.usuario,
        });
        refreshing = false;
        if (original.headers) original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (e) {
        refreshing = false;
        useAuthStore.getState().logout();
        return Promise.reject(e);
      }
    }
    return Promise.reject(err);
  }
);