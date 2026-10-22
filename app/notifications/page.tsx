"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { api } from "@/lib/client";
type Notice = { id: number; title: string; startedAt: string; readAt: string | null; stream: { slug: string; owner: { username: string } } };
type Preference = { streamId: number; notifyLive: boolean; stream: Notice["stream"] };
type Inbox = { items: Notice[]; unread: number; next: number | null };
type Preferences = { items: Preference[]; next: number | null };
export default function Notifications() {
  const [inbox, setInbox] = useState<Inbox | null>(null), [preferences, setPreferences] = useState<Preferences | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [before, setBefore] = useState<number | null>(null), [after, setAfter] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const [list, prefs] = await Promise.all([
          api<Inbox>(`notifications${before ? `?before=${before}` : ""}`, { signal: controller.signal }),
          api<Preferences>(`notifications/preferences${after ? `?after=${after}` : ""}`, { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) { setInbox(list); setPreferences(prefs); setError(""); }
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    }
    void refresh(); const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [before, after]);
  async function mutate(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <><SiteHeader /><main className="security-page">
    <Link href="/">← Volver</Link><h1>Notificaciones</h1>
    <p>Avisos de inicio de los canales que sigues. Puedes consultar los últimos 30 días. Una reconexión breve no genera otro aviso.</p>
    {error && <p role="alert" className="api-error">{error}</p>}
    {!inbox && !error && <p>Cargando…</p>}
    {inbox && <section className="panel">
      <h2>Tu bandeja · {inbox.unread} sin leer</h2>
      <button disabled={busy || !inbox.items.length} onClick={() => void mutate(async () => {
        await api("notifications/read", { method: "POST", body: JSON.stringify({ through: inbox.items[0].id }) });
        setInbox(await api<Inbox>(`notifications${before ? `?before=${before}` : ""}`));
      })}>Marcar esta página y las anteriores como leídas</button>
      {!inbox.items.length && <p>No hay avisos. Sigue canales y activa sus notificaciones para recibir el próximo inicio de directo.</p>}
      <div className="session-list">{inbox.items.map(item => <article key={item.id}>
        <Link href={`/channel/${encodeURIComponent(item.stream.slug)}`}><strong>{item.stream.owner.username} inició un directo</strong></Link>
        {!item.readAt && <span> · Sin leer</span>}<p>{item.title}</p><time dateTime={item.startedAt}>{new Date(item.startedAt).toLocaleString("es")}</time>
      </article>)}</div>
      <div className="security-actions"><button disabled={!before} onClick={() => setBefore(null)}>Más recientes</button><button disabled={!inbox.next} onClick={() => setBefore(inbox.next)}>Más antiguos</button></div>
    </section>}
    {preferences && <section className="panel"><h2>Avisos por canal</h2><p>Estos ajustes controlan los avisos dentro de NEXORA. No se envían correos ni notificaciones push.</p>
      {!preferences.items.length && <p>No sigues canales en esta página.</p>}
      <div className="session-list">{preferences.items.map(p => <label key={p.streamId}><input type="checkbox" checked={p.notifyLive} disabled={busy} onChange={e => { const notifyLive = e.target.checked; void mutate(async () => {
        await api("notifications/preferences", { method: "PATCH", body: JSON.stringify({ streamId: p.streamId, notifyLive }) });
        setPreferences(current => current && ({ ...current, items: current.items.map(item => item.streamId === p.streamId ? { ...item, notifyLive } : item) }));
      }); }} /> Avisarme cuando {p.stream.owner.username} inicie un directo</label>)}</div>
      <div className="security-actions"><button disabled={!after} onClick={() => setAfter(null)}>Primeros canales</button><button disabled={!preferences.next} onClick={() => setAfter(preferences.next)}>Más canales</button></div>
    </section>}
  </main></>;
}
