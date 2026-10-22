# NEXORA

Plataforma de streaming en español con backend local en Next.js 15, React 19, TypeScript, Prisma 6.16.2 y SQLite. Identidad oscura, violeta, cian y coral. **Tu mundo, en directo.**

## Preparación local

Recomendado Node.js 22 o 24 y npm. Desde la raíz del repositorio:

```bash
npm ci
npm run db:setup
npm run dev
```

Abrir **http://localhost:3000**. `db:setup` crea `.env` desde `.env.example` si no existe, genera Prisma Client, aplica las migraciones versionadas y carga ocho canales de ejemplo. Es idempotente: no borra cuentas, mensajes ni canales existentes. La base de datos queda en `prisma/dev.db` y está excluida de Git.

Para ejecutar el build de producción local:

```bash
npm run build
npm start
```

Detener `npm run dev` antes de compilar; dev y build comparten `.next`.

### Configuración

`.env.example` contiene únicamente configuración local sin credenciales:

- `DATABASE_URL="file:./dev.db"`: ruta relativa al esquema de Prisma.
- `APP_URL="http://localhost:3000"`: origen público exacto (incluido el puerto) usado para validar las peticiones de escritura. Si cambias el puerto, dominio o protocolo, actualiza esta variable y reinicia.

Fuera de localhost, `APP_URL` debe usar HTTPS. Las cookies llevan `Secure` cuando `APP_URL` usa HTTPS. Solo se admite HTTP para desarrollo en localhost/127.0.0.1/::1. No expongas la base de datos ni el archivo `.env` como recursos públicos. No hacen falta claves de proveedores externos para probar estas APIs.

## Usar la aplicación

1. Abre **Mi perfil** o visita `/register`.
2. Crea una cuenta de espectador o de creador; contraseña de 12 a 128 caracteres.
3. Sigue canales con el corazón y consulta **Siguiendo**. Los favoritos pertenecen a la cuenta y persisten en SQLite.
4. Abre un canal para consultar y enviar mensajes. El chat carga el historial y consulta nuevos mensajes cada tres segundos.
5. Con una cuenta de creador, abre **Mi canal** para crear o editar tu canal (título, categoría, juego/tema y portada). Conecta OBS usando las instrucciones de vídeo de abajo; el canal queda sin emisión hasta recibir una señal válida.
6. Cierra sesión desde Mi perfil. También existe `/login`.

Los antiguos perfiles, favoritos y borradores de localStorage ya no se utilizan ni se importan como cuentas reales. No se guardan contraseñas ni tokens en localStorage.

### Administración local

Registra primero una cuenta normal y, desde una terminal con acceso a la base de datos, ejecuta:

```bash
npm run admin:promote -- tu-email-registrado
```

Después abre `/admin` para silenciar, suspender o reactivar usuarios. No hay contraseña de administrador predeterminada ni una API pública para asignar este rol. La API comprueba el rol en cada petición, impide modificar el estado del propio administrador y revoca todas las sesiones de una cuenta suspendida. Un usuario silenciado puede consultar el chat, pero no enviar mensajes. El propietario de un canal y los administradores pueden eliminar mensajes mediante la API; cada usuario también puede eliminar sus propios mensajes.

## APIs locales

Todas las respuestas usan `{ "data": ... }` o `{ "error": { "code": "...", "message": "..." } }`. Salvo el callback de autenticación de MediaMTX, las peticiones de escritura requieren `Content-Type: application/json` si llevan cuerpo y una cabecera `Origin` que coincida con `APP_URL`, también desde curl u otros clientes locales. Las rutas privadas requieren la cookie de sesión emitida al registrar o iniciar sesión.

