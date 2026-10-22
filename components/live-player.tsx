"use client";
import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { api } from "@/lib/client";
import { playbackRecovery } from "@/lib/playback-recovery";
import type { Stream } from "@/lib/types";

export function LivePlayer({ stream }: { stream: Stream }) {
  const video = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [preferDash, setPreferDash] = useState(false);
  const alternate = useRef<string | null>(null);
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
        const data = await api<{
          status: string;
          url: string | null;
          dashUrl?: string | null;
        }>(`streams/${stream.slug}/playback`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          alternate.current = data.dashUrl ?? null;
          const h264 =
            !!document
              .createElement("video")
              .canPlayType('video/mp4; codecs="avc1.4D401F, mp4a.40.2"') ||
            (typeof MediaSource !== "undefined" &&
              MediaSource.isTypeSupported(
                'video/mp4; codecs="avc1.4D401F, mp4a.40.2"',
              ));
          setSource(
            data.dashUrl && (preferDash || !h264) ? data.dashUrl : data.url,
          );
          if (!data.url)
            setNotice(
              data.status === "capacity"
                ? "El servidor está ocupado. Esperando capacidad para preparar el directo…"
                : data.status === "processing"
                  ? "Preparando el directo para reproducirlo…"
                  : "Este canal todavía no está emitiendo.",
            );
        }
      } catch {
        if (!controller.signal.aborted) {
          setSource(null);
          setNotice("El servidor de vídeo no está disponible. Reintentando…");
        }
      } finally {
        loading = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [stream.slug, preferDash]);
  useEffect(() => {
    const element = video.current;
    if (!element || !source) return;
    setNotice("Cargando la emisión…");
    let managedByHls = false;
    const recovery = playbackRecovery(setNotice);
    let cancelled = false;
    let dispose = () => {};
    const failed = () => {
      if (cancelled || managedByHls) return;
      if (element.error?.code === MediaError.MEDIA_ERR_NETWORK) {
        recovery.network(() => {
          element.src = source;
          element.load();
          void element.play().catch(() => {});
        });
      } else if (
        element.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ) {
        if (alternate.current && !preferDash) setPreferDash(true);
        else
          setNotice(
            "No se pudo abrir el vídeo en este dispositivo. Pulsa Reintentar reproducción.",
          );
      } else {
        recovery.media(() => {
          element.load();
          void element.play().catch(() => {});
        });
      }
    };
    const loaded = () => setNotice("");
    element.addEventListener("error", failed);
    element.addEventListener("loadeddata", loaded);
    element.addEventListener("playing", loaded);
    if (source.endsWith(".mpd")) {
      managedByHls = true;
      void import("dashjs")
        .then(({ MediaPlayer }) => {
          if (cancelled) return;
          const player = MediaPlayer().create();
          dispose = () => player.reset();
          player.updateSettings({
            debug: { logLevel: 0 },
            streaming: { delay: { liveDelay: 6 } },
          });
          player.on(MediaPlayer.events.ERROR, () => {
            if (!cancelled) recovery.network(() => player.attachSource(source));
          });
          player.initialize(element, source, true);
        })
        .catch(() => {
          if (!cancelled)
            setNotice(
              "No se pudo cargar el reproductor. Pulsa Reintentar reproducción.",
            );
        });
    } else if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = source;
      void element.play().catch(() => {});
    } else {
      void import("hls.js")
        .then(({ default: Hls, ErrorDetails, ErrorTypes }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            if (alternate.current && !preferDash) setPreferDash(true);
            else setNotice("No se pudo abrir el vídeo en este dispositivo.");
            return;
          }
          managedByHls = true;
          const hls = new Hls();
          dispose = () => hls.destroy();
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              if (
                data.details === ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR
              ) {
                recovery.stop();
                if (alternate.current && !preferDash) setPreferDash(true);
                else
                  setNotice(
                    "No se pudo abrir el vídeo en este dispositivo. Pulsa Reintentar reproducción.",
                  );
              } else if (data.type === ErrorTypes.NETWORK_ERROR) {
                recovery.network(() => {
                  hls.stopLoad();
                  hls.loadSource(source);
                  hls.startLoad();
                });
              } else if (data.type === ErrorTypes.MEDIA_ERROR) {
                recovery.media(() => hls.recoverMediaError());
              } else {
                setNotice(
                  "No se pudo abrir la emisión. Pulsa Reintentar reproducción.",
                );
              }
            }
          });
          hls.loadSource(source);
          hls.attachMedia(element);
          hls.on(
            Hls.Events.MANIFEST_PARSED,
            () => void element.play().catch(() => {}),
          );
        })
        .catch(() => {
          if (!cancelled)
            setNotice(
              "No se pudo cargar el reproductor. Pulsa Reintentar reproducción.",
            );
        });
    }
    return () => {
      cancelled = true;
      recovery.stop();
      dispose();
      element.removeEventListener("error", failed);
      element.removeEventListener("loadeddata", loaded);
      element.removeEventListener("playing", loaded);
      element.removeAttribute("src");
      element.load();
    };
  }, [source, retry, preferDash]);
  return (
    <div className="live-player">
      {source ? (
        <video
          ref={video}
          controls
          autoPlay
          muted
          playsInline
          aria-label={`Emisión de ${stream.name}`}
        />
      ) : (
        <div className="offline-player">
          <span className="status-pill">SIN EMISIÓN</span>
          <div className="player-notice">
            <Radio size={36} />
            <h2>Estás en el canal de {stream.name}</h2>
            <p>{notice}</p>
          </div>
        </div>
      )}
      {source && notice && (
        <div role="status">
          <p className="api-error">{notice}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Reintentar reproducción
          </button>
        </div>
      )}
    </div>
  );
}
