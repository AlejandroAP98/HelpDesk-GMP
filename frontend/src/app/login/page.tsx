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
import logo from "../assets/logo.svg";
import LoginIcon from "../assets/icons/LoginIcon";

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
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <form onSubmit={submit} className="space-y-5">
          <Card>
            <div className="text-center py-4">
              <img src={logo.src} alt="Logo" className="w-32 h-32 mx-auto" />
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
                autoFocus
              />

              <PasswordInput
                label="Contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="............"
                autoComplete="current-password"
              />
            </div>

            {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

            <div className="mt-5">
              <Button type="submit" loading={loading} icon={<LoginIcon className="w-5 h-5" />} className="w-full py-3 flex items-center gap-2">
                Ingresar al Panel
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </main>
  );
}
