# NEXORA

Plataforma de streaming en español con Next.js 15, React 19, TypeScript, Prisma/SQLite y MediaMTX. Identidad violeta y menta. **Tu mundo, en directo.**

## Desarrollo local

Node.js 24 y npm. No se crean usuarios, canales ni imágenes de muestra.

```bash
npm ci
npm run db:setup
npm run dev
```

Abre http://localhost:3000. `db:setup` crea `.env` desde `.env.example` si falta, genera Prisma, aplica migraciones y ejecuta un seed vacío. Conserva datos reales; la migración `20261022050000_creator_workspace` elimina canales marcados `isDemo` y las antiguas cuentas de showcase conocidas que no tengan canales reales. **Haz una copia de la base antes de migrar un entorno existente.** La base local `prisma/dev.db` y `.env` no se versionan.

```bash
npm run build
npm start
npm run typecheck
npm run test:api
npm run test:community
python3 scripts/test-migration.py
```

Detén el servidor de desarrollo antes de compilar: ambos usan `.next`. Las pruebas API crean bases SQLite y servidores aislados y los eliminan al terminar. No usan cuentas reales ni el servidor público. La prueba de migración comprueba relaciones y conservación de sesiones/claves/conversaciones.

## Recorridos

- `/`: catálogo real, búsqueda por canal/título/juego/etiquetas/idioma, categorías, seguidos y filtro en directo. Las listas vacías se muestran sin contenido inventado.
- `/channel/[slug]`: enlace compartible, reproductor, seguimiento y chat ocultable.
- `/login`, `/register`: cuentas y sesiones. Un espectador puede activar sus herramientas de creador desde el estudio.
- `/studio`: crear/editar el canal, portada mediante URL HTTPS, vista previa, datos de seguidores/mensajes, conexión OBS, equipo, reglas, sanciones, comandos y alertas.
- `/moderation`: solo canales asignados, chat público y privado del equipo, borrado, sanciones y reglas.
- `/admin`: administración global de estados de cuenta y auditoría. Asignación inicial exclusivamente desde una terminal autorizada: `npm run admin:promote -- correo-de-la-cuenta`.
- `/overlay/[slug]?token=…`: fuente transparente para OBS con alertas de seguidores. La URL se genera en el estudio; es privada, renovable y revocable. Solo permite leer alertas, no gestionar el canal ni publicar vídeo.
- `/roadmap`: capacidades disponibles y próximas fases. El detalle técnico está en [docs/ROADMAP.md](docs/ROADMAP.md).

## Permisos

| Acción                                           | Propietario | Moderador del canal | Administrador global | Espectador        |
| ------------------------------------------------ | ----------- | ------------------- | -------------------- | ----------------- |
| Editar canal                                     | Sí          | No                  | Sí                   | No                |
| Clave OBS, alertas, comandos y equipo            | Sí          | No                  | No                   | No                |
| Reglas, sanciones y borrado de chat              | Sí          | Sí                  | Sí                   | Solo sus mensajes |
| Chat privado del equipo                          | Sí          | Sí                  | Sí                   | No                |
| Suspender cuentas globalmente y auditoría global | No          | No                  | Sí                   | No                |

Los permisos se comprueban en cada petición y durante las conexiones SSE. Retirar un moderador corta el acceso a mensajes privados en la siguiente comprobación (hasta 1,5 segundos); una nueva petición ya se rechaza. Las sanciones del canal bloquean escribir, no ver vídeo. Las suspensiones globales revocan sesiones y claves de publicación.

## Chat, comandos y alertas

El chat usa **Server-Sent Events** para enviar instantáneas al cliente al cambiar el historial. El servidor consulta SQLite cada 1,5 segundos; cada conexión se renueva a los 25 segundos y EventSource reconecta automáticamente. Se conservan los últimos 100 mensajes en la vista. Los registros persisten hasta su eliminación; una política automática de retención es trabajo pendiente.

- Modo lento de 0 a 300 segundos, solo seguidores, bloqueo de enlaces y palabras/frases por línea o coma. Los filtros de enlaces son preventivos: no equivalen a un servicio de detección de phishing.
- Límite global por cuenta de 10 mensajes/10 segundos y rechazo de mensajes idénticos consecutivos para espectadores.
- Moderadores/propietario/admin están exentos de las reglas locales, pero no del límite global ni del silenciamiento de cuenta.
- Los comandos `!nombre` responden como NEXORA, admiten `{user}`, espera global por comando de 5–3600 segundos, desactivación y restricción al equipo. Máximo 100 por canal. No ejecutan código ni llaman URLs externas.
- Un seguimiento emite una actividad una vez al día por usuario/canal, evitando spam por seguir/dejar de seguir. Las alertas muestran eventos recientes; abrir una fuente no reproduce todo el historial.
- Fuente OBS recomendada 800×300, transparente y siempre cargada. Duración 3–20 segundos, color, mensaje y sonido breve. La reproducción sonora depende de la política de audio del navegador/OBS.
- Las claves de overlay se guardan mediante SHA-256, se muestran solo al generarlas y no se incluyen en el catálogo ni en la configuración recuperada. No compartas la URL ni captures su contenido en registros públicos.

## Configuración y vídeo