| Método y ruta                          | Uso / permisos                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/health`                      | Estado de conexión a SQLite y estado de vídeo                                      |
| `POST /api/auth/register`              | `{email, username, password, role: "viewer" o "creator"}`                          |
| `POST /api/auth/login`                 | `{email, password}`; crea una sesión                                               |
| `POST /api/auth/logout`                | Revoca la sesión y elimina la cookie                                               |
| `GET /api/auth/me`                     | Usuario actual o `null`; nunca devuelve contraseñas ni tokens                      |
| `GET /api/streams`                     | Catálogo; admite `q`, `category` y `mine=true` (requiere sesión)                   |
| `POST /api/streams`                    | Creador/admin; `{title, category, game?, image?}`; máximo cinco canales por cuenta |
| `GET /api/streams/[slug]`              | Canal público                                                                      |
| `PATCH /api/streams/[slug]`            | Propietario/admin; actualizar título, categoría, juego o portada                   |
| `GET /api/streams/[slug]/playback`     | Estado real y URL HLS pública sin clave de publicación |
| `GET /api/streams/[slug]/key`          | Solo propietario; servidor y existencia de clave, nunca el secreto |
| `POST /api/streams/[slug]/key`         | Solo propietario; crea/renueva clave, mostrada una sola vez; corta la emisión anterior |
| `DELETE /api/streams/[slug]/key`       | Solo propietario; revoca y desconecta la emisión |
| `POST /api/video/auth`                | Callback de MediaMTX; valida credenciales de publicación/control y lectura pública; no usa cookies ni Origin |
| `GET /api/follows`                     | IDs de canales seguidos por la sesión actual                                       |
| `POST /api/follows`                    | `{streamId}`; seguir de forma idempotente                                          |
| `DELETE /api/follows`                  | `{streamId}`; dejar de seguir                                                      |
| `GET /api/streams/[slug]/chat`         | Últimos 100 mensajes en orden cronológico                                          |
| `POST /api/streams/[slug]/chat`        | Sesión activa; `{text}` de 1 a 300 caracteres                                      |
| `DELETE /api/streams/[slug]/chat/[id]` | Autor del mensaje, propietario del canal o admin                                   |
| `GET /api/admin/users`                 | Solo admin; hasta 100 usuarios, sin hashes ni emails                               |
| `PATCH /api/admin/users`               | Solo admin; `{id, status: "active", "muted" o "banned"}`                           |
| `GET /api/clips`                       | Lista vacía hasta integrar el servicio de vídeo                                    |

Categorías admitidas: Gaming, Esports, Charlando, Música e IRL. Las portadas se eligen entre las imágenes locales del catálogo. La API asigna el propietario y el slug; rechaza cambios de estado de emisión, espectadores e identidad desde el cliente.

Comprobación rápida:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/streams
```

### Seguridad implementada

- Contraseñas con scrypt (N=32768, r=8, p=1), sal aleatoria y comparación de tiempo constante.
- Sesiones de siete días con token aleatorio de 256 bits, hash SHA-256 en SQLite y cookie HttpOnly, SameSite=Lax, Path=/ y Secure con HTTPS.
- Expiración, cierre de sesión, rotación al acceder y revocación por suspensión.
- Validación en servidor de los payloads; límite de cuerpo de 16 KiB y comprobación de origen contra CSRF.
- Permisos consultados en servidor, sin aceptar identidad ni rol administrativo del cliente.
- Límites persistentes: chat (10 mensajes/10 s por cuenta), login/registro (8 intentos/15 min por email), autenticación global (120/min), registros globales (60/h) y creación de canales (10 intentos/h por cuenta).
- Moderación mediante suspensión/silencio, borrado de mensajes y una lista inicial de dos términos de spam de prueba (`spamcasino`, `scamlink`). Debe ampliarse para una comunidad real.
- Errores consistentes sin imprimir credenciales ni errores internos de la base de datos.

## Verificación reproducible

```bash
npm run db:setup
npm run build
npm run typecheck
npm run test:api
npm audit
```

`test:api` levanta un servidor HTTP en un puerto local libre con una base SQLite temporal, aplica las migraciones y carga el seed. Usa únicamente identidades sintéticas y contraseñas aleatorias en memoria. Prueba autenticación, cookies, validación, permisos entre cuentas, favoritos, chat, moderación, límites y persistencia al reiniciar el servidor. También comprueba `Secure` con una configuración HTTPS sintética; esto no despliega un servidor TLS. El test detiene su servidor y elimina su base temporal, sin tocar `prisma/dev.db`. Debe ejecutarse después de `npm run build` y no en paralelo con otro build.

