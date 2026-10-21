"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { User } from "@/lib/types";
export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<User[]>("admin/users", { signal: controller.signal })
      .then(setUsers)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  return (
    <main className="admin-page">
      <Link href="/">← Volver a NEXORA</Link>
      <h1>Moderación de la comunidad</h1>
      <p>Solo los administradores pueden consultar y modificar estos datos.</p>
      {loading && <p role="status">Cargando…</p>}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      <div className="admin-list">
        {users.map((user) => (
          <article key={user.id}>
            <strong>{user.username}</strong>
            <span>{user.role}</span>
            <label>
              Estado de {user.username}
              <select
                value={user.status}
                disabled={busy}
                onChange={async (event) => {
                  setBusy(true);
                  setError("");
                  try {
                    const updated = await api<User>("admin/users", {
                      method: "PATCH",
                      body: JSON.stringify({
                        id: user.id,
                        status: event.target.value,
                      }),
                    });
                    setUsers((current) =>
                      current.map((u) => (u.id === updated.id ? updated : u)),
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "No se pudo actualizar el usuario.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <option value="active">Activo</option>
                <option value="muted">Silenciado</option>
                <option value="banned">Suspendido</option>
              </select>
            </label>
          </article>
        ))}
      </div>
    </main>
  );
}