`APP_URL` debe coincidir con el origen público. Escrituras: JSON y `Origin` exacto. Cookies `HttpOnly`, `SameSite=Lax` y `Secure` bajo HTTPS. Fuera de localhost se requiere HTTPS. El callback servidor a servidor de MediaMTX no usa cookies/Origin; valida sus propias credenciales.

Variables en `.env.example`: `DATABASE_URL`, `APP_URL`, `MEDIAMTX_API_URL`, `MEDIAMTX_API_PASSWORD`, `VIDEO_INGEST_URL`, `VIDEO_HLS_URL`. Nunca publiques `.env`, bases de datos, contraseñas ni certificados privados.

Producción actual: https://cloudcraft.mx. OBS: servicio personalizado, servidor `rtmps://cloudcraft.mx:1936/live`, clave completa generada en **Estudio → Emisión y OBS**. Vídeo H.264/yuv420p, audio AAC estéreo, intervalo de fotogramas clave de 2 segundos. No es necesario renovar una clave existente al actualizar la plataforma.

La emisión se valida mediante MediaMTX, con rutas por canal y secreto privado. El backend consulta el estado real; el callback solo autoriza. Renovar/revocar corta la conexión anterior. Se usa HLS MPEG-TS con una calidad de origen; no hay transcodificación adaptativa, CDN ni grabación VOD en esta entrega.

## API de comunidad

Respuesta: `{data: ...}` o `{error: {code, message}}`. Rutas bajo `/api`. Escrituras con cookie de sesión y Origin, excepto el callback de vídeo. Las APIs de overlay usan `Authorization: Bearer <token>`.

| Ruta                                          | Métodos           | Uso                                                       |
| --------------------------------------------- | ----------------- | --------------------------------------------------------- |
| `auth/register`, `auth/login`, `auth/logout`  | POST              | Cuentas y sesiones                                        |
| `auth/me`                                     | GET               | Cuenta actual                                             |
| `account/creator`                             | POST              | Activar herramientas de creador propias                   |
| `streams`                                     | GET, POST         | Catálogo / crear canal (máximo cinco)                     |
| `streams/[slug]`                              | GET, PATCH        | Canal y metadatos                                         |
| `streams/[slug]/playback`                     | GET               | Estado y URL HLS pública                                  |
| `streams/[slug]/key`                          | GET, POST, DELETE | Estado, renovación y revocación de clave privada          |
| `streams/[slug]/dashboard`                    | GET               | Datos del canal, actividad, equipo, sanciones y auditoría |
| `streams/[slug]/moderators`                   | POST, DELETE      | Añadir/retirar por nombre exacto de usuario               |
| `streams/[slug]/bans`                         | POST, DELETE      | Sanciones; `{username, reason, minutes}`; 0 permanente    |
| `streams/[slug]/chat-settings`                | PATCH             | `{slowSeconds, followersOnly, blockLinks, blockedWords}`  |
| `streams/[slug]/chat`, `staff-chat`           | GET, POST         | Historial público o privado / enviar `{text}`             |
| `streams/[slug]/chat/[id]`, `staff-chat/[id]` | DELETE            | Borrar mensaje autorizado                                 |
| `streams/[slug]/events?scope=public\|staff`   | GET               | SSE con permisos vigentes                                 |
| `streams/[slug]/commands`                     | GET, POST, DELETE | CRUD por nombre; respuesta/cooldown/roles/estado          |
| `streams/[slug]/alerts`                       | GET, PATCH        | Configuración sin secretos                                |
| `streams/[slug]/overlay-key`                  | POST, DELETE      | Generar/renovar/revocar URL privada                       |
| `streams/[slug]/overlay-events?after=id`      | GET               | Cursor y eventos recientes con bearer privado             |
| `streams/[slug]/alert-test`                   | POST              | Evento de prueba para fuentes conectadas                  |
| `moderation`                                  | GET               | Canales accesibles por el equipo                          |
| `follows`                                     | GET, POST, DELETE | Seguimientos propios                                      |
| `admin/users`, `admin/audit`                  | GET               | Administración global                                     |
| `admin/users`                                 | PATCH             | Estado active/muted/banned, sin elevación de roles        |
| `video/auth`                                  | POST              | Callback MediaMTX                                         |
| `health`                                      | GET               | Salud de SQLite/configuración de vídeo                    |

## Despliegue y operaciones

El VPS usa `/opt/nexora` (Compose, código y configuración) y `/srv/nexora` (datos/copias). El contenedor web escucha en 127.0.0.1:3100, MediaMTX usa 1936 para RTMPS y 8888/9997 en loopback. Caddy publica HTTPS y reenvía `/live/*`. Las actualizaciones web no requieren reiniciar MediaMTX ni cambiar los servicios Pterodactyl.

Antes de una actualización: copia SQLite consistente, conserva imagen anterior, construye la nueva imagen, verifica la migración sobre una copia y aplica `prisma migrate deploy` antes de arrancar el nuevo web. No extraigas archivos sobre una entrega antigua: prepara un directorio nuevo para retirar también los recursos borrados. Comprueba salud, permisos, datos y SSE a través de Caddy. Si se revierte código tras esta migración, conserva el esquema añadido y evita ejecutar el antiguo seed, que recrearía el showcase.

Las copias actuales son locales y automáticas. Falta una copia externa y un ensayo completo de restauración antes de declarar preparación para un lanzamiento amplio. Las métricas visibles son conteos reales de seguidores, mensajes conservados y moderadores; no se inventan cifras de audiencia.
