"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Radio, Search, Heart, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Avatar, ChannelArt } from "@/components/channel-art";
import { api } from "@/lib/client";
import { channelCategories } from "@/lib/catalog";
import type { Stream, User } from "@/lib/types";
export default function Home() {
  const [streams, setStreams] = useState<Stream[]>([]),
    [user, setUser] = useState<User | null>(null),
    [follows, setFollows] = useState<number[]>([]);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Todos"),
    [tab, setTab] = useState("Explorar"),
    [liveOnly, setLiveOnly] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const [rows, account] = await Promise.all([
          api<Stream[]>("streams", { signal: c.signal }),
          api<User | null>("auth/me", { signal: c.signal }),
        ]);
        const followed = account
          ? await api<number[]>("follows", { signal: c.signal })
          : [];
        if (!c.signal.aborted) {
          setStreams(rows);
          setUser(account);
          setFollows(followed);
          setError("");
        }
      } catch (e) {
        if (!c.signal.aborted) setError((e as Error).message);
      } finally {
        pending = false;
        if (!c.signal.aborted) setLoading(false);
      }
    }
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => {
      c.abort();
      clearInterval(t);
    };
  }, []);
  const visible = streams
    .filter(
      (s) =>
        (tab !== "Siguiendo" || follows.includes(s.id)) &&
        (!liveOnly || s.status === "live") &&
        (category === "Todos" || s.category === category) &&
        `${s.name} ${s.title} ${s.game} ${s.tag} ${s.language}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => Number(b.status === "live") - Number(a.status === "live"));
  const live = streams.filter((s) => s.status === "live");
  return (
    <>
      <SiteHeader />
      <main className="discovery-page">
        <section className="welcome-hero">
          <div>
            <span className="kicker">
              <Sparkles size={15} /> TU MUNDO, EN DIRECTO
            </span>
            <h1>
              Encuentra tu gente.
              <br />
              <em>Comparte tu mundo.</em>
            </h1>
            <p>
              Directos, conversaciones y comunidades que empiezan con una
              conexión.
            </p>
            <Link href="/studio" className="primary-button">
              Abrir mi estudio <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <Radio size={90} />
            <span>NEXORA LIVE</span>
          </div>
        </section>
        <section
          className="discovery-toolbar"
          aria-label="Buscar y filtrar canales"
        >
          <div className="section-tabs">
            {["Explorar", "Siguiendo"].map((name) => (
              <button
                key={name}
                aria-pressed={tab === name}
                onClick={() => setTab(name)}
              >
                {name === "Siguiendo" && <Heart size={16} />}
                {name}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Buscar canales"
              placeholder="Canal, título, juego o etiqueta"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={liveOnly}
              onChange={(e) => setLiveOnly(e.target.checked)}
            />{" "}
            Solo en directo
          </label>
        </section>
        <div className="category-filters" aria-label="Categorías">
          {["Todos", ...channelCategories].map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="section-title">
          <h2>
            {tab === "Siguiendo" ? "Tus canales" : "Descubre la comunidad"}
          </h2>
          <span>
            {live.length}{" "}
            {live.length === 1 ? "canal en directo" : "canales en directo"}
          </span>
        </div>
        {error && (
          <p className="api-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="empty-state" role="status">
            Cargando canales…
          </div>
        ) : !visible.length ? (
          <div className="empty-state">
            <Radio size={40} />
            <h3>
              {tab === "Siguiendo" && !user
                ? "Tu comunidad, siempre cerca"
                : "Aquí empieza algo nuevo"}
            </h3>
            <p>
              {tab === "Siguiendo" && !user
                ? "Inicia sesión para ver los canales que sigues."
                : streams.length
                  ? "No hay canales que coincidan con estos filtros."
                  : "Todavía no hay canales. Crea el tuyo y comienza la primera conversación."}
            </p>
            <Link
              href={tab === "Siguiendo" && !user ? "/login" : "/studio"}
              className="secondary-button"
            >
              {tab === "Siguiendo" && !user
                ? "Iniciar sesión"
                : "Crear mi canal"}
            </Link>
          </div>
        ) : (
          <div className="channel-grid">
            {visible.map((s) => (
              <Link
                className="channel-card"
                href={`/channel/${s.slug}`}
                key={s.id}
              >
                <ChannelArt stream={s} />
                <div className="channel-card-info">
                  <Avatar name={s.name} />
                  <div>
                    <h3>{s.title}</h3>
                    <strong>{s.name}</strong>
                    <p>
                      {s.game} · {s.language}
                    </p>
                    <div className="tag-row">
                      {s.tag
                        .split(",")
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((t) => (
                          <span key={t}>{t.trim()}</span>
                        ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <section className="creator-invite">
          <div>
            <span className="kicker">HECHO PARA CREAR</span>
            <h2>Tu canal. Tu comunidad. Tus reglas.</h2>
            <p>
              Gestiona tu directo, prepara tus alertas y reúne a tu equipo desde
              un mismo estudio.
            </p>
          </div>
          <Link href="/studio" className="primary-button">
            Ir al estudio <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="site-footer">
        <span>NEXORA · Conecta. Comparte. Vive el directo.</span>
        <Link href="/roadmap">Hoja de ruta</Link>
      </footer>
    </>
  );
}
