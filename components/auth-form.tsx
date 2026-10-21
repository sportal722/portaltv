"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";
export function AuthForm({
  initialMode = "login",
  onAuthenticated,
}: {
  initialMode?: "login" | "register";
  onAuthenticated?: (user: User) => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <h2>
        {mode === "login"
          ? "Bienvenido de nuevo."
          : "Tu comunidad empieza aquí."}
      </h2>
      <p>
        {mode === "login"
          ? "Inicia sesión para seguir canales y participar en el chat."
          : "Crea una cuenta de espectador o creador."}
      </p>
      <div className="auth-tabs">
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Crear cuenta
        </button>
      </div>
      <form
        className="profile-form"
        key={mode}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const user = await api<User>(`auth/${mode}`, {
              method: "POST",
              body: JSON.stringify(values),
            });
            if (onAuthenticated) onAuthenticated(user);
            else {
              router.push("/");
              router.refresh();
            }
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "No se pudo iniciar sesión.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === "register" && (
          <>
            <label htmlFor="auth-username">Nombre de usuario</label>
            <input
              id="auth-username"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]{3,24}"
              title="Entre 3 y 24 letras, números o guiones bajos"
            />
          </>
        )}
        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
        />
        <label htmlFor="auth-password">Contraseña</label>
        <input
          id="auth-password"
          type="password"
          name="password"
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
          required
          minLength={12}
          maxLength={128}
        />
        {mode === "register" && (
          <>
            <label htmlFor="auth-role">¿Cómo quieres participar?</label>
            <select id="auth-role" name="role">
              <option value="viewer">Espectador</option>
              <option value="creator">Creador</option>
            </select>
          </>
        )}
        <small className="modal-footnote">
          Contraseña de al menos 12 caracteres.{" "}
          {mode === "register"
            ? "El email de recuperación y la verificación por correo aún no están disponibles."
            : ""}
        </small>
        {error && (
          <p className="api-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy
            ? "Conectando…"
            : mode === "register"
              ? "Crear cuenta"
              : "Iniciar sesión"}
        </button>
      </form>
    </>
  );
}
