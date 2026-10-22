"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Command,
  KeyRound,
  Radio,
  Settings2,
  Shield,
  Users,
  ExternalLink,
  Check,
} from "lucide-react";
import { api } from "@/lib/client";
import { channelCategories } from "@/lib/catalog";
import type { Stream, User } from "@/lib/types";
import { SiteHeader } from "./site-header";
import { ChannelChat } from "./channel-chat";
import { ChannelArt } from "./channel-art";
import { StreamConnection } from "./stream-connection";
type Settings = {
  slowSeconds: number;
  followersOnly: boolean;
  blockLinks: boolean;
  blockedWords: string;
};
type Dashboard = {
  stream: Stream;
  isOwner: boolean;
  activities: {
    id: number;
    kind: string;
    username: string;
    createdAt: string;
  }[];
  audit: {
    id: number;
    actorName: string;
    action: string;
    target: string;
    createdAt: string;
  }[];
  settings: Settings;
  bans: {
    user: { username: string };
    reason: string;
    expiresAt: string | null;
  }[];
  moderators: { user: { username: string } }[];
  messageCount: number;
};
type CommandRow = {
  id: number;
  name: string;
  response: string;
  cooldownSeconds: number;
  moderatorsOnly: boolean;
  enabled: boolean;
};
type Alerts = {
  followersEnabled: boolean;
  template: string;
  accent: string;
  durationSeconds: number;
  soundEnabled: boolean;
  hasOverlayKey: boolean;
};
const defaultDraft = {
  title: "",
  category: "Gaming",
  game: "",
  description: "",
  language: "Español",
  tag: "",
  thumbnailUrl: "",
};
const tabs = [
  { id: "overview", label: "Resumen", icon: Activity },
  { id: "channel", label: "Mi canal", icon: Settings2 },
  { id: "connection", label: "Emisión y OBS", icon: KeyRound },
  { id: "moderation", label: "Comunidad", icon: Shield },
  { id: "commands", label: "Comandos", icon: Command },
  { id: "alerts", label: "Alertas", icon: Bell },
];
function time(value: string) {
  return new Date(value).toLocaleString("es", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
function ChannelForm({
  stream,
  onSave,
}: {
  stream?: Stream;
  onSave: (s: Stream) => void;
}) {
  const [draft, setDraft] = useState(
    stream
      ? {
          title: stream.title,
          category: stream.category,
          game: stream.game,
          description: stream.description,
          language: stream.language,
          tag: stream.tag,
          thumbnailUrl: stream.thumbnailUrl,
        }
      : defaultDraft,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <div className="editor-grid">
      <form
        className="workspace-form panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setSaved(false);
          try {
            const updated = await api<Stream>(
              stream ? `streams/${stream.slug}` : "streams",
              {
                method: stream ? "PATCH" : "POST",
                body: JSON.stringify(draft),
              },
            );
            onSave(updated);
            setSaved(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{stream ? "Información del canal" : "Crea tu canal"}</h2>
        <p>
          Los cambios se publican al guardar. Puedes editar durante el directo.
        </p>
        <label>
          Título
          <input
            required
            minLength={3}
            maxLength={100}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <div className="form-columns">
          <label>
            Categoría
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {channelCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Idioma
            <input
              required
              minLength={2}
              maxLength={30}
              value={draft.language}
              onChange={(e) => setDraft({ ...draft, language: e.target.value })}
            />
          </label>
        </div>
        <label>
          Juego o actividad
          <input
            required
            minLength={2}
            maxLength={60}
            value={draft.game}
            onChange={(e) => setDraft({ ...draft, game: e.target.value })}
          />
        </label>
        <label>
          Etiquetas, separadas por comas
          <input
            maxLength={100}
            placeholder="Comunidad, competitivo, relajado"
            value={draft.tag}
            onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
          />
        </label>
        <label>
          Descripción
          <textarea
            rows={4}
            maxLength={1000}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
        </label>
        <label>
          Miniatura: URL pública HTTPS
          <input
            type="url"
            maxLength={1000}
            placeholder="https://…"
            value={draft.thumbnailUrl}
            onChange={(e) =>
              setDraft({ ...draft, thumbnailUrl: e.target.value })
            }
          />
        </label>
        <small>
          La imagen se carga desde esa dirección. Déjala vacía para usar la
          portada de NEXORA.
        </small>
        {error && (
          <p role="alert" className="api-error">
            {error}
          </p>
        )}
        {saved && (
          <p className="success" role="status">
            <Check size={16} /> Cambios publicados.
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "Guardando…" : stream ? "Publicar cambios" : "Crear canal"}
        </button>
      </form>
      <aside className="panel editor-preview">
        <span className="kicker">VISTA PREVIA</span>
        <ChannelArt
          stream={{
            name: stream?.name || "Tu canal",
            category: draft.category,
            thumbnailUrl: draft.thumbnailUrl.startsWith("https://")
              ? draft.thumbnailUrl
              : "",
            status: stream?.status || "offline",
          }}
        />
        <h2>{draft.title || "El título de tu directo"}</h2>
        <p>
          {draft.game || draft.category} · {draft.language}
        </p>
        <p>{draft.description}</p>
        <div className="tag-row">
          {draft.tag
            .split(",")
            .filter(Boolean)
            .map((t, i) => (
              <span key={i}>{t.trim()}</span>
            ))}
        </div>
      </aside>
    </div>
  );
}
export function CreatorWorkspace({
  moderation = false,
}: {
  moderation?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null),
    [channels, setChannels] = useState<Stream[]>([]),
    [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    Promise.all([
      api<User | null>("auth/me", { signal: c.signal }),
      api<Stream[]>(moderation ? "moderation" : "streams?mine=true", {
        signal: c.signal,
      }),
    ])
      .then(([u, rows]) => {
        if (!c.signal.aborted) {
          setUser(u);
          setChannels(rows);
          setSlug(rows[0]?.slug ?? "");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [moderation]);
  return (
    <>
      <SiteHeader />
      <main className="workspace">
        <div className="workspace-heading">
          <div>
            <span className="kicker">
              {moderation ? "EQUIPO DEL CANAL" : "CREATOR STUDIO"}
            </span>
            <h1>
              {moderation ? "Centro de moderación" : "Tu espacio para crear"}
            </h1>
            <p>
              {moderation
                ? "Cuida la conversación y coordínate con tu equipo."
                : "Todo lo que necesitas para preparar tu próximo directo."}
            </p>
          </div>
          {channels.length > 0 && (
            <label className="channel-selector">
              Canal
              <select
                aria-label="Seleccionar canal"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              >
                {channels.map((s) => (
                  <option value={s.slug} key={s.id}>
                    {s.name} · {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {loading ? (
          <p role="status">Cargando estudio…</p>
        ) : error ? (
          <div className="panel">
            <p role="alert" className="api-error">
              {error}
            </p>
            <Link href="/login">Iniciar sesión</Link>
          </div>
        ) : !slug ? (
          moderation ? (
            <div className="empty-state">
              <Shield size={40} />
              <h2>Aún no tienes canales asignados</h2>
              <p>
                El propietario puede añadirte desde su estudio con tu nombre de
                usuario.
              </p>
            </div>
          ) : user?.role === "viewer" ? (
            <div className="panel">
              <h2>Empieza a crear</h2>
              <p>
                Activa las herramientas de creador en tu cuenta para abrir tu
                canal.
              </p>
              <button
                className="primary-button"
                onClick={async () => {
                  try {
                    await api("account/creator", { method: "POST" });
                    location.reload();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Activar mi estudio
              </button>
            </div>
          ) : (
            <ChannelForm
              onSave={(s) => {
                setChannels([s]);
                setSlug(s.slug);
              }}
            />
          )
        ) : (
          <WorkspaceChannel
            key={`${slug}:${moderation}`}
            slug={slug}
            moderation={moderation}
            onChannelSaved={(saved) =>
              setChannels((rows) =>
                rows.map((row) => (row.id === saved.id ? saved : row)),
              )
            }
          />
        )}
      </main>
    </>
  );
}
function WorkspaceChannel({
  slug,
  moderation,
  onChannelSaved,
}: {
  slug: string;
  moderation: boolean;
  onChannelSaved: (stream: Stream) => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null),
    [tab, setTab] = useState(moderation ? "moderation" : "overview");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [commands, setCommands] = useState<CommandRow[]>([]),
    [alerts, setAlerts] = useState<Alerts | null>(null),
    [overlayUrl, setOverlayUrl] = useState(""),
    [showUrl, setShowUrl] = useState(false);
  const [command, setCommand] = useState({
    name: "",
    response: "",
    cooldownSeconds: 30,
    moderatorsOnly: false,
    enabled: true,
  });
  async function refresh() {
    setData(await api<Dashboard>(`streams/${slug}/dashboard`));
  }
  useEffect(() => {
    const c = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const d = await api<Dashboard>(`streams/${slug}/dashboard`, {
          signal: c.signal,
        });
        if (!c.signal.aborted) setData(d);
      } catch (e) {
        if (!c.signal.aborted) {
          setData(null);
          setError((e as Error).message);
        }
      } finally {
        pending = false;
      }
    }
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => {
      c.abort();
      clearInterval(t);
    };
  }, [slug]);
  useEffect(() => {
    const c = new AbortController();
    if (tab === "commands")
      api<CommandRow[]>(`streams/${slug}/commands`, { signal: c.signal })
        .then(setCommands)
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        });
    if (tab === "alerts")
      api<Alerts>(`streams/${slug}/alerts`, { signal: c.signal })
        .then(setAlerts)
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        });
    return () => c.abort();
  }, [slug, tab]);
  async function change(path: string, method: string, payload?: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ token?: string | null }>(
        `streams/${slug}/${path}`,
        {
          method,
          ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
        },
      );
      await refresh();
      setNotice("Cambios guardados.");
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const isOwner = data?.isOwner && !moderation;
  return (
    <>
      <div
        className="workspace-tabs"
        role="navigation"
        aria-label="Secciones del estudio"
      >
        {tabs
          .filter((t) => isOwner || ["overview", "moderation"].includes(t.id))
          .map((t) => (
            <button
              key={t.id}
              aria-pressed={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setError("");
                setNotice("");
              }}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
      </div>
      {error && (
        <p className="api-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        !error && <p>Cargando canal…</p>
      ) : (
        <>
          <div className="workspace-status">
            <span
              className={`status-pill ${data.stream.status === "live" ? "on" : ""}`}
            >
              <Radio size={14} />
              {data.stream.status === "live"
                ? "EN DIRECTO"
                : data.stream.status === "unavailable"
                  ? "VÍDEO NO DISPONIBLE"
                  : "DESCONECTADO"}
            </span>
            <span>{data.stream.title}</span>
            <Link href={`/channel/${slug}`} target="_blank">
              Abrir canal <ExternalLink size={14} />
            </Link>
          </div>
          {tab === "overview" && (
            <>
              <div className="stats-grid">
                <article className="panel stat">
                  <Users size={20} />
                  <strong>{data.stream.followers}</strong>
                  <span>Seguidores</span>
                </article>
                <article className="panel stat">
                  <Activity size={20} />
                  <strong>{data.messageCount}</strong>
                  <span>Mensajes conservados</span>
                </article>
                <article className="panel stat">
                  <Shield size={20} />
                  <strong>{data.moderators.length}</strong>
                  <span>Moderadores</span>
                </article>
              </div>
              <div className="workspace-grid">
                <section className="panel">
                  <h2>Actividad reciente</h2>
                  {!data.activities.length && (
                    <p className="empty-copy">
                      Los nuevos seguidores aparecerán aquí.
                    </p>
                  )}
                  {data.activities.map((e) => (
                    <div className="activity-row" key={e.id}>
                      <Bell size={17} />
                      <div>
                        <strong>{e.username}</strong>
                        <p>
                          {e.kind === "test"
                            ? "Prueba de alerta"
                            : "Ha seguido tu canal"}
                        </p>
                      </div>
                      <time>{time(e.createdAt)}</time>
                    </div>
                  ))}
                </section>
                <ChannelChat slug={slug} canModerate />
              </div>
            </>
          )}
          {tab === "channel" && isOwner && (
            <ChannelForm
              stream={data.stream}
              onSave={(saved) => {
                onChannelSaved(saved);
                void refresh();
              }}
            />
          )}
          {tab === "connection" && isOwner && (
            <section className="panel">
              <StreamConnection slug={slug} />
            </section>
          )}
          {tab === "moderation" && (
            <>
              <div className="workspace-grid">
                <section className="panel">
                  <h2>
                    <Shield size={20} /> Reglas del chat
                  </h2>
                  <form
                    className="workspace-form"
                    key={slug}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await change("chat-settings", "PATCH", {
                        slowSeconds: Number(f.get("slowSeconds")),
                        followersOnly: f.has("followersOnly"),
                        blockLinks: f.has("blockLinks"),
                        blockedWords: f.get("blockedWords"),
                      });
                    }}
                  >
                    <label>
                      Modo lento (segundos, 0 para desactivar)
                      <input
                        type="number"
                        name="slowSeconds"
                        min={0}
                        max={300}
                        defaultValue={data.settings.slowSeconds}
                        required
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        name="followersOnly"
                        defaultChecked={data.settings.followersOnly}
                      />{" "}
                      Solo seguidores
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        name="blockLinks"
                        defaultChecked={data.settings.blockLinks}
                      />{" "}
                      Bloquear enlaces
                    </label>
                    <label>
                      Palabras bloqueadas (una por línea)
                      <textarea
                        name="blockedWords"
                        rows={4}
                        maxLength={2000}
                        defaultValue={data.settings.blockedWords}
                      />
                    </label>
                    <button className="primary-button" disabled={busy}>
                      Guardar reglas
                    </button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Equipo de moderación</h2>
                  <p>
                    Los moderadores pueden cuidar el chat y acceder a la
                    conversación privada del equipo.
                  </p>
                  {data.moderators.length === 0 && (
                    <p className="empty-copy">No hay moderadores asignados.</p>
                  )}
                  {data.moderators.map((m) => (
                    <div className="list-row" key={m.user.username}>
                      <strong>{m.user.username}</strong>
                      {isOwner && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void change("moderators", "DELETE", {
                              username: m.user.username,
                            })
                          }
                        >
                          Retirar rol
                        </button>
                      )}
                    </div>
                  ))}
                  {isOwner && (
                    <form
                      className="inline-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        if (
                          await change(
                            "moderators",
                            "POST",
                            Object.fromEntries(new FormData(f)),
                          )
                        )
                          f.reset();
                      }}
                    >
                      <input
                        name="username"
                        aria-label="Nombre del moderador"
                        placeholder="Nombre exacto de usuario"
                        required
                        minLength={3}
                        maxLength={24}
                      />
                      <button className="primary-button" disabled={busy}>
                        Añadir
                      </button>
                    </form>
                  )}
                </section>
              </div>
              <section className="panel">
                <h2>Sanciones del canal</h2>
                <form
                  className="ban-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await change("bans", "POST", {
                      username: f.get("username"),
                      minutes: Number(f.get("minutes")),
                      reason: f.get("reason"),
                    });
                  }}
                >
                  <label>
                    Usuario
                    <input
                      name="username"
                      required
                      minLength={3}
                      maxLength={24}
                      placeholder="Nombre exacto"
                    />
                  </label>
                  <label>
                    Duración
                    <select name="minutes">
                      <option value="10">10 minutos</option>
                      <option value="60">1 hora</option>
                      <option value="1440">24 horas</option>
                      <option value="0">Permanente</option>
                    </select>
                  </label>
                  <label>
                    Motivo
                    <input
                      name="reason"
                      required
                      minLength={3}
                      maxLength={200}
                    />
                  </label>
                  <button className="primary-button" disabled={busy}>
                    Aplicar sanción
                  </button>
                </form>
                {!data.bans.length && (
                  <p className="empty-copy">No hay sanciones activas.</p>
                )}
                {data.bans.map((b) => (
                  <div className="list-row" key={b.user.username}>
                    <div>
                      <strong>{b.user.username}</strong>
                      <p>
                        {b.reason} ·{" "}
                        {b.expiresAt
                          ? `Hasta ${time(b.expiresAt)}`
                          : "Permanente"}
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void change("bans", "DELETE", {
                          username: b.user.username,
                        })
                      }
                    >
                      Levantar sanción
                    </button>
                  </div>
                ))}
              </section>
              <div className="workspace-grid">
                <ChannelChat slug={slug} canModerate />
                <ChannelChat slug={slug} staff canModerate />
              </div>
              <section className="panel">
                <h2>Historial de moderación</h2>
                {!data.audit.length && (
                  <p className="empty-copy">
                    Las acciones del equipo quedarán registradas aquí.
                  </p>
                )}
                {data.audit.map((e) => (
                  <div className="audit-row" key={e.id}>
                    <strong>{e.actorName}</strong>
                    <span>
                      {e.action} · {e.target}
                    </span>
                    <time>{time(e.createdAt)}</time>
                  </div>
                ))}
              </section>
            </>
          )}
          {tab === "commands" && isOwner && (
            <div className="workspace-grid">
              <section className="panel">
                <h2>Comandos del canal</h2>
                <p>
                  Se activan al escribir !nombre en el chat público. Usa{" "}
                  {"{user}"} en la respuesta para mencionar a quien lo ejecuta.
                </p>
                <form
                  className="workspace-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await change("commands", "POST", command)) {
                      setCommands(
                        await api<CommandRow[]>(`streams/${slug}/commands`),
                      );
                      setCommand({
                        name: "",
                        response: "",
                        cooldownSeconds: 30,
                        moderatorsOnly: false,
                        enabled: true,
                      });
                    }
                  }}
                >
                  <label>
                    Nombre del comando
                    <input
                      required
                      maxLength={24}
                      placeholder="!redes"
                      value={command.name}
                      onChange={(e) =>
                        setCommand({ ...command, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Respuesta
                    <textarea
                      required
                      rows={3}
                      maxLength={300}
                      value={command.response}
                      onChange={(e) =>
                        setCommand({ ...command, response: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Espera entre usos (segundos)
                    <input
                      type="number"
                      required
                      min={5}
                      max={3600}
                      value={command.cooldownSeconds}
                      onChange={(e) =>
                        setCommand({
                          ...command,
                          cooldownSeconds: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={command.moderatorsOnly}
                      onChange={(e) =>
                        setCommand({
                          ...command,
                          moderatorsOnly: e.target.checked,
                        })
                      }
                    />{" "}
                    Solo equipo del canal
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={command.enabled}
                      onChange={(e) =>
                        setCommand({ ...command, enabled: e.target.checked })
                      }
                    />{" "}
                    Activado
                  </label>
                  <button className="primary-button" disabled={busy}>
                    Guardar comando
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>Mis comandos</h2>
                {!commands.length && (
                  <p className="empty-copy">
                    Aún no hay comandos. Crea el primero.
                  </p>
                )}
                {commands.map((c) => (
                  <article className="command-row" key={c.id}>
                    <strong>
                      !{c.name}{" "}
                      <small>{c.enabled ? "Activo" : "Desactivado"}</small>
                    </strong>
                    <p>{c.response}</p>
                    <small>
                      {c.cooldownSeconds}s ·{" "}
                      {c.moderatorsOnly ? "Solo equipo" : "Todos"}
                    </small>
                    <div className="stream-actions">
                      <button onClick={() => setCommand(c)}>Editar</button>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await change("commands", "DELETE", { name: c.name })
                          )
                            setCommands((rows) =>
                              rows.filter((x) => x.id !== c.id),
                            );
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          )}
          {tab === "alerts" &&
            isOwner &&
            (alerts ? (
              <div className="workspace-grid">
                <section className="panel">
                  <h2>Alertas de seguidores</h2>
                  <form
                    className="workspace-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await change("alerts", "PATCH", alerts);
                    }}
                  >
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={alerts.followersEnabled}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            followersEnabled: e.target.checked,
                          })
                        }
                      />{" "}
                      Activar alertas de nuevos seguidores
                    </label>
                    <label>
                      Mensaje · {"{user}"} se sustituye por el nombre
                      <input
                        required
                        maxLength={180}
                        value={alerts.template}
                        onChange={(e) =>
                          setAlerts({ ...alerts, template: e.target.value })
                        }
                      />
                    </label>
                    <div className="form-columns">
                      <label>
                        Color
                        <input
                          type="color"
                          value={alerts.accent}
                          onChange={(e) =>
                            setAlerts({ ...alerts, accent: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Duración (segundos)
                        <input
                          type="number"
                          required
                          min={3}
                          max={20}
                          value={alerts.durationSeconds}
                          onChange={(e) =>
                            setAlerts({
                              ...alerts,
                              durationSeconds: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={alerts.soundEnabled}
                        onChange={(e) =>
                          setAlerts({
                            ...alerts,
                            soundEnabled: e.target.checked,
                          })
                        }
                      />{" "}
                      Sonido breve al mostrar la alerta
                    </label>
                    <div
                      className="alert-preview"
                      style={{ borderColor: alerts.accent }}
                    >
                      <Bell color={alerts.accent} />
                      <p>
                        {alerts.template.replaceAll("{user}", data.stream.name)}
                      </p>
                      <small>Vista previa</small>
                    </div>
                    <button className="primary-button" disabled={busy}>
                      Guardar alertas
                    </button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Fuente de navegador para OBS</h2>
                  <p>
                    Añade una fuente de navegador de 800 × 300 y pega su URL
                    privada. Mantén la fuente cargada para recibir alertas.
                  </p>
                  <p>
                    Crear una nueva URL invalida la anterior. Esta URL permite
                    ver alertas; no concede acceso a la clave de emisión.
                  </p>
                  <div className="stream-actions">
                    <button
                      disabled={busy}
                      onClick={async () => {
                        const result = await change("overlay-key", "POST");
                        if (result?.token) {
                          setOverlayUrl(
                            `${location.origin}/overlay/${slug}?token=${result.token}`,
                          );
                          setAlerts({ ...alerts, hasOverlayKey: true });
                          setShowUrl(false);
                        }
                      }}
                    >
                      Crear o renovar URL
                    </button>
                    {alerts.hasOverlayKey && (
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (await change("overlay-key", "DELETE")) {
                            setOverlayUrl("");
                            setAlerts({ ...alerts, hasOverlayKey: false });
                          }
                        }}
                      >
                        Revocar URL
                      </button>
                    )}
                  </div>
                  {overlayUrl && (
                    <>
                      <label className="field-label">
                        URL privada
                        <input
                          readOnly
                          type={showUrl ? "text" : "password"}
                          value={overlayUrl}
                          aria-label="URL privada de alertas"
                        />
                      </label>
                      <div className="stream-actions">
                        <button onClick={() => setShowUrl(!showUrl)}>
                          {showUrl ? "Ocultar" : "Mostrar"}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(overlayUrl);
                              setNotice(
                                "URL copiada. Guárdala en OBS; no se recupera al salir del estudio.",
                              );
                            } catch {
                              setShowUrl(true);
                              setNotice("Copia la URL manualmente.");
                            }
                          }}
                        >
                          Copiar URL
                        </button>
                      </div>
                    </>
                  )}
                  <button
                    className="primary-button"
                    disabled={busy || !alerts.hasOverlayKey}
                    onClick={async () => {
                      if (await change("alert-test", "POST"))
                        setNotice(
                          "Alerta enviada a las fuentes OBS conectadas. Guarda primero los cambios de diseño.",
                        );
                    }}
                  >
                    Enviar alerta de prueba
                  </button>
                </section>
              </div>
            ) : (
              <p>Cargando alertas…</p>
            ))}
        </>
      )}
    </>
  );
}
