"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import CloudBackground from "@/components/CloudBackground";
import logo from "../assets/logo.svg";
import LoginIcon from "../assets/icons/LoginIcon";
import torre from "../assets/torre.webp";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      setSession(data);
      router.push("/");
    } catch {
      setError("Credenciales invalidas o usuario inexistente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center z-0 justify-center p-4 overflow-hidden relative">
      <CloudBackground />
      <img
        src={torre.src}
        alt="Torre"
        className="w-[550px] h-auto object-cover absolute bottom-0 -right-3 -z-10 pointer-events-none"
      />

      <div className="w-full max-w-sm animate-scale-in relative z-10">
        <form onSubmit={submit} className="space-y-5">
          <Card>
            <div className="text-center py-4">
              <img src={logo.src} alt="Logo" className="w-36 h-36 mx-auto" />
            </div>
            
            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ingresa tu correo electrónico"
                autoComplete="email"
                className="!text-sm !pl-12"
                autoFocus
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="gray" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-at" viewBox="0 0 24 24">
                    <path fill="none" stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0"/>
                    <path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.28"/>
                  </svg>
                }
              />
              <PasswordInput
                label="Contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                autoComplete="current-password"
                className="!text-sm !pl-12"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="gray" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-lock-password" viewBox="0 0 24 24">
                    <path fill="none" stroke="none" d="M0 0h24v24H0z"/>
                    <path d="M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zm3-2V7a4 4 0 1 1 8 0v4m-1 5h.01m-3 0h.01m-3 0h.01"/>
                  </svg>
                }
              />
            </div>

            {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

            <div className="mt-5">
              <Button type="submit" loading={loading} icon={<LoginIcon className="w-5 h-5" />} className="w-full py-3 flex items-center gap-2">
                Ingresar al sistema
              </Button>
            </div>
          </Card>
        </form>
      </div>

      <footer className="text-gray-300 font-light absolute bottom-2 right-4 text-xs z-10">
        <a href="https://github.com/AlejandroAP98/" target="_blank" rel="noreferrer">GMP Redes &copy; 2026</a>
      </footer>
    </main>
  );
}
