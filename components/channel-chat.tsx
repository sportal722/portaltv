"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import type { Message, User } from "@/lib/types";
export function ChannelChat({
  slug,
  staff = false,
  canModerate = false,
}: {
  slug: string;
  staff?: boolean;
  canModerate?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [user, setUser] = useState<User | null>(null);
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);
  const route = `streams/${slug}/${staff ? "staff-chat" : "chat"}`;
  useEffect(() => {
    const c = new AbortController();
    setMessages([]);
    setText("");
    setError("");
    setConnected(false);
    api<User | null>("auth/me", { signal: c.signal })
      .then(setUser)
      .catch(() => {});
    const events = new EventSource(
      `/api/streams/${slug}/events?scope=${staff ? "staff" : "public"}`,
    );
    events.addEventListener("messages", (event) => {
      setMessages(JSON.parse((event as MessageEvent).data));
      setConnected(true);
    });
    events.addEventListener("denied", (event) => {
      setMessages([]);
      setError(JSON.parse((event as MessageEvent).data));
      events.close();
      setConnected(false);
    });
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    return () => {
      c.abort();
      events.close();
    };
  }, [slug, staff]);
  useEffect(() => {
    if (nearBottom.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages]);
  return (
    <section
      className="channel-chat"
      aria-label={staff ? "Chat privado del equipo" : "Chat del canal"}
    >
      <div className="chat-heading">
        <h2>{staff ? "Chat del equipo" : "Chat en directo"}</h2>
        <span className={connected ? "connected" : "muted"}>
          {connected ? "Conectado" : "Reconectando…"}
        </span>
      </div>
      {staff && (
        <p className="muted">
          Solo el propietario, sus moderadores y administradores.
        </p>
      )}
      <div
        className="chat-messages"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {!messages.length && (
          <p className="empty-chat">La conversación empieza contigo.</p>
        )}
        {messages.map((m) => (
          <div className="chat-line" key={m.id}>
            <span className={`chat-author role-${m.role}`}>{m.name}</span>
            {m.role !== "viewer" && (
              <small className="role-badge">
                {m.role === "moderator" ? "MOD" : m.role.toUpperCase()}
              </small>
            )}
            <span>{m.text}</span>
            {(canModerate || (user?.id === m.userId && !m.isBot)) && (
              <button
                className="delete-message"
                aria-label={`Eliminar mensaje de ${m.name}`}
                onClick={async () => {
                  try {
                    await api(`${route}/${m.id}`, { method: "DELETE" });
                    setMessages((rows) => rows.filter((x) => x.id !== m.id));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      <form
        className="chat-compose"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() || busy) return;
          setBusy(true);
          setError("");
          try {
            await api(route, {
              method: "POST",
              body: JSON.stringify({ text }),
            });
            setText("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          aria-label={staff ? "Mensaje al equipo" : "Mensaje al canal"}
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            user ? "Escribe un mensaje…" : "Inicia sesión para participar"
          }
          disabled={!user}
        />
        <button
          className="primary-button"
          disabled={!user || busy || !text.trim()}
          aria-label="Enviar mensaje"
        >
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}
