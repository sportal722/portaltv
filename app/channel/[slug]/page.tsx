"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Heart, PanelRightClose, PanelRightOpen, Share2 } from "lucide-react";
import { api } from "@/lib/client";
import type { Stream, User } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { Avatar } from "@/components/channel-art";
import { LivePlayer } from "@/components/live-player";
import { ChannelChat } from "@/components/channel-chat";
export default function Channel({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [stream, setStream] = useState<Stream | null>(null),
    [user, setUser] = useState<User | null>(null),
    [following, setFollowing] = useState(false),
    [staff, setStaff] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [chat, setChat] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const [s, u] = await Promise.all([
          api<Stream>(`streams/${slug}`, { signal: c.signal }),
          api<User | null>("auth/me", { signal: c.signal }),
        ]);
        const f = u ? await api<number[]>("follows", { signal: c.signal }) : [];
        const m = u
          ? await api<Stream[]>("moderation", { signal: c.signal })
          : [];
        if (!c.signal.aborted) {
          setStream(s);
          setUser(u);
          setFollowing(f.includes(s.id));
          setStaff(m.some((x) => x.id === s.id));
          setError("");
        }
      } catch (e) {
        if (!c.signal.aborted) setError((e as Error).message);
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
  return (
    <>
      <SiteHeader />
      <main className={`watch-page ${chat ? "" : "theater"}`}>
        {error && (
          <p className="api-error" role="alert">
            {error}
          </p>
        )}
        {stream ? (
          <>
            <div className="watch-main">
              <LivePlayer stream={stream} />
              <section className="channel-details">
                <div className="channel-identity">
                  <Avatar name={stream.name} />
                  <div>
                    <h1>{stream.title}</h1>
                    <h2>{stream.name}</h2>
                    <p>
                      {stream.game} · {stream.language} · {stream.followers}{" "}
                      seguidores
                    </p>
                  </div>
                </div>
                <div className="stream-actions">
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={async () => {
                      if (!user) {
                        location.href = "/login";
                        return;
                      }
                      setBusy(true);
                      try {
                        await api("follows", {
                          method: following ? "DELETE" : "POST",
                          body: JSON.stringify({ streamId: stream.id }),
                        });
                        setFollowing(!following);
                        setStream({
                          ...stream,
                          followers: stream.followers + (following ? -1 : 1),
                        });
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Heart size={17} />
                    {following ? "Siguiendo" : "Seguir"}
                  </button>
                  <button onClick={() => setChat(!chat)}>
                    {chat ? (
                      <PanelRightClose size={17} />
                    ) : (
                      <PanelRightOpen size={17} />
                    )}
                    {chat ? "Ocultar chat" : "Mostrar chat"}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(location.href);
                        setNotice("Enlace copiado.");
                      } catch {
                        setNotice(
                          "Copia la dirección de esta página para compartir el canal.",
                        );
                      }
                    }}
                  >
                    <Share2 size={17} /> Compartir
                  </button>
                  {staff && (
                    <Link
                      href={
                        user?.id === stream.ownerId ? "/studio" : "/moderation"
                      }
                    >
                      Gestionar canal
                    </Link>
                  )}
                </div>
                {notice && <p role="status">{notice}</p>}
                <p className="channel-description">
                  {stream.description ||
                    "Este canal todavía no ha añadido una descripción."}
                </p>
                <div className="tag-row">
                  {stream.tag
                    .split(",")
                    .filter(Boolean)
                    .map((t) => (
                      <span key={t}>{t.trim()}</span>
                    ))}
                </div>
              </section>
            </div>
            {chat && <ChannelChat slug={slug} canModerate={staff} />}
          </>
        ) : (
          !error && <p role="status">Cargando canal…</p>
        )}
      </main>
    </>
  );
}
