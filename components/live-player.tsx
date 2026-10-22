"use client";
import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { api } from "@/lib/client";
import type { Stream } from "@/lib/types";

export function LivePlayer({ stream }: { stream: Stream }) {
  const video = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState("Comprobando la emisión…");
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    setSource(null);
    setNotice("Comprobando la emisión…");
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const data = await api<{ status: string; url: string | null }>(`streams/${stream.slug}/playback`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setSource(data.url);
          if (!data.url) setNotice("Este canal todavía no está emitiendo.");
        }
      } catch {
        if (!controller.signal.aborted) { setSource(null); setNotice("El servidor de vídeo no está disponible. Reintentando…"); }
      } finally { loading = false; }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [stream.slug]);
  useEffect(() => {
    const element = video.current;
    if (!element || !source) return;
    setNotice("");
    let cancelled = false;
    let dispose = () => {};
    const failed = () => setNotice("No se pudo reproducir la señal. Comprueba la conexión y vuelve a abrir el canal.");
    const loaded = () => setNotice("");
    element.addEventListener("error", failed);
    element.addEventListener("loadeddata", loaded);
    if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = source;
      void element.play().catch(() => {});
    } else {
      void import("hls.js").then(({ default: Hls, ErrorDetails }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) { setNotice("Tu navegador no admite reproducción HLS."); return; }
        const hls = new Hls();
        dispose = () => hls.destroy();
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            if (data.details === ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR)
              setNotice("Tu navegador no admite el códec de esta emisión. Usa un navegador compatible con H.264 y AAC.");
            else failed();
          }
        });
        hls.loadSource(source);
        hls.attachMedia(element);
        hls.on(Hls.Events.MANIFEST_PARSED, () => void element.play().catch(() => {}));
      }).catch(failed);
    }
    return () => { cancelled = true; dispose(); element.removeEventListener("error", failed); element.removeEventListener("loadeddata", loaded); element.removeAttribute("src"); element.load(); };
  }, [source, retry]);
  return <div className="live-player">
    {source ? <video ref={video} controls autoPlay muted playsInline aria-label={`Emisión de ${stream.name}`} /> :
      <div className="demo-player" style={{ backgroundImage: `url('/images/${stream.image}-scene.jpg')` }}>
        <span className="demo-player-badge">{stream.isDemo ? "CANAL DE EJEMPLO" : "SIN EMISIÓN"}</span>
        <div className="player-notice"><Radio size={36} /><h2>Estás en el canal de {stream.name}</h2><p>{notice}</p></div>
      </div>}
    {source && notice && <div role="status"><p className="api-error">{notice}</p><button className="primary-button" type="button" onClick={() => setRetry(n => n + 1)}>Reintentar reproducción</button></div>}
  </div>;
}
