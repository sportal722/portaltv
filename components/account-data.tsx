"use client";
import { useState } from "react";
import { api } from "@/lib/client";
export function AccountData() {
  const [password, setPassword] = useState(""), [code, setCode] = useState(""), [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function execute(remove: boolean) {
    if (busy) return;
    if (remove && !confirm("¿Eliminar definitivamente tu cuenta, canales y mensajes? Esta acción no se puede deshacer.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await api(remove ? "account/delete" : "account/export", {
        method: remove ? "DELETE" : "POST", body: JSON.stringify({ password, code, confirmation }),
      });
      if (remove) { location.href = "/"; return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "nexora-mis-datos.json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCode(""); setPassword(""); setMessage("Exportación descargada. Guárdala en un lugar privado.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>Tus datos y tu cuenta</h2>
    <p>Descarga tus datos en JSON: cuenta, canales, mensajes propios, seguimientos, configuración, sesiones y denuncias enviadas. Las contraseñas, claves de emisión y secretos de autenticación se excluyen.</p>
    <p>Eliminar tu cuenta borra sus canales, mensajes, seguimientos y sesiones, y revoca la emisión. El registro de acciones se conserva sin tus identificadores. Las copias de seguridad pueden conservar tus datos hasta que se aplique su retención; la eliminación no borra inmediatamente esas copias ni las menciones que otras personas escribieron.</p>
    {error && <p role="alert" className="api-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="profile-form">
      <label htmlFor="data-password">Confirma tu contraseña</label>
      <input id="data-password" type="password" autoComplete="current-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
      <label htmlFor="data-code">Código 2FA o de recuperación, si está activado</label>
      <input id="data-code" autoComplete="one-time-code" maxLength={19} value={code} onChange={e => setCode(e.target.value)} />
      <button disabled={busy || !password} onClick={() => void execute(false)}>Descargar mis datos</button>
      <label htmlFor="data-confirmation">Para eliminar la cuenta, escribe tu nombre de usuario</label>
      <input id="data-confirmation" autoComplete="off" maxLength={24} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      <small>Si eres el último administrador, primero debes asignar otro administrador activo.</small>
      <button disabled={busy || !password || !confirmation} onClick={() => void execute(true)}>Eliminar mi cuenta definitivamente</button>
    </div>
  </section>;
}
