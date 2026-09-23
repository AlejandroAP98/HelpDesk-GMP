"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { evictAllAdjuntoBlobs } from "@/lib/adjuntoBlob";

export type Rol = "cliente" | "agente" | "mesa_ayuda" | "administrador";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  empresa_id: number | null;
  notificaciones_email: boolean;
  activo: boolean;
  fecha_creacion: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  usuario: Usuario | null;
  setSession: (s: { access_token: string; refresh_token: string; usuario: Usuario }) => void;
  updateUsuario: (u: Partial<Usuario>) => void;
  logout: () => void;
  hasRole: (...roles: Rol[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      usuario: null,
      setSession: (s) =>
        set({
          token: s.access_token,
          refreshToken: s.refresh_token,
          usuario: s.usuario,
        }),
      updateUsuario: (u) =>
        set((state) => ({
          usuario: state.usuario ? { ...state.usuario, ...u } : null,
        })),
      logout: () => {
        evictAllAdjuntoBlobs();
        set({ token: null, refreshToken: null, usuario: null });
      },
      hasRole: (...roles) => {
        const u = get().usuario;
        return !!u && roles.includes(u.rol);
      },
    }),
    {
      name: "helpdesk-auth",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") return localStorage;
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
      }),
    }
  )
);
