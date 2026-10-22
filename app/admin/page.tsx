"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { SiteHeader } from "@/components/site-header";
import type { User, Stream } from "@/lib/types";
type Overview = {
  users: number;
  channels: number;
  followers: number;
  reports: number;
  staff: number;
  securedStaff: number;
  live: number | null;
  video: string;
  worker: string[] | null;
  actorRole: string;
  workerHealth: string;
  checkedAt: string;
};
type Audit = {
  id: number;
  actorName: string;
  action: string;
  target: string;
  createdAt: string;
};
type Report = {
  id: number;
  reporter: string;
  reason: string;
  description: string;
  status: string;
  resolution: string;
  channel: { slug: string; title: string } | null;
};
export default function Admin() {
  const [overview, setOverview] = useState<Overview | null>(null),
    [tab, setTab] = useState("Resumen"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [users, setUsers] = useState<User[]>([]),
    [channels, setChannels] = useState<Stream[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [audit, setAudit] = useState<Audit[]>([]);
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [reportStatus, setReportStatus] = useState("open");
  const [settings, setSettings] = useState({
      registrationOpen: true,
      announcement: "",
    }),
    [password, setPassword] = useState(""),
    [code, setCode] = useState("");
  const admin = overview?.actorRole === "admin";
  async function load() {
    const o = await api<Overview>("admin/overview");
    setOverview(o);
    if (tab === "Usuarios")
      setUsers(
        await api(`admin/users?q=${encodeURIComponent(query)}&page=${page}`),
      );
    if (tab === "Canales")
      setChannels(
        await api(`admin/channels?q=${encodeURIComponent(query)}&page=${page}`),
      );
    if (tab === "Denuncias")
      setReports(await api(`admin/reports?status=${reportStatus}`));
    if (tab === "Auditoría") setAudit(await api("admin/audit"));
    if (tab === "Configuración") setSettings(await api("admin/settings"));
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [tab, page, reportStatus]);
  useEffect(() => {
    const timer = setInterval(() => {
      void api<Overview>("admin/overview")
        .then(setOverview)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  async function action(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
      setMessage("Cambio guardado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="admin-page">
        <Link href="/">← Volver</Link>
        <h1>Centro de control global</h1>
        <p>Operaciones, comunidad y seguridad de NEXORA.</p>
        {error && (
          <p className="api-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {overview && (
          <>
            <nav
              className="admin-tabs"
              aria-label="Secciones de administración"
            >
              {[
                "Resumen",
                "Usuarios",
                "Canales",
                "Denuncias",
                "Auditoría",
                ...(admin ? ["Configuración"] : []),
              ].map((t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => {
                    setTab(t);
                    setPage(0);
                    setQuery("");
                    setError("");
                  }}
                >
                  {t}
                </button>
              ))}
            </nav>
            {tab === "Resumen" && (
              <>
                <div className="admin-metrics">
                  {[
                    ["Usuarios", overview.users],
                    ["Canales", overview.channels],
                    ["Directos", overview.live ?? "Sin datos"],
                    ["Seguimientos", overview.followers],
                    ["Denuncias pendientes", overview.reports],
                    [
                      "Equipo con 2FA",
                      `${overview.securedStaff}/${overview.staff}`,
                    ],
                  ].map(([label, value]) => (
                    <article className="panel" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </article>
                  ))}
                </div>
                <section className="panel">
                  <h2>Estado de servicios</h2>
                  <small>
                    Comprobado:{" "}
                    {new Date(overview.checkedAt).toLocaleString("es")}
                  </small>
                  <p>
                    Base de datos: conectada · Vídeo: {overview.video} · Worker:{" "}
                    {overview.workerHealth}
                  </p>
                  <p>
                    Procesamiento:{" "}
                    {overview.worker === null
                      ? "Sin configurar"
                      : overview.worker.length
                        ? overview.worker.join(", ")
                        : "Sin trabajos activos"}
                  </p>
                  <p>
                    Las cifras de directos y seguidores son reales. El recuento
                    de espectadores y las estadísticas históricas siguen
                    pendientes.
                  </p>
                  <Link href="/account/security">
                    Proteger mi cuenta con 2FA y revisar sesiones →
                  </Link>
                  <br />
                  <Link href="/roadmap">Ver hoja de ruta →</Link>
                </section>
              </>
            )}
            {["Usuarios", "Canales"].includes(tab) && (
              <form
                className="admin-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (page) setPage(0);
                  else void action(load);
                }}
              >
                <label>
                  Buscar {tab.toLowerCase()}
                  <input
                    value={query}
                    maxLength={100}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <button disabled={busy}>Buscar</button>
              </form>
            )}
            {tab === "Usuarios" && (
              <>
                {admin && (
                  <details className="panel">
                    <summary>Confirmación para asignar roles globales</summary>
                    <div className="profile-form">
                      <label>
                        Tu contraseña
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </label>
                      <label>
                        Código 2FA, si lo activaste
                        <input
                          autoComplete="one-time-code"
                          maxLength={19}
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                        />
                      </label>
                      <small>
                        Los cambios de rol cierran las sesiones de la cuenta
                        afectada. No puedes modificar tu propio rol.
                      </small>
                    </div>
                  </details>
                )}
                <div className="admin-list">
                  {users.map((u) => (
                    <article key={u.id}>
                      <strong>{u.username}</strong>
                      <span>{u.role}</span>
                      <label>
                        Estado
                        <select
                          value={u.status}
                          disabled={busy}
                          onChange={(e) => {
                            const status = e.target.value;
                            if (
                              status !== "active" &&
                              !confirm(
                                `¿Cambiar el estado de ${u.username} a ${status}? Una suspensión cierra sus sesiones y emisiones.`,
                              )
                            )
                              return;
                            void action(() =>
                              api("admin/users", {
                                method: "PATCH",
                                body: JSON.stringify({ id: u.id, status }),
                              }),
                            );
                          }}
                        >
                          <option value="active">Activo</option>
                          <option value="muted">Silenciado</option>
                          <option value="banned">Suspendido</option>
                        </select>
                      </label>
                      {admin && (
                        <label>
                          Rol global
                          <select
                            value={u.role}
                            disabled={busy || !password}
                            onChange={(e) => {
                              const role = e.target.value;
                              if (!confirm(`¿Asignar ${role} a ${u.username}?`))
                                return;
                              void action(async () => {
                                await api("admin/roles", {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    id: u.id,
                                    role,
                                    password,
                                    code,
                                  }),
                                });
                                setCode("");
                              });
                            }}
                          >
                            <option value="viewer">Espectador</option>
                            <option value="creator">Creador</option>
                            <option value="moderator">Moderador global</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </label>
                      )}
                    </article>
                  ))}
                </div>
                {!users.length && <p>No hay usuarios que coincidan.</p>}
              </>
            )}
            {tab === "Canales" && (
              <div className="admin-list">
                {channels.map((c) => (
                  <article key={c.id}>
                    <strong>{c.name}</strong>
                    <span>
                      {c.title} · {c.isSuspended ? "Suspendido" : c.status}
                    </span>
                    {c.suspensionReason && <p>{c.suspensionReason}</p>}
                    {!c.isSuspended && (
                      <Link href={`/channel/${c.slug}`}>Abrir canal</Link>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => {
                        const reason = prompt(
                          c.isSuspended
                            ? "Motivo de la reactivación"
                            : "Motivo de la suspensión",
                        );
                        if (!reason) return;
                        if (
                          !c.isSuspended &&
                          !confirm(
                            "Se detendrá la emisión y se revocará su clave OBS. ¿Continuar?",
                          )
                        )
                          return;
                        void action(() =>
                          api("admin/channels", {
                            method: "PATCH",
                            body: JSON.stringify({
                              id: c.id,
                              suspended: !c.isSuspended,
                              reason,
                            }),
                          }),
                        );
                      }}
                    >
                      {c.isSuspended ? "Reactivar canal" : "Suspender canal"}
                    </button>
                    {admin && (
                      <div className="security-actions">
                        {["POST", "DELETE"].map((method) => (
                          <button
                            key={method}
                            disabled={busy}
                            onClick={() => {
                              const username = prompt(
                                "Nombre exacto del moderador del canal",
                              );
                              if (username)
                                void action(() =>
                                  api("admin/channel-moderators", {
                                    method,
                                    body: JSON.stringify({
                                      streamId: c.id,
                                      username,
                                    }),
                                  }),
                                );
                            }}
                          >
                            {method === "POST"
                              ? "Añadir moderador"
                              : "Retirar moderador"}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                {!channels.length && <p>No hay canales que coincidan.</p>}
              </div>
            )}
            {["Usuarios", "Canales"].includes(tab) && (
              <div className="security-actions">
                <button
                  disabled={busy || page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>Página {page + 1}</span>
                <button
                  disabled={
                    busy || (tab === "Usuarios" ? users : channels).length < 50
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
            {tab === "Denuncias" && (
              <section className="panel">
                <h2>Cola de revisión</h2>
                <label>
                  Estado
                  <select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value)}
                  >
                    <option value="open">Pendientes</option>
                    <option value="reviewing">En revisión</option>
                    <option value="resolved">Resueltas</option>
                    <option value="dismissed">Descartadas</option>
                  </select>
                </label>
                {reports.map((r) => (
                  <article className="report-card" key={r.id}>
                    <h3>
                      #{r.id} · {r.channel?.title || "Canal eliminado"}
                    </h3>
                    <p>
                      {r.reason} · Reportado por {r.reporter}
                    </p>
                    <p>{r.description}</p>
                    {r.resolution && <p>Resolución: {r.resolution}</p>}
                    <div className="security-actions">
                      {[
                        ["reviewing", "Revisar"],
                        ["resolved", "Resolver"],
                        ["dismissed", "Descartar"],
                      ].map(([status, label]) => (
                        <button
                          key={status}
                          disabled={busy}
                          onClick={() => {
                            const resolution = prompt(
                              "Motivo o nota para la auditoría",
                            );
                            if (resolution)
                              void action(() =>
                                api("admin/reports", {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    id: r.id,
                                    status,
                                    resolution,
                                  }),
                                }),
                              );
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
                {!reports.length && <p>No hay denuncias en este estado.</p>}
              </section>
            )}
            {tab === "Auditoría" && (
              <section className="panel">
                <h2>Últimas acciones</h2>
                {audit.map((a) => (
                  <article className="audit-row" key={a.id}>
                    <strong>{a.actorName}</strong>
                    <span>
                      {a.action} · {a.target}
                    </span>
                    <time>{new Date(a.createdAt).toLocaleString("es")}</time>
                  </article>
                ))}
                {!audit.length && <p>Aún no hay acciones registradas.</p>}
              </section>
            )}
            {tab === "Configuración" && admin && (
              <section className="panel">
                <h2>Configuración pública</h2>
                <form
                  className="profile-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(() =>
                      api("admin/settings", {
                        method: "PATCH",
                        body: JSON.stringify(settings),
                      }),
                    );
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.registrationOpen}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          registrationOpen: e.target.checked,
                        })
                      }
                    />{" "}
                    Permitir nuevas cuentas
                  </label>
                  <label>
                    Anuncio de la plataforma
                    <textarea
                      value={settings.announcement}
                      maxLength={500}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          announcement: e.target.value,
                        })
                      }
                    />
                  </label>
                  <small>
                    Déjalo vacío para ocultar el anuncio. Se muestra como texto,
                    sin HTML.
                  </small>
                  <button className="primary-button" disabled={busy}>
                    Guardar configuración
                  </button>
                </form>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
