"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { api } from "@/lib/api";

export default function CambiarPassword() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setBusy(true);
    try {
      const r = await api.post("/api/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setSuccess(r.data.detail ?? "Contraseña actualizada correctamente");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data: { detail?: string } } }).response?.data?.detail
          : "Error al cambiar la contraseña";
      setError(msg ?? "Error al cambiar la contraseña");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-base font-medium text-gray-900">Cambiar contraseña</h3>
      <p className="mt-1 text-sm text-gray-500">
        Ingresa tu contraseña actual y la nueva.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <PasswordInput
          label="Contraseña actual"
          required
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="Ingresa tu contraseña actual"
        />

        <div>
          <PasswordInput
            label="Nueva contraseña"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
          <p className="mt-1 text-xs text-gray-400">Mínimo 8 caracteres</p>
        </div>

        <PasswordInput
          label="Confirmar nueva contraseña"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repite la nueva contraseña"
        />

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{error}</p>
        )}
        {success && (
          <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">{success}</p>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Actualizando..." : "Cambiar contraseña"}
        </Button>
      </form>
    </div>
  );
}
