"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  Flame,
  Gamepad2,
  Heart,
  HelpCircle,
  Home,
  Menu,
  MessageCircle,
  Mic2,
  Play,
  Radio,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";

import { api, RequestError } from "@/lib/client";
import type { Stream, User, Message } from "@/lib/types";
import { categories } from "@/lib/catalog";
import { LivePlayer } from "@/components/live-player";
import { StreamConnection } from "@/components/stream-connection";
import { AuthForm } from "@/components/auth-form";
const filters = [
  { name: "Para ti", icon: Sparkles },
  { name: "Gaming", icon: Gamepad2 },
  { name: "Esports", icon: Trophy },
  { name: "Charlando", icon: MessageCircle },
  { name: "Música", icon: Mic2 },
  { name: "IRL", icon: Video },
];
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "small" : ""}`}>
      <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path d="M7 29V7h6l10 12V7h6v22h-6L13 17v12H7Z" fill="currentColor" />
        <path d="m23 7 6 6V7h-6Z" fill="#86ffe2" />
      </svg>
    </span>
  );
}
function Avatar({
  n,
  size = "",
  live = false,
}: {
  n: number;
  size?: string;
  live?: boolean;
}) {
  return (
    <span className={`avatar ${size} ${live ? "live-avatar" : ""}`}>
      <img src={`/images/avatar-${n}.jpg`} alt="" />
    </span>
  );
}
function Verified() {
  return <ShieldCheck size={14} className="verified" fill="currentColor" />;
}
export default function Page() {
  const [nav, setNav] = useState("Inicio");
  const [filter, setFilter] = useState("Para ti");
  const [query, setQuery] = useState("");
  const [followed, setFollowed] = useState<number[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [myStream, setMyStream] = useState<Stream | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState<"creator" | "profile" | "about" | null>(
    null,
  );
  const [selected, setSelected] = useState<Stream | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [slide, setSlide] = useState(0);
  const displayName = user?.username || "";
  const [creatorSaved, setCreatorSaved] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    category: "Gaming",
    game: "",
    image: "cyberpunk",
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const chatVersion = useRef(0);
  const selectedSlug = useRef<string | null>(null);
  selectedSlug.current = selected?.slug || null;
  const isModal = !!modal || !!selected;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [channels, account] = await Promise.all([
          api<Stream[]>("streams", { signal: controller.signal }),
          api<User | null>("auth/me", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        const follows = account
          ? await api<number[]>("follows", { signal: controller.signal })
          : [];
        if (controller.signal.aborted) return;
        setFollowed(follows);
        setUser(account);
        setStreams(channels);
      } catch (error) {
        if (!controller.signal.aborted)
          setApiError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la comunidad.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const timer = setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        const items = await api<Stream[]>("streams", { signal: controller.signal });
        if (!controller.signal.aborted) setStreams(items);
      } catch { /* The player reports video connectivity separately. */ }
      finally { pending = false; }
    }, 10000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!selected) return;
    const slug = selected.slug;
    const controller = new AbortController();
    let fetching = false;
    setMessages([]);
    setMessage("");
    setChatError("");
    setChatLoading(true);
    async function loadChat() {
      if (fetching) return;
      fetching = true;
      const version = chatVersion.current;
      try {
        const result = await api<Message[]>(`streams/${slug}/chat`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted && version === chatVersion.current) {
          setMessages(result);
          setChatError("");
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setChatError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el chat.",
          );
      } finally {
        fetching = false;
        if (!controller.signal.aborted) setChatLoading(false);
      }
    }
    void loadChat();
    const timer = setInterval(() => void loadChat(), 3000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [selected?.slug]);
  useEffect(() => {
    if (modal !== "creator" || !user || user.role === "viewer") return;
    const controller = new AbortController();
    setCreatorLoading(true);
    setMyStream(null);
    api<Stream[]>("streams?mine=true", { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) {
          const item = items[0] || null;
          setMyStream(item);
          setDraft(
            item
              ? {
                  title: item.title,
                  category: item.category,
                  game: item.game,
                  image: item.image,
                }
              : { title: "", category: "Gaming", game: "", image: "cyberpunk" },
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setApiError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCreatorLoading(false);
      });
    return () => controller.abort();
  }, [modal, user?.id, user?.role]);
  async function authenticated(account: User) {
    setBusy(true);
    setUser(account);
    setApiError("");
    close();
    try {
      setFollowed(await api<number[]>("follows"));
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }
  function reportError(error: unknown) {
    setApiError(
      error instanceof Error
        ? error.message
        : "No se pudo completar la operación.",
    );
    if (error instanceof RequestError && error.status === 401) {
      setUser(null);
      setFollowed([]);
      setSelected(null);
      setModal("profile");
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api("auth/logout", { method: "POST" });
      setUser(null);
      setFollowed([]);
      close();
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }
  async function sendMessage() {
    if (!selected || !message.trim() || busy) return;
    if (!user) {
      setSelected(null);
      setModal("profile");
      return;
    }
    setBusy(true);
    setChatError("");
    const slug = selected.slug;
    chatVersion.current++;
    try {
      await api<Message>(`streams/${slug}/chat`, {
        method: "POST",
        body: JSON.stringify({ text: message.trim() }),
      });
      chatVersion.current++;
      const result = await api<Message[]>(`streams/${slug}/chat`);
      if (selectedSlug.current === slug) {
        setMessage("");
        setMessages(result);
      }
    } catch (error) {
      if (selectedSlug.current === slug)
        setChatError(
          error instanceof Error ? error.message : "No se pudo enviar.",
        );
      if (error instanceof RequestError && error.status === 401)
        reportError(error);
    } finally {
      setBusy(false);
    }
  }
  async function saveChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || creatorLoading) return;
    setBusy(true);
    setApiError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const channel = await api<Stream>(
        myStream ? `streams/${myStream.slug}` : "streams",
        { method: myStream ? "PATCH" : "POST", body: JSON.stringify(data) },
      );
      setMyStream(channel);
      setCreatorSaved(true);
      setStreams(await api<Stream[]>("streams"));
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (isModal) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [isModal]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function toggleFollow(id: number) {
    if (!user) {
      setSelected(null);
      setModal("profile");
      return;
    }
    if (busy) return;
    setBusy(true);
    setApiError("");
    const following = followed.includes(id);
    try {
      await api("follows", {
        method: following ? "DELETE" : "POST",
        body: JSON.stringify({ streamId: id }),
      });
      setFollowed((prev) =>
        following ? prev.filter((x) => x !== id) : [...prev, id],
      );
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }
  function navigate(to: string) {
    setNav(to);
    setFilter("Para ti");
    setQuery("");
    setShowAll(false);
    setMobile(false);
  }
  function close() {
    setModal(null);
    setSelected(null);
    setCreatorSaved(false);
  }
  function chooseCategory(name: string) {
    setQuery(name);
    setNav("Explorar");
    setFilter("Para ti");
    document
      .getElementById("live-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const filtered = streams.filter(
    (s) =>
      (nav !== "Siguiendo" || followed.includes(s.id)) &&
      (filter === "Para ti" || s.category === filter) &&
      `${s.title} ${s.name} ${s.game}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const visible =
    nav === "Clips"
      ? []
      : showAll || query || filter !== "Para ti" || nav === "Siguiendo"
        ? filtered
        : filtered.slice(0, 4);
  const feature =
    (slide === 0
      ? streams.find((s) => s.slug === "showcase-4")
      : slide === 1
        ? streams.find((s) => s.slug === "showcase-2")
        : streams.find((s) => s.slug === "showcase-5")) || streams[0];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a href="/" className="brand" aria-label="Nexora, inicio">
          <Mark />
          <span>
            NEXORA<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="sidebar-content">
          <span className="eyebrow nav-label">DESCUBRE TU MUNDO</span>
          <nav className="main-nav" aria-label="Navegación principal">
            {[
              { name: "Inicio", icon: Home },
              { name: "Explorar", icon: Compass },
              { name: "Siguiendo", icon: Heart },
              { name: "Clips", icon: Video },
            ].map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={nav === name ? "active" : ""}
                onClick={() => navigate(name)}
              >
                <Icon size={19} />
                <span>{name}</span>
                {name === "Explorar" && <span className="new-tag">NEW</span>}
                {name === "Siguiendo" && followed.length > 0 && (
                  <span className="nav-count">{followed.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="side-heading">
            <span className="eyebrow">CANALES RECOMENDADOS</span>
            <Radio size={14} />
          </div>
          <div className="side-channels">
            {streams.slice(0, 5).map((s) => (
              <button
                className="side-channel"
                key={s.id}
                onClick={() => setSelected(s)}
              >
                <Avatar n={s.avatar} />
                <span className="side-channel-info">
                  <strong>
                    {s.name}
                    {s.isDemo && s.id < 3 && <Verified />}
                  </strong>
                  <small>{s.game}</small>
                </span>
                <span className="side-viewers">
                  <i />
                  {s.viewers.replace(" mil", "k")}
                </span>
              </button>
            ))}
          </div>
          <button
            className="side-more"
            onClick={() => {
              navigate("Explorar");
              setShowAll(true);
            }}
          >
            Mostrar más <ChevronDown size={13} />
          </button>
          <div className="community-box">
            <span className="community-icon">
              <Zap size={21} fill="currentColor" />
            </span>
            <h3>
              Tu comunidad.
              <br />
              Tus reglas.
            </h3>
            <p>
              Hay un lugar para ti.
              <br />
              Haz que también sea el tuyo.
            </p>
            <button onClick={() => setModal("profile")}>
              Únete a NEXORA <ArrowRight size={15} />
            </button>
            <div className="community-orbit" />
          </div>
          <div className="sidebar-bottom">
            <button onClick={() => setModal("about")}>
              <HelpCircle size={17} />
              Ayuda y comunidad <ArrowRight size={13} />
            </button>
            <p>
              © 2026 NEXORA <span>•</span> Hecho para conectar.
            </p>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir navegación"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <a className="mobile-brand" href="/" aria-label="NEXORA">
              <Mark small />
            </a>
            <span className="top-tab">Descubrir</span>
            <span className="top-separator" />
            <span className="top-subtitle">Tu próxima comunidad está aquí</span>
          </div>
          <label className="search">
            <Search size={17} />
            <input
              ref={searchRef}
              placeholder="Buscar canales, juegos, comunidades…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setNav("Explorar");
              }}
              aria-label="Buscar canales, juegos y comunidades"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            ) : (
              <kbd>⌘ K</kbd>
            )}
          </label>
          <div className="top-actions">
            <div className="notification-wrap">
              <button
                className={`icon-button notification ${notifications ? "selected" : ""}`}
                aria-label="Notificaciones"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                <i />
              </button>
              {notifications && (
                <div className="notification-panel">
                  <h3>Tu actividad</h3>
                  <p>
                    <Sparkles size={18} />
                    ¡Bienvenido a NEXORA!
                  </p>
                  <small>
                    Aquí encontrarás las novedades de los canales que sigues.
                  </small>
                  <button onClick={() => setNotifications(false)}>
                    Entendido <Check size={14} />
                  </button>
                </div>
              )}
            </div>
            <span className="action-separator" />
            <button className="go-live" onClick={() => setModal("creator")}>
              <Radio size={16} />
              <span>Mi canal</span>
            </button>
            <button
              className="profile-button"
              onClick={() => {
                setModal("profile");
              }}
              aria-label="Mi perfil"
            >
              <Avatar n={6} />
              <span className="account-name">{displayName || "Entrar"}</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main>
          {apiError && (
            <div className="api-error global-error" role="alert">
              {apiError}
              <button onClick={() => setApiError("")} aria-label="Cerrar aviso">
                <X size={15} />
              </button>
            </div>
          )}
          {loading && (
            <p className="api-status" role="status">
              Conectando con la comunidad…
            </p>
          )}
          <div className="welcome-row">
            <div>
              <div className="welcome-kicker">
                <span /> CONECTA CON LO QUE TE MUEVE
              </div>
              <h1>
                {nav === "Siguiendo" ? (
                  "Tus comunidades favoritas"
                ) : nav === "Explorar" ? (
                  "Encuentra tu próximo mundo"
                ) : nav === "Clips" ? (
                  "Pequeños momentos. Grandes historias."
                ) : (
                  <>
                    Tu mundo, <span>en directo.</span>
                  </>
                )}
              </h1>
              <p>
                {nav === "Siguiendo"
                  ? "Los canales que sigues, siempre cerca de ti."
                  : nav === "Clips"
                    ? "Aquí aparecerán los clips cuando conectemos el servicio de vídeo."
                    : "Grandes momentos. Gente auténtica. Encuentra tu lugar en NEXORA."}
              </p>
            </div>
            <span className="live-community">
              <i /> LA COMUNIDAD ESTÁ ON
            </span>
          </div>
          {nav === "Inicio" && !query && feature && (
            <section className="hero" aria-label="Canal destacado">
              <div
                className={`hero-art art-${slide}`}
                style={{
                  backgroundImage: `url('/images/${slide === 0 ? "hero" : feature.image + "-scene"}.jpg')`,
                }}
              />
              <div className="hero-shade" />
              <div className="hero-content">
                <div className="hero-top">
                  <span className="live-badge">
                    <i /> {feature.isDemo ? "EJEMPLO" : feature.status === "live" ? "EN DIRECTO" : feature.status === "unavailable" ? "SIN CONEXIÓN" : "SIN EMISIÓN"}
                  </span>
                  <span className="featured-label">
                    <Sparkles size={13} /> DESTACADO DE HOY
                  </span>
                </div>
                <h2>
                  {slide === 0 ? (
                    <>
                      La noche es nuestra.
                      <br />
                      <span>¿Te vienes?</span>
                    </>
                  ) : slide === 1 ? (
                    <>
                      Una última batalla.
                      <br />
                      <span>Mil historias.</span>
                    </>
                  ) : (
                    <>
                      La próxima curva.
                      <br />
                      <span>Sin límites.</span>
                    </>
                  )}
                </h2>
                <p>
                  {slide === 0
                    ? "Nos perdemos en Night City. Tú pones el chat."
                    : slide === 1
                      ? "Un nuevo reto en las Tierras Intermedias."
                      : "Carretera, buena música y la mejor comunidad."}
                </p>
                <button
                  className="hero-channel"
                  onClick={() => setSelected(feature)}
                >
                  <Avatar n={feature.avatar} live />
                  <span>
                    <strong>
                      {feature.name} {feature.isDemo && <Verified />}
                    </strong>
                    <small>
                      {feature.game}
                      <span>•</span>Español
                    </small>
                  </span>
                  <span className="hero-viewers">
                    <Eye size={14} />
                    {feature.viewers}
                  </span>
                </button>
                <button
                  className="primary-button watch-button"
                  onClick={() => setSelected(feature)}
                >
                  <Play size={15} fill="currentColor" /> Ver canal{" "}
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="hero-game-label">
                {slide === 0 ? (
                  <>
                    <span>CD PROJEKT RED</span>
                    <strong>
                      CYBERPUNK<span>2077</span>
                    </strong>
                  </>
                ) : (
                  <strong>{feature.game}</strong>
                )}
              </div>
              <div className="hero-bottom">
                <span className="demo-label">VÍDEO PENDIENTE DE CONECTAR</span>
                <div className="hero-controls">
                  <button
                    className="hero-arrow"
                    onClick={() => setSlide((slide + 2) % 3)}
                    aria-label="Destacado anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="hero-dots">
                    {[0, 1, 2].map((n) => (
                      <button
                        key={n}
                        className={slide === n ? "current" : ""}
                        onClick={() => setSlide(n)}
                        aria-label={`Ver destacado ${n + 1}`}
                        aria-pressed={slide === n}
                      />
                    ))}
                  </div>
                  <button
                    className="hero-arrow"
                    onClick={() => setSlide((slide + 1) % 3)}
                    aria-label="Siguiente destacado"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </section>
          )}
          <div className="discovery-toolbar">
            <div className="filter-tabs" aria-label="Filtrar contenido">
              {filters.map(({ name, icon: Icon }) => (
                <button
                  className={filter === name ? "active" : ""}
                  key={name}
                  aria-pressed={filter === name}
                  onClick={() => {
                    setFilter(name);
                    setQuery("");
                  }}
                >
                  <Icon size={16} />
                  {name}
                </button>
              ))}
            </div>
            <button
              className="filter-settings"
              onClick={() => setShowAll(!showAll)}
              aria-pressed={showAll}
            >
              <Settings2 size={16} />
              <span>{showAll ? "Ver destacados" : "Más canales"}</span>
            </button>
          </div>
          <section id="live-section" className="content-section">
            <div className="section-heading">
              <h2>
                {nav === "Clips" ? <Video size={21} /> : <Radio size={21} />}{" "}
                {nav === "Siguiendo"
                  ? "Canales que sigues"
                  : nav === "Clips"
                    ? "Clips para descubrir"
                    : "Canales que van contigo"}
                <span className="section-tag">
                  {nav === "Clips" ? "PRÓXIMAMENTE" : "COMUNIDAD"}
                </span>
              </h2>
              <button onClick={() => setShowAll(!showAll)}>
                {showAll ? "Ver menos" : "Ver todos"} <ArrowRight size={15} />
              </button>
            </div>
            <div className="streams-grid">
              {visible.map((s) => (
                <article className="stream-card" key={s.id}>
                  <button
                    className="stream-thumbnail"
                    onClick={() => setSelected(s)}
                    aria-label={`Ver ${s.title}`}
                  >
                    <img
                      src={`/images/${s.image}-scene.jpg`}
                      alt={`Escena de ${s.game}`}
                      loading="lazy"
                    />
                    <span className="live-badge">
                      {nav === "Clips" ? (
                        <>
                          <Play size={10} /> CLIP
                        </>
                      ) : (
                        <>
                          <i /> {s.isDemo ? "EJEMPLO" : s.status === "live" ? "EN DIRECTO" : s.status === "unavailable" ? "SIN CONEXIÓN" : "SIN EMISIÓN"}
                        </>
                      )}
                    </span>
                    <span className="viewer-badge">
                      <Eye size={11} />
                      {s.viewers}
                    </span>
                    <span className="thumbnail-play">
                      <Play size={25} fill="currentColor" />
                    </span>
                    {nav === "Clips" && (
                      <span className="clip-duration">00:32</span>
                    )}
                    <span className="thumbnail-avatar">
                      <Avatar n={s.avatar} />
                    </span>
                  </button>
                  <div className="stream-info">
                    <button
                      className="stream-title"
                      onClick={() => setSelected(s)}
                    >
                      {s.title}
                    </button>
                    <button
                      className="follow-icon"
                      aria-label={`${followed.includes(s.id) ? "Dejar de seguir a" : "Seguir a"} ${s.name}`}
                      aria-pressed={followed.includes(s.id)}
                      disabled={busy}
                      onClick={() => toggleFollow(s.id)}
                    >
                      <Heart
                        size={16}
                        fill={followed.includes(s.id) ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="stream-creator"
                      onClick={() => setSelected(s)}
                    >
                      {s.name}
                      {s.isDemo && <Verified />}
                    </button>
                    <span className="stream-game">{s.game}</span>
                    <div className="stream-tags">
                      <span>Español</span>
                      <span>{s.tag}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {visible.length === 0 && (
              <div className="empty-state">
                <Compass size={36} />
                <h3>
                  {nav === "Siguiendo"
                    ? user
                      ? "Tu comunidad empieza con un follow"
                      : "Inicia sesión para ver tus canales"
                    : nav === "Clips"
                      ? "Todavía no hay clips"
                      : loading
                        ? "Cargando canales…"
                        : "Todavía no hay coincidencias"}
                </h3>
                <p>
                  {nav === "Siguiendo"
                    ? "Pulsa el corazón de un canal para encontrarlo aquí."
                    : nav === "Clips"
                      ? "Los clips estarán disponibles cuando conectemos el servidor de vídeo."
                      : "Prueba otro juego, canal o categoría."}
                </p>
                <button
                  className="primary-button"
                  onClick={() => navigate("Explorar")}
                >
                  Explorar canales <ArrowRight size={15} />
                </button>
              </div>
            )}
          </section>
          <section className="content-section categories-section">
            <div className="section-heading">
              <h2>
                <Flame size={21} /> Encuentra tu próxima obsesión
              </h2>
              <button
                onClick={() => {
                  setShowAll(true);
                  setNav("Explorar");
                  setQuery("");
                  setFilter("Gaming");
                  document
                    .getElementById("live-section")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Explorar categorías <ArrowRight size={15} />
              </button>
            </div>
            <div className="categories-grid">
              {categories.map((cat, i) => (
                <button
                  className="category-card"
                  key={cat.name}
                  onClick={() => chooseCategory(cat.name)}
                >
                  <div className="category-image">
                    <img
                      src={`/images/${cat.image}-poster.jpg`}
                      alt={`Portada de ${cat.name}`}
                      loading="lazy"
                    />
                    <span className="category-rank">0{i + 1}</span>
                    <span className="category-arrow">
                      <ArrowRight size={20} />
                    </span>
                  </div>
                  <h3>{cat.name}</h3>
                  <p>
                    <i />
                    {streams.filter((s) => s.game === cat.name).length} canales
                  </p>
                  <span className="category-tag">
                    {i === 1
                      ? "RPG"
                      : i === 4
                        ? "Carreras"
                        : i === 5
                          ? "Aventura"
                          : "Gaming"}
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="creator-banner">
            <div className="creator-symbol">
              <AudioLines size={32} />
            </div>
            <div>
              <span className="eyebrow">DALE AL PLAY A TU HISTORIA</span>
              <h2>El próximo gran directo puede ser el tuyo.</h2>
              <p>Comparte lo que te apasiona. Nosotros ponemos el lugar.</p>
            </div>
            <button onClick={() => setModal("creator")}>
              Empieza a crear <ArrowRight size={17} />
            </button>
            <Sparkles className="banner-sparkles" size={90} />
          </section>
          <footer>
            <a href="/" className="footer-brand">
              <Mark small /> NEXORA
            </a>
            <span>Conecta. Comparte. Vive el directo.</span>
            <button onClick={() => setModal("about")}>
              Sobre NEXORA <ArrowRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      <dialog
        aria-label={
          selected
            ? `Canal de ${selected.name}`
            : modal === "creator"
              ? "Preparar un directo"
              : modal === "profile"
                ? "Tu cuenta"
                : "Sobre NEXORA"
        }
        ref={dialogRef}
        className={`modal ${selected ? "player-modal" : ""}`}
        onCancel={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <button
          className="modal-close icon-button"
          onClick={close}
          aria-label="Cerrar ventana"
        >
          <X size={21} />
        </button>
        {selected ? (
          <>
            <div className="player-layout">
              <div className="player-main">
                <LivePlayer key={selected.slug} stream={selected} />
                <div className="player-details">
                  <Avatar n={selected.avatar} live />
                  <div>
                    <h2>
                      {selected.name} {selected.isDemo && <Verified />}
                    </h2>
                    <p>{selected.title}</p>
                    <small>{selected.game} · Español</small>
                  </div>
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => toggleFollow(selected.id)}
                  >
                    <Heart
                      size={16}
                      fill={
                        followed.includes(selected.id) ? "currentColor" : "none"
                      }
                    />
                    {followed.includes(selected.id) ? "Siguiendo" : "Seguir"}
                  </button>
                </div>
              </div>
              <div className="chat-panel">
                <h3>
                  <MessageCircle size={17} /> Chat de la comunidad
                </h3>
                <span className="chat-demo">
                  {user
                    ? `Conectado como ${user.username}`
                    : "Inicia sesión para participar"}{" "}
                  · Actualiza cada 3 s
                </span>
                {chatLoading && <p role="status">Cargando mensajes…</p>}
                {chatError && (
                  <p className="api-error" role="alert">
                    {chatError}
                  </p>
                )}
                <div className="chat-messages">
                  {messages.map((m, i) => (
                    <p key={i}>
                      <strong>{m.name}</strong> {m.text}
                    </p>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendMessage();
                  }}
                >
                  <label htmlFor="chat-message" className="sr-only">
                    Mensaje de chat
                  </label>
                  <input
                    id="chat-message"
                    placeholder="Envía un mensaje…"
                    value={message}
                    maxLength={300}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <button
                    className="primary-button"
                    disabled={busy || !message.trim()}
                    aria-label="Enviar mensaje"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          </>
        ) : modal === "profile" ? (
          <>
            <Mark />
            {user ? (
              <>
                <h2>Hola, {user.username}</h2>
                <p>
                  Tu cuenta de{" "}
                  {user.role === "creator"
                    ? "creador"
                    : user.role === "admin"
                      ? "administración"
                      : "espectador"}{" "}
                  está conectada.
                </p>
                {user.role === "admin" && (
                  <a className="primary-button" href="/admin">
                    Administración
                  </a>
                )}
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void logout()}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <AuthForm
                onAuthenticated={(account) => void authenticated(account)}
              />
            )}
          </>
        ) : modal === "creator" ? (
          !user ? (
            <AuthForm
              onAuthenticated={(account) => void authenticated(account)}
            />
          ) : user.role === "viewer" ? (
            <>
              <h2>Un espacio para creadores</h2>
              <p>
                Tu cuenta es de espectador. Para preparar un canal necesitas una
                cuenta de creador.
              </p>
            </>
          ) : (
            <>
              <span className="modal-symbol">
                <Radio size={27} />
              </span>
              <span className="eyebrow modal-kicker">EL ESCENARIO ES TUYO</span>
              <h2>
                {creatorSaved
                  ? "Tu canal está guardado."
                  : myStream
                    ? "Configura tu canal."
                    : "Dale voz a lo que te mueve."}
              </h2>
              <p>
                {creatorSaved
                  ? "Tu canal está guardado. Configura OBS con los datos de emisión que aparecen debajo."
                  : "Gestiona el título y la categoría de tu canal."}
              </p>
              {apiError && (
                <p className="api-error" role="alert">
                  {apiError}
                </p>
              )}
              {creatorLoading ? (
                <p role="status">Cargando tu canal…</p>
              ) : creatorSaved ? (
                <button className="primary-button" onClick={close}>
                  <Check size={17} />
                  Listo
                </button>
              ) : (
                <form
                  key={myStream?.id || "new"}
                  className="profile-form"
                  onSubmit={(event) => void saveChannel(event)}
                >
                  <label htmlFor="stream-title">Título del canal</label>
                  <input
                    id="stream-title"
                    name="title"
                    defaultValue={draft.title}
                    minLength={3}
                    maxLength={100}
                    required
                  />
                  <label htmlFor="stream-category">Categoría</label>
                  <select
                    id="stream-category"
                    name="category"
                    defaultValue={draft.category}
                  >
                    {filters.slice(1).map((f) => (
                      <option key={f.name}>{f.name}</option>
                    ))}
                  </select>
                  <label htmlFor="stream-game">Juego o tema</label>
                  <input
                    id="stream-game"
                    name="game"
                    defaultValue={draft.game}
                    minLength={2}
                    maxLength={60}
                    required
                  />
                  <label htmlFor="stream-image">Portada</label>
                  <select
                    id="stream-image"
                    name="image"
                    defaultValue={draft.image}
                  >
                    {categories.map((c) => (
                      <option key={c.image} value={c.image}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <button className="primary-button" disabled={busy}>
                    {busy ? "Guardando…" : "Guardar canal"}
                    <ArrowRight size={17} />
                  </button>
                </form>
              )}
              {myStream && !creatorLoading && <StreamConnection key={myStream.slug} slug={myStream.slug} />}
            </>
          )
        ) : (
          <>
            <Mark />
            <span className="eyebrow modal-kicker">BIENVENIDO A TU MUNDO</span>
            <h2>
              Más que ver.
              <br />
              Ser parte.
            </h2>
            <p>
              NEXORA es un espacio para conectar a través de lo que nos
              apasiona. Gaming, música y conversaciones, con una identidad
              propia.
            </p>
            <div className="about-values">
              <span>
                <Users size={19} /> Comunidad primero
              </span>
              <span>
                <Zap size={19} /> Creatividad sin límites
              </span>
              <span>
                <Heart size={19} /> Un lugar para todos
              </span>
            </div>
            <small className="modal-footnote">
              Cuentas, canales, favoritos y chat conectados al backend local.
              Los canales marcados como ejemplo no emiten vídeo. La conexión con
              OBS y el servidor de vídeo está pendiente.
            </small>
          </>
        )}
      </dialog>
    </div>
  );
}