## Conectar OBS y reproducir vídeo

El servidor de vídeo vive en el repositorio separado [nexora-streaming](https://github.com/sportal722/nexora-streaming). Sigue su README para instalar MediaMTX y configurar estas variables en el `.env` privado de esta web:

```dotenv
MEDIAMTX_API_URL="http://127.0.0.1:9997"
MEDIAMTX_API_PASSWORD="CONTRASENA_ALEATORIA_GENERADA_LOCALMENTE"
VIDEO_INGEST_URL="rtmp://localhost:1935/live"
VIDEO_HLS_URL="http://localhost:8888"
```

Genera la contraseña con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; no utilices el texto de ejemplo. Reinicia la web después de configurar. La API de control de MediaMTX permanece privada; el navegador solo recibe la URL HLS.

En **Emitir**, guarda el canal, crea una clave y copia el servidor y la clave completos a OBS → Emisión → Servicio personalizado. Usa H.264, audio AAC y fotogramas clave cada 2 segundos. Abre el canal para ver la señal; el reproductor usa HLS nativo o hls.js. No hay transcodificación ni selector multicalidad. El contador de espectadores únicos aún no está implementado.

Las claves aleatorias de 256 bits se almacenan como hash SHA256 en una tabla separada, se muestran una sola vez y nunca aparecen en el catálogo o las URLs públicas de reproducción. Solo el propietario puede renovarlas o revocarlas. Renovar cambia también la ruta pública y desconecta al emisor anterior; bloquear al creador elimina sus claves. Si MediaMTX está inaccesible, la credencial queda invalidada para nuevas conexiones y se informa que el corte de una conexión existente no pudo confirmarse. Detén OBS o reinicia el servidor en ese caso.

El catálogo confirma el directo en la API de MediaMTX cada 10 segundos; el reproductor consulta cada 3 segundos. `/api/health` distingue configuración presente de ausente, sin afirmar que el servidor esté conectado. Un fallo de conexión se refleja como `unavailable` en el catálogo y un error 503 en playback. Sin configuración de vídeo, cuentas, canales y chat siguen funcionando.

En el repositorio de streaming, `npm run test:local` verifica ambos proyectos con una SQLite temporal y una señal de ffmpeg real: emisión RTMP, decodificación HLS, permisos, renovación, revocación, bloqueo y caída del servidor. Requiere el build de producción de esta web y ffmpeg; no modifica tu base local.

## Preparación para uso público

**El backend y el vídeo están integrados.** El despliegue inicial está disponible en [cloudcraft.mx](https://cloudcraft.mx), con HTTPS y emisión RTMPS; usa Mi canal para obtener tu clave. Los ocho canales del seed están marcados como ejemplos, sin emisión y con cero espectadores; sus cuentas tienen contraseñas aleatorias descartadas, por lo que no son accesos de prueba públicos. Los clips no se simulan.

Para ampliar el despliegue inicial: transcodificación/CDN para escalar, WebRTC/WHIP, almacenamiento de avatares/banners/clips, integraciones y secretos cifrados, verificación de email, recuperación de contraseña, PostgreSQL y migraciones para producción, transporte de chat SSE/WebSockets, paginación para grandes catálogos, límites distribuidos, monitorización y copias de seguridad con restauración probada. No hay pagos ni proveedores externos conectados. No desplegar esta versión como una plataforma de streaming lista para producción.

`continuar.md` conserva los requisitos de fases posteriores. Los modelos y rutas de esta implementación están en `prisma/`, `lib/` y `app/api/[...path]/route.ts`.

## Recursos visuales

Las portadas y capturas de videojuegos provienen de los recursos públicos de Steam y pertenecen a sus respectivos titulares. Las fotografías de perfil son de Unsplash. Los archivos están en `public/images`. Las fuentes DM Sans y Barlow Condensed se solicitan a Google Fonts con fuentes locales de respaldo.

Prisma se mantiene en 6.16.2 para esta implementación. Los overrides de `effect` y `deepmerge-ts` actualizan dependencias de su CLI con avisos de seguridad; generación, migraciones y seed se comprueban con estos overrides.
