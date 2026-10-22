"use client";
import { useState } from "react";
import type { Stream } from "@/lib/types";
export function Avatar({ name }: { name: string }) {
  return (
    <span className="channel-avatar" aria-hidden="true">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
export function ChannelArt({
  stream,
}: {
  stream: Pick<
    Stream,
    "name" | "thumbnailUrl" | "liveThumbnailUrl" | "category" | "status"
  >;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const live = stream.status === "live" ? stream.liveThumbnailUrl : null;
  const src = live && failed !== live ? live : stream.thumbnailUrl;
  return (
    <div className="channel-art">
      {src && failed !== src ? (
        <img
          key={src}
          src={src}
          alt={
            live && src === live
              ? `Captura del directo de ${stream.name}`
              : `Portada de ${stream.name}`
          }
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : (
        <div className="channel-art-mark" aria-hidden="true">
          N<span>✦</span>
        </div>
      )}
      <span className={`status-pill ${stream.status === "live" ? "on" : ""}`}>
        {stream.status === "live"
          ? "● EN DIRECTO"
          : stream.status === "unavailable"
            ? "SIN CONEXIÓN"
            : "DESCONECTADO"}
      </span>
      <span className="art-category">{stream.category}</span>
    </div>
  );
}
