"use client";
import { useState } from "react";
import { api } from "@/lib/client";
export function ReportChannel({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <details className="report-channel">
      <summary>Reportar este canal</summary>
      <form
        className="profile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const form = e.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          setBusy(true);
          setMessage("");
          try {
            await api("reports", {
              method: "POST",
              body: JSON.stringify({ ...values, slug }),
            });
            form.reset();
            setMessage("Denuncia recibida. El equipo revisará el canal.");
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Motivo
          <select name="reason">
            <option value="spam">Spam</option>
            <option value="harassment">Acoso</option>
            <option value="unsafe">Contenido peligroso</option>
            <option value="copyright">Derechos de autor</option>
            <option value="other">Otro motivo</option>
          </select>
        </label>
        <label>
          Describe lo ocurrido
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={1500}
          />
        </label>
        <small>Debes iniciar sesión para enviar una denuncia.</small>
        <button disabled={busy}>Enviar denuncia</button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
