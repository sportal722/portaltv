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

type Stream = {
  id: number;
  name: string;
  title: string;
  game: string;
  image: string;
  viewers: string;
  avatar: number;
  tag: string;
  category: string;
};
const streams: Stream[] = [
  {
    id: 1,
    name: "Kaizen",
    title: "Rankeds con el squad. Hoy se sube 🚀",
    game: "Counter-Strike 2",
    image: "valorant",
    viewers: "12,4 mil",
    avatar: 0,
    tag: "Competitivo",
    category: "Gaming",
  },
  {
    id: 2,
    name: "LunaVibes",
    title: "Un intento más y nos vamos… ¿o no? ✨",
    game: "Elden Ring",
    image: "elden",
    viewers: "8,2 mil",
    avatar: 1,
    tag: "Español",
    category: "Gaming",
  },
  {
    id: 3,
    name: "AlexRush",
    title: "A por la victoria. ¡Únete al equipo!",
    game: "Apex Legends",
    image: "minecraft",
    viewers: "5,6 mil",
    avatar: 2,
    tag: "Con la comunidad",
    category: "Esports",
  },
  {
    id: 4,
    name: "NiaPlays",
    title: "Night City nunca duerme 🌙",
    game: "Cyberpunk 2077",
    image: "cyberpunk",
    viewers: "3,1 mil",
    avatar: 3,
    tag: "Chill",
    category: "Gaming",
  },
  {
    id: 5,
    name: "DaniDrive",
    title: "Sin frenos por México 🏎️",
    game: "Forza Horizon 5",
    image: "forza",
    viewers: "2,8 mil",
    avatar: 4,
    tag: "Carreras",
    category: "Gaming",
  },
  {
    id: 6,
    name: "SofiSound",
    title: "Música para desconectar y charlar",
    game: "Música y comunidad",
    image: "hollow",
    viewers: "1,9 mil",
    avatar: 5,
    tag: "Lo-fi",
    category: "Música",
  },
  {
    id: 7,
    name: "Mika",
    title: "Un café y nos ponemos al día ☕",
    game: "Charlando",
    image: "cyberpunk",
    viewers: "1,2 mil",
    avatar: 6,
    tag: "Comunidad",
    category: "Charlando",
  },
  {
    id: 8,
    name: "Kaizen",
    title: "Fuera del setup: explorando la ciudad",
    game: "IRL",
    image: "forza",
    viewers: "980",
    avatar: 0,
    tag: "Aventura",
    category: "IRL",
  },
];
const categories = [
  { name: "Counter-Strike 2", image: "valorant", viewers: "142,8 mil" },
  { name: "Elden Ring", image: "elden", viewers: "86,4 mil" },
  { name: "Cyberpunk 2077", image: "cyberpunk", viewers: "54,2 mil" },
  { name: "Apex Legends", image: "minecraft", viewers: "42,6 mil" },
  { name: "Forza Horizon 5", image: "forza", viewers: "28,1 mil" },
  { name: "Hollow Knight", image: "hollow", viewers: "19,5 mil" },
];
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
  const [ready, setReady] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState<"creator" | "profile" | "about" | null>(
    null,
  );
  const [selected, setSelected] = useState<Stream | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [slide, setSlide] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [creatorSaved, setCreatorSaved] = useState(false);
  const [draft, setDraft] = useState({ title: "", category: "Gaming" });
  const [messages, setMessages] = useState<{ name: string; text: string }[]>([
    { name: "LunaVibes", text: "¡Bienvenidos a la comunidad! 💜" },
    { name: "AlexRush", text: "El diseño de Night City es increíble 🔥" },
  ]);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isModal = !!modal || !!selected;
  useEffect(() => {
    try {
      const ids: unknown = JSON.parse(
        localStorage.getItem("nexora-follows") || "[]",
      );
      if (Array.isArray(ids))
        setFollowed(ids.filter((id): id is number => typeof id === "number"));
      setDisplayName(localStorage.getItem("nexora-name") || "");
    } catch {}
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("nexora-stream-draft") || "null",
      );
      if (
        saved &&
        typeof saved === "object" &&
        "title" in saved &&
        "category" in saved &&
        typeof saved.title === "string" &&
        typeof saved.category === "string"
      ) {
        setDraft({
          title: saved.title.slice(0, 100),
          category: filters.some((f) => f.name === saved.category)
            ? saved.category
            : "Gaming",
        });
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem("nexora-follows", JSON.stringify(followed));
      } catch {}
    }
  }, [followed, ready]);
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
  function toggleFollow(id: number) {
    setFollowed((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
    showAll || query || filter !== "Para ti" || nav === "Siguiendo"
      ? filtered
      : filtered.slice(0, 4);
  const feature =
    slide === 0 ? streams[3] : slide === 1 ? streams[1] : streams[4];
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
                    {s.id < 3 && <Verified />}
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
              <span>Iniciar directo</span>
            </button>
            <button
              className="profile-button"
              onClick={() => {
                setNameInput(displayName);
                setModal("profile");
              }}
              aria-label="Mi perfil"
            >
              <Avatar n={6} />
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main>
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
                    ? "Descubre los momentos destacados de nuestros canales de demostración."
                    : "Grandes momentos. Gente auténtica. Encuentra tu lugar en NEXORA."}
              </p>
            </div>
            <span className="live-community">
              <i /> LA COMUNIDAD ESTÁ ON
            </span>
          </div>
          {nav === "Inicio" && !query && (
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
                    <i /> EN DIRECTO
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
                      {feature.name} <Verified />
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
                  <Play size={15} fill="currentColor" /> Ver directo{" "}
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
                <span className="demo-label">VISTA PREVIA · DEMO</span>
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
                    : "Directos que van contigo"}
                <span className="section-tag">
                  {nav === "Clips" ? "DEMO" : "LIVE"}
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
                          <i /> EN DIRECTO
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
                      <Verified />
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
                    ? "Tu comunidad empieza con un follow"
                    : "Todavía no hay coincidencias"}
                </h3>
                <p>
                  {nav === "Siguiendo"
                    ? "Pulsa el corazón de un canal para encontrarlo aquí."
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
                    {cat.viewers} espectadores
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
                ? "Perfil local"
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
                <div
                  className="demo-player"
                  style={{
                    backgroundImage: `url('/images/${selected.image}-scene.jpg')`,
                  }}
                >
                  <span className="demo-player-badge">
                    CANAL DE DEMOSTRACIÓN
                  </span>
                  <div className="player-notice">
                    <Radio size={36} />
                    <h2>Estás en el canal de {selected.name}</h2>
                    <p>
                      Esta es una vista previa de NEXORA.
                      <br />
                      La emisión de vídeo todavía no está conectada.
                    </p>
                  </div>
                </div>
                <div className="player-details">
                  <Avatar n={selected.avatar} live />
                  <div>
                    <h2>
                      {selected.name} <Verified />
                    </h2>
                    <p>{selected.title}</p>
                    <small>{selected.game} · Español</small>
                  </div>
                  <button
                    className="primary-button"
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
                <span className="chat-demo">Chat local de demostración</span>
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
                    if (message.trim()) {
                      setMessages([
                        ...messages,
                        { name: displayName || "Tú", text: message.trim() },
                      ]);
                      setMessage("");
                    }
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
                    disabled={!message.trim()}
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
            <span className="eyebrow modal-kicker">TU ESPACIO EN NEXORA</span>
            <h2>
              {displayName ? `Hola, ${displayName}` : "Todo empieza contigo."}
            </h2>
            <p>Elige cómo te verá la comunidad en esta demo.</p>
            <form
              className="profile-form"
              onSubmit={(e) => {
                e.preventDefault();
                const value = nameInput.trim();
                if (value) {
                  setDisplayName(value);
                  try {
                    localStorage.setItem("nexora-name", value);
                  } catch {}
                  close();
                }
              }}
            >
              <label htmlFor="display-name">Tu nombre</label>
              <input
                id="display-name"
                placeholder="¿Cómo te llamas?"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                minLength={2}
                maxLength={24}
                required
              />
              <button className="primary-button">
                Guardar perfil <ArrowRight size={17} />
              </button>
            </form>
            <small className="modal-footnote">
              Perfil local de demostración. No crea una cuenta ni una sesión
              real.
            </small>
          </>
        ) : modal === "creator" ? (
          <>
            <span className="modal-symbol">
              <Radio size={27} />
            </span>
            <span className="eyebrow modal-kicker">EL ESCENARIO ES TUYO</span>
            <h2>
              {creatorSaved
                ? "Tu idea ya tiene un lugar."
                : "Dale voz a lo que te mueve."}
            </h2>
            <p>
              {creatorSaved
                ? "Tu borrador está guardado en este navegador. La conexión con OBS y el servidor de vídeo será el siguiente paso."
                : "Prepara tu próximo directo. Este panel es una vista previa para creadores."}
            </p>
            {creatorSaved ? (
              <button className="primary-button" onClick={close}>
                <Check size={17} /> Listo
              </button>
            ) : (
              <form
                className="profile-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  setDraft({
                    title: String(data.get("title") || ""),
                    category: String(data.get("category") || "Gaming"),
                  });
                  try {
                    localStorage.setItem(
                      "nexora-stream-draft",
                      JSON.stringify(Object.fromEntries(data)),
                    );
                  } catch {}
                  setCreatorSaved(true);
                }}
              >
                <label htmlFor="stream-title">Título del directo</label>
                <input
                  id="stream-title"
                  name="title"
                  defaultValue={draft.title}
                  placeholder="Hoy empieza algo increíble…"
                  required
                  maxLength={100}
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
                <div className="connection-status">
                  <span /> Servidor de streaming pendiente de conectar
                </div>
                <button className="primary-button">
                  Guardar borrador <ArrowRight size={17} />
                </button>
              </form>
            )}
          </>
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
              Prototipo interactivo. Los canales, cifras y chats son de
              demostración; no hay streaming ni autenticación real.
            </small>
          </>
        )}
      </dialog>
    </div>
  );
}
