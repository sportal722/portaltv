"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Radio, LayoutDashboard, Shield, LogOut } from "lucide-react";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";
export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<User | null>("auth/me", { signal: c.signal })
      .then(setUser)
      .catch(() => {});
    return () => c.abort();
  }, []);
  return (
    <header className="site-header">
      <Link className="wordmark" href="/">
        <Radio size={25} />
        NEXORA<span>●</span>
      </Link>
      <nav aria-label="Navegación principal">
        <Link href="/">Explorar</Link>
        {user && (
          <>
            <Link href="/studio">
              <LayoutDashboard size={17} /> Mi estudio
            </Link>
            <Link href="/moderation">
              <Shield size={17} /> Moderación
            </Link>
            {user.role === "admin" && <Link href="/admin">Administración</Link>}
          </>
        )}
      </nav>
      <div className="account-actions">
        {user ? (
          <>
            <span>{user.username}</span>
            <button
              aria-label="Cerrar sesión"
              onClick={async () => {
                try {
                  await api("auth/logout", { method: "POST" });
                  location.href = "/";
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Entrar</Link>
            <Link href="/register" className="primary-button">
              Crear cuenta
            </Link>
          </>
        )}
        {error && <span role="alert">{error}</span>}
      </div>
    </header>
  );
}
