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
  stream: Pick<Stream, "name" | "thumbnailUrl" | "category" | "status">;
}) {
  return (
    <div className="channel-art">
      {stream.thumbnailUrl ? (
        <img
          key={stream.thumbnailUrl}
          src={stream.thumbnailUrl}
          alt={`Portada de ${stream.name}`}
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
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
