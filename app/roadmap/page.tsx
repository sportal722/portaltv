import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
export default function Roadmap() {
  return (
    <>
      <SiteHeader />
      <main className="roadmap-page">
        <span className="kicker">CONSTRUIMOS NEXORA</span>
        <h1>
          Lo que ya puedes hacer.
          <br />
          Lo que viene después.
        </h1>
        <p>
          La plataforma evoluciona por fases. Esta página muestra las
          capacidades disponibles y las que todavía estamos preparando.
        </p>
        <section className="panel">
          <h2>Disponible · Emisión y comunidad</h2>
          <ul>
            <li>Registro, sesiones y emisión con OBS mediante RTMPS.</li>
            <li>
              Canales reales, búsqueda, categorías, seguimiento y reproductor
              HLS.
            </li>
            <li>
              Estudio para editar título, actividad, idioma, etiquetas,
              descripción y miniatura.
            </li>
            <li>Claves privadas de emisión con renovación y revocación.</li>
            <li>
              Chat con actualización automática, roles, moderadores y
              conversación privada del equipo.
            </li>
            <li>
              Modo lento, solo seguidores, filtros de palabras y enlaces,
              borrado y sanciones.
            </li>
            <li>Comandos personalizados y alertas de seguidores para OBS.</li>
            <li>Registro de acciones de moderación y administración.</li>
          </ul>
        </section>
        <section className="panel">
          <h2>Siguiente · Seguridad y preparación de lanzamiento</h2>
          <ul>
            <li>
              Verificación de correo, recuperación de contraseña, 2FA y gestión
              de dispositivos.
            </li>
            <li>
              Exportación y eliminación de datos, privacidad y normas de
              comunidad.
            </li>
            <li>Denuncias, apelaciones y soporte.</li>
            <li>
              Copias fuera del servidor, restauración probada, límites de
              capacidad y alertas de infraestructura.
            </li>
          </ul>
        </section>
        <section className="panel">
          <h2>Después · Contenido y crecimiento</h2>
          <ul>
            <li>VOD, clips, biblioteca y almacenamiento de objetos.</li>
            <li>Notificaciones de inicio de directo y calendario.</li>
            <li>
              Estadísticas de audiencia, historial de emisiones y exportaciones.
            </li>
            <li>
              Transcodificación con varias calidades, CDN y pruebas de carga.
            </li>
            <li>API pública con OAuth, webhooks e integraciones.</li>
          </ul>
        </section>
        <section className="panel">
          <h2>Futuro · Ecosistema</h2>
          <ul>
            <li>Suscripciones, propinas y pagos con trazabilidad.</li>
            <li>Recompensas, eventos y emisiones colaborativas.</li>
            <li>
              Subtítulos, transcripciones y herramientas asistidas por IA.
            </li>
            <li>Aplicaciones y experiencias para más dispositivos.</li>
          </ul>
        </section>
        <Link className="primary-button" href="/studio">
          Entrar al estudio
        </Link>
      </main>
    </>
  );
}
