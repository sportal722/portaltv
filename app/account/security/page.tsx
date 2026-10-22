"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountData } from "@/components/account-data";
import { SiteHeader } from "@/components/site-header";
import { api } from "@/lib/client";
type Security = {
  twoFactorEnabled: boolean;
  configured: boolean;
  recoveryCodesRemaining: number;
};
type Session = {
  id: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};
export default function SecurityPage() {
  const [security, setSecurity] = useState<Security | null>(null),
    [sessions, setSessions] = useState<Session[]>([]);
  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [newPassword, setNewPassword] = useState("");
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(
    null,
  );
  const [codes, setCodes] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function refresh() {
    const [status, list] = await Promise.all([
      api<Security>("account/security"),
      api<Session[]>("account/sessions"),
    ]);
    setSecurity(status);
    setSessions(list);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function factor(path: string, method: string) {
    return api<{ recoveryCodes?: string[] }>(path, {
      method,
      body: JSON.stringify({ password, code }),
    });
  }
  return (
    <>
      <SiteHeader />
      <main className="security-page">
        <Link href="/">← Volver</Link>
        <h1>Seguridad de tu cuenta</h1>
        {error && (
          <p role="alert" className="api-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {!security && !error && <p>Cargando…</p>}
        {security && (
          <>
            <section className="panel">
              <h2>Autenticación en dos pasos</h2>
              <p>
                {security.twoFactorEnabled
                  ? `Activa. Quedan ${security.recoveryCodesRemaining} códigos de recuperación.`
                  : "Añade una comprobación con tu aplicación de autenticación al iniciar sesión."}
              </p>
              {!security.configured && (
                <p>
                  La configuración de seguridad del servidor está pendiente.
                </p>
              )}
              <div className="profile-form">
                <label htmlFor="security-password">Contraseña actual</label>
                <input
                  id="security-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  maxLength={128}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {(setup || security.twoFactorEnabled) && (
                  <>
                    <label htmlFor="security-code">
                      Código del autenticador
                      {security.twoFactorEnabled ? " o de recuperación" : ""}
                    </label>
                    <input
                      id="security-code"
                      autoComplete="one-time-code"
                      maxLength={19}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <small>
                      Cada código se usa una sola vez. Si acabas de usarlo,
                      espera el siguiente.
                    </small>
                  </>
                )}
                {!security.twoFactorEnabled && !setup && (
                  <button
                    className="primary-button"
                    disabled={busy || !password || !security.configured}
                    onClick={() =>
                      action(async () => {
                        setCodes([]);
                        setSetup(
                          await api("account/two-factor/setup", {
                            method: "POST",
                            body: JSON.stringify({ password }),
                          }),
                        );
                      })
                    }
                  >
                    Configurar autenticador
                  </button>
                )}
                {setup && (
                  <div className="two-factor-setup">
                    <p>
                      Escanea el QR con tu autenticador o introduce la clave
                      manualmente. Confirma un código antes de 10 minutos.
                    </p>
                    <img
                      src={setup.qrCode}
                      width={220}
                      height={220}
                      alt="Código QR para configurar tu autenticador"
                    />
                    <code>{setup.secret}</code>
                    <button
                      className="primary-button"
                      disabled={busy || !code || !password}
                      onClick={() =>
                        action(async () => {
                          const data = await factor(
                            "account/two-factor/confirm",
                            "POST",
                          );
                          setCodes(data.recoveryCodes || []);
                          setSetup(null);
                          setCode("");
                          setPassword("");
                          setMessage(
                            "Autenticación activada. Las demás sesiones se han cerrado.",
                          );
                        })
                      }
                    >
                      Activar autenticación en dos pasos
                    </button>
                  </div>
                )}
                {security.twoFactorEnabled && (
                  <div className="security-actions">
                    <button
                      disabled={busy || !password || !code}
                      onClick={() =>
                        action(async () => {
                          const data = await factor(
                            "account/two-factor/recovery",
                            "POST",
                          );
                          setCodes(data.recoveryCodes || []);
                          setCode("");
                          setMessage(
                            "Los códigos anteriores ya no son válidos.",
                          );
                        })
                      }
                    >
                      Renovar códigos de recuperación
                    </button>
                    <button
                      disabled={busy || !password || !code}
                      onClick={() => {
                        if (
                          !confirm(
                            "¿Desactivar la autenticación en dos pasos? También se cerrarán las demás sesiones.",
                          )
                        )
                          return;
                        void action(async () => {
                          await factor("account/two-factor", "DELETE");
                          setCodes([]);
                          setCode("");
                          setPassword("");
                          setMessage("Autenticación en dos pasos desactivada.");
                        });
                      }}
                    >
                      Desactivar 2FA
                    </button>
                  </div>
                )}
              </div>
              {codes.length > 0 && (
                <div className="recovery-codes">
                  <h3>Guarda estos códigos en un lugar seguro</h3>
                  <p>
                    Solo se muestran ahora. Cada uno sirve para un único acceso
                    si pierdes el autenticador.
                  </p>
                  <pre>{codes.join("\n")}</pre>
                  <button
                    onClick={() => {
                      const blob = new Blob(
                        [
                          `NEXORA — códigos de recuperación\n${codes.join("\n")}\n`,
                        ],
                        { type: "text/plain" },
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "nexora-codigos-recuperacion.txt";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    Descargar códigos
                  </button>
                  <button onClick={() => setCodes([])}>
                    Ya los he guardado
                  </button>
                </div>
              )}
            </section>
            <section className="panel">
              <h2>Cambiar contraseña</h2>
              <p>
                Usa la contraseña actual y, si tienes 2FA, el código del
                formulario anterior. Se cerrarán las demás sesiones.
              </p>
              <form
                className="profile-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await api("account/password", {
                      method: "PATCH",
                      body: JSON.stringify({ password, code, newPassword }),
                    });
                    setPassword("");
                    setCode("");
                    setNewPassword("");
                    setSetup(null);
                    setMessage(
                      "Contraseña actualizada y demás sesiones cerradas.",
                    );
                  });
                }}
              >
                <label htmlFor="new-password">Nueva contraseña</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button className="primary-button" disabled={busy || !password}>
                  Cambiar contraseña
                </button>
              </form>
            </section>
            <section className="panel">
              <h2>Sesiones abiertas</h2>
              <p>
                Identifica tus dispositivos por su navegador y la fecha de
                acceso. La descripción del navegador puede no ser exacta.
              </p>
              <button
                disabled={busy || sessions.length < 2}
                onClick={() =>
                  action(async () => {
                    await api("account/sessions", { method: "DELETE" });
                    setMessage("Las demás sesiones se han cerrado.");
                  })
                }
              >
                Cerrar las demás sesiones
              </button>
              <div className="session-list">
                {sessions.map((s) => (
                  <article key={s.id}>
                    <strong>{s.current ? "Esta sesión" : "Otra sesión"}</strong>
                    <p>{s.userAgent || "Dispositivo sin identificar"}</p>
                    <p>
                      Acceso: {new Date(s.createdAt).toLocaleString("es")} ·
                      Caduca: {new Date(s.expiresAt).toLocaleString("es")}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await api(`account/sessions/${s.id}`, {
                            method: "DELETE",
                          });
                          if (s.current) location.href = "/login";
                          else setMessage("Sesión cerrada.");
                        })
                      }
                    >
                      Cerrar sesión
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <AccountData />
          </>
        )}
      </main>
    </>
  );
}
