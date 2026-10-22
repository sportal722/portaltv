"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
type Connection = { server: string; hasKey: boolean; streamKey?: string; disconnectPending?: boolean };
export function StreamConnection({ slug }: { slug: string }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setConnection(null); setError(""); setNotice(""); setReveal(false);
    api<Connection>(`streams/${slug}/key`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setConnection(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [slug]);
  async function change(method: "POST" | "DELETE") {
    setBusy(true); setError(""); setNotice(""); setReveal(false);
    try {
      const data = await api<Connection>(`streams/${slug}/key`, { method });
      setConnection(previous => ({ ...previous!, ...data, streamKey: data.streamKey }));
      setNotice(data.disconnectPending ? "La clave anterior ya no admite conexiones nuevas. No se pudo confirmar la desconexión de la emisión anterior: detén OBS y comprueba el servidor." : method === "DELETE" ? "Clave revocada. La emisión se ha desconectado." : "Copia esta clave ahora; solo se muestra durante esta sesión. La clave anterior ha dejado de funcionar.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cambiar la clave."); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(connection!.streamKey!); setNotice("Clave copiada. Pégala en OBS y guárdala en privado."); }
    catch { setReveal(true); setNotice("Selecciona y copia la clave manualmente."); }
  }
  return <section className="stream-connection" aria-label="Conectar OBS">
    <h3>Emite desde OBS o Streamlabs</h3>
    <p>En Emisión, elige «Servicio personalizado». Usa vídeo H.264, audio AAC y un intervalo de fotogramas clave de 2 segundos.</p>
    {error && <p className="api-error" role="alert">{error}</p>}
    {connection && <>
      <label htmlFor="obs-server">Servidor</label>
      <input id="obs-server" readOnly value={connection.server} />
      {connection.streamKey && <>
        <label htmlFor="obs-key">Clave de transmisión (privada)</label>
        <input id="obs-key" type={reveal ? "text" : "password"} autoComplete="off" readOnly value={connection.streamKey} />
        <div className="stream-actions"><button type="button" onClick={() => setReveal(!reveal)}>{reveal ? "Ocultar" : "Mostrar"}</button><button type="button" onClick={() => void copy()}>Copiar clave</button></div>
      </>}
      <div className="stream-actions">
        <button type="button" disabled={busy} onClick={() => void change("POST")}>{busy ? "Procesando…" : connection.hasKey ? "Renovar clave y cortar emisión" : "Crear clave de emisión"}</button>
        {connection.hasKey && <button type="button" disabled={busy} onClick={() => void change("DELETE")}>Revocar clave</button>}
      </div>
      <p>Inicia la transmisión en OBS y abre tu canal para verla. El directo aparecerá cuando llegue la señal. Renovar o revocar corta la emisión actual.</p>
    </>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
