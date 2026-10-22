"use client";
import { use, useEffect, useState } from "react";
import { Bell } from "lucide-react";
type Alert = { id: number; username: string };
type Settings = {
  template: string;
  accent: string;
  durationSeconds: number;
  soundEnabled: boolean;
};
export default function Overlay({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [active, setActive] = useState<{
      event: Alert;
      settings: Settings;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    document.body.classList.add("overlay-body");
    const c = new AbortController(),
      token = new URLSearchParams(location.search).get("token") ?? "";
    let cursor: number | null = null,
      pending = false,
      displaying = false;
    const queue: { event: Alert; settings: Settings }[] = [];
    let displayTimer: ReturnType<typeof setTimeout> | undefined;
    let sound: AudioContext | undefined;
    function showNext() {
      if (c.signal.aborted || displaying || !queue.length) return;
      displaying = true;
      const item = queue.shift()!;
      setActive(item);
      if (item.settings.soundEnabled) {
        try {
          sound ??= new AudioContext();
          void sound
            .resume()
            .then(() => {
              if (c.signal.aborted) return;
              const tone = sound!.createOscillator(),
                gain = sound!.createGain();
              tone.frequency.value = 660;
              gain.gain.setValueAtTime(0.08, sound!.currentTime);
              gain.gain.exponentialRampToValueAtTime(
                0.001,
                sound!.currentTime + 0.4,
              );
              tone.connect(gain);
              gain.connect(sound!.destination);
              tone.start();
              tone.stop(sound!.currentTime + 0.4);
            })
            .catch(() => {});
        } catch {}
      }
      displayTimer = setTimeout(() => {
        setActive(null);
        displaying = false;
        showNext();
      }, item.settings.durationSeconds * 1000);
    }
    async function poll() {
      if (pending || c.signal.aborted) return;
      pending = true;
      try {
        const r = await fetch(
          `/api/streams/${slug}/overlay-events${cursor === null ? "" : `?after=${cursor}`}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: c.signal,
            referrerPolicy: "no-referrer",
          },
        );
        if (!r.ok) {
          if (r.status === 403 || r.status === 404) {
            setError(
              "Fuente de alertas no disponible. Revisa la URL privada en tu estudio.",
            );
            setActive(null);
            queue.length = 0;
            c.abort();
          }
          return;
        }
        const { data } = await r.json();
        if (c.signal.aborted) return;
        cursor = data.cursor;
        setError("");
        queue.push(
          ...data.events
            .slice(0, Math.max(0, 20 - queue.length))
            .map((event: Alert) => ({ event, settings: data.settings })),
        );
        showNext();
      } catch {
      } finally {
        pending = false;
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      c.abort();
      clearInterval(timer);
      clearTimeout(displayTimer);
      void sound?.close();
      document.body.classList.remove("overlay-body");
    };
  }, [slug]);
  return (
    <main className="obs-overlay">
      {active && (
        <div
          className="obs-alert"
          style={{ borderColor: active.settings.accent }}
        >
          <Bell size={36} color={active.settings.accent} />
          <p>
            {active.settings.template.replaceAll(
              "{user}",
              active.event.username,
            )}
          </p>
        </div>
      )}
      {error && <p className="overlay-error">{error}</p>}
    </main>
  );
}
