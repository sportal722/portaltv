# NEXORA

Plataforma de streaming en español con Next.js 15, React 19, TypeScript, Prisma/SQLite y MediaMTX. Identidad violeta y menta. **Tu mundo, en directo.**

## Estado del proyecto y roadmap

Actualizado el **22 de octubre de 2026**. Plataforma desplegada en [cloudcraft.mx](https://cloudcraft.mx), con backend y datos persistentes. La base funcional está disponible; las cuatro fases siguen abiertas y no se considera completada toda la hoja de ruta.

### Lo que ya tenemos

- [x] Identidad NEXORA, diseño adaptable y catálogo limpio: sin canales, cuentas ni imágenes de demo; estados vacíos reales.
- [x] Registro, inicio/cierre de sesión, cuentas de espectador/creador, 2FA TOTP con QR/códigos de recuperación, cambio de contraseña y gestión de sesiones con cierre remoto.
- [x] Emisión desde OBS por RTMPS, detección del estado real, reproducción HLS y claves privadas renovables/revocables.
- [x] Canales con dirección legible (`/channel/usuario`), canales adicionales numerados y compatibilidad con enlaces antiguos.
- [x] Reproductor con estados de carga/error/desconexión, reintentos limitados, conversión H.264/AAC y alternativa WebM VP9/Opus seleccionada según el navegador.
- [x] Panel del creador: título, categoría, actividad, etiquetas, idioma, descripción, portada HTTPS de respaldo, vista previa, claves OBS y equipo. Capturas automáticas del directo cada 10 segundos.
- [x] Chat público en tiempo real y chat privado del equipo, moderadores, borrado, sanciones temporales/permanentes, modo lento, solo seguidores y filtros de palabras/enlaces.
- [x] Comandos persistentes con permisos y tiempos de espera; alertas de seguidores personalizables con fuente privada para OBS.
- [x] Búsqueda, categorías, filtro de directos, seguir/dejar de seguir (sin auto-seguimiento) y conteos reales de seguidores, mensajes y moderadores.
- [x] Centro global con resumen real, usuarios/roles, moderadores globales y por canal, suspensión de canales, denuncias, auditoría, anuncios y apertura/cierre de registros.
- [x] HTTPS con Caddy, servicios de streaming separados de los paneles existentes, copias locales automáticas y comprobaciones de salud.
- [x] Pruebas de API, permisos, migraciones, conservación de datos, emisión y reproducción; pruebas específicas de vídeo, cuentas, roles y moderación global.

**Seguimiento operativo:** comprobar estabilidad sostenida desde OBS y capacidad con espectadores reales. La entrega procesada usa segmentos publicados atómicamente desde Caddy, independientes de las sesiones HLS de MediaMTX; la recuperación del reproductor no puede compensar una conexión de entrada que deja de enviar señal.

### Fase 1 — Fundamentos y lanzamiento controlado

La emisión, las cuentas básicas, el estudio y la moderación ya tienen una implementación funcional. Falta cerrar:

- [ ] Verificación de correo y recuperación de contraseña por email; 2FA y cierre remoto de sesiones ya disponibles.
- [x] Exportación privada y eliminación de cuenta con contraseña/2FA, revocación y protección del último administrador.
- [x] Notificaciones internas de directo, preferencias por canal, lectura y deduplicación de reconexiones.
- [ ] Bloqueo personal de usuarios, política integral de retención, correo y push.
- [ ] Apelaciones y soporte con permisos propios; denuncias/revisión y auditoría de las operaciones implementadas ya disponibles.
- [ ] Diagnóstico del reproductor, detección de señal congelada, objetivo de latencia y pruebas sostenidas en navegadores/móviles reales.
- [ ] Copias fuera del VPS, restauración completa probada y objetivos de recuperación RPO/RTO.
- [ ] Monitorización de recursos/errores con avisos, protección adicional frente a bots/ataques y pruebas de carga con límites de capacidad.
- [ ] Términos, privacidad, normas de comunidad, copyright y controles de edad/consentimiento aplicables.

### Fase 2 — Contenido, descubrimiento y comunidad

- [ ] Perfiles públicos completos, avatar/banner propios, carga de archivos y almacenamiento de objetos con cuotas.
- [ ] Recomendaciones, tendencias, páginas de categoría y descubrimiento de nuevos creadores más allá de la búsqueda/filtros actuales.
- [ ] VOD, clips, biblioteca, miniaturas propias, procesamiento en segundo plano, visibilidad y caducidad.
- [ ] Notificaciones de inicio de directo, menciones y preferencias; calendario, eventos y recordatorios.
- [ ] Emotes, menciones, historial de visualización, favoritos, mensajes privados con controles y moderación/antispam avanzados.
- [ ] Mejoras del reproductor: modo cine, PiP y atajos propios, subtítulos y controles de accesibilidad; selección de calidad cuando haya variantes reales.
- [ ] Centro de ayuda, reporte de problemas y solicitudes de funciones con votos y seguimiento público.

### Fase 3 — Escalabilidad, analítica e integraciones

- [ ] Separar ingestión, transcodificación y distribución; añadir calidad adaptativa, CDN, redundancia y escalado según carga.
- [ ] Migrar la arquitectura de datos/eventos cuando lo requiera la carga: PostgreSQL, colas, pubsub y caché distribuida.
- [ ] Espectadores simultáneos, minutos vistos, retención, histórico por emisión/periodo, gráficas, CSV y detección de tráfico artificial.
- [ ] API versionada para terceros, OAuth, tokens con permisos, webhooks firmados, cuotas, SDK e integraciones con bots.
- [ ] PWA, preferencias de idioma/tema/movimiento, accesibilidad ampliada y continuidad entre dispositivos; aplicaciones nativas en una etapa posterior.
- [ ] Pruebas de carga, costes por hora vista, despliegues graduales, reversión y observabilidad de aplicación/vídeo.

### Fase 4 — Monetización, ecosistema y funciones avanzadas

- [ ] Suscripciones, membresías, propinas, ingresos/retiros, comisiones y pagos con trazabilidad, conciliación, reembolsos y requisitos fiscales/de identidad.
- [ ] Puntos, recompensas, encuestas, metas de comunidad, emotes/insignias y eventos colaborativos.
- [ ] Invitados con vídeo/audio, emisiones conjuntas/privadas, formato vertical, pistas de audio/idioma y DVR cuando la infraestructura lo permita.
- [ ] Transcripción, subtítulos/traducción, propuestas de clips y asistencia de IA con revisión humana.
- [ ] Paneles por departamento, gestión global de infraestructura/costes, feature flags, soporte, incidentes y experimentos A/B.

### Límites actuales

HLS H.264/AAC hasta 720p y alternativa DASH/WebM VP9/Opus hasta 480p, un VPS y SQLite. Hay transcodificación de compatibilidad y capturas en vivo; todavía no hay escalera de calidad adaptativa, CDN, VOD/clips, pagos ni estadísticas históricas de audiencia. Las alertas cubren seguidores y eventos de prueba; las copias son locales. El chat usa SSE con consultas periódicas a SQLite y necesita pruebas de capacidad antes de ampliar el lanzamiento.

El [roadmap técnico](docs/ROADMAP.md) amplía dependencias y criterios de cierre. Cada función pendiente requiere implementación, permisos, pruebas y validación operativa antes de marcarse como terminada.

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
node scripts/test-playback-recovery.mjs
```

Detén el servidor de desarrollo antes de compilar: ambos usan `.next`. Las pruebas API crean bases SQLite y servidores aislados y los eliminan al terminar. No usan cuentas reales ni el servidor público. La prueba de migración comprueba relaciones y conservación de sesiones/claves/conversaciones.

## Direcciones de canales

El canal principal usa `/channel/usuario`, conservando guiones bajos del nombre y sin sufijos aleatorios. Los canales adicionales se numeran como `usuario--2`. Las direcciones antiguas siguen siendo alias y abren la dirección nueva; las claves OBS y fuentes de alertas existentes se conservan. El reproductor intenta recuperarse de errores de red tres veces (1, 2 y 4 segundos) y de un error de decodificación una vez; después ofrece reintento manual.

## Recorridos

- `/`: catálogo real, búsqueda por canal/título/juego/etiquetas/idioma, categorías, seguidos y filtro en directo. Las listas vacías se muestran sin contenido inventado.
- `/channel/[slug]`: enlace compartible, reproductor, seguimiento y chat ocultable.
- `/notifications`: avisos reales de inicio de directo, lectura y preferencias por canal.
- `/account/security`: exportar/eliminar la cuenta, configurar 2FA, guardar/renovar códigos de recuperación, cambiar contraseña y cerrar sesiones propias. Ver [seguridad y administración](docs/ACCOUNT-SECURITY.md).
- `/login`, `/register`: cuentas y sesiones. Un espectador puede activar sus herramientas de creador desde el estudio.
- `/studio`: crear/editar el canal, portada mediante URL HTTPS, vista previa, datos de seguidores/mensajes, conexión OBS, equipo, reglas, sanciones, comandos y alertas.
- `/moderation`: solo canales asignados, chat público y privado del equipo, borrado, sanciones y reglas.
- `/admin`: centro global de usuarios, roles, canales, equipos, denuncias, anuncios, registro, servicios y auditoría. Asignación inicial desde terminal autorizada: `npm run admin:promote -- --username nombre` o por email. Los siguientes cambios de rol exigen contraseña y 2FA si está activada.
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

Variables en `.env.example`: `DATABASE_URL`, `APP_URL`, `MEDIAMTX_API_URL`, `MEDIAMTX_API_PASSWORD`, `VIDEO_INGEST_URL`, `VIDEO_HLS_URL`, `VIDEO_MEDIA_URL`, `VIDEO_STATE_FILE`, `ACCOUNT_ENCRYPTION_KEY`. Nunca publiques `.env`, bases de datos, contraseñas ni certificados privados.

Producción actual: https://cloudcraft.mx. OBS: servicio personalizado, servidor `rtmps://cloudcraft.mx:1936/live`, clave completa generada en **Estudio → Emisión y OBS**. Vídeo H.264/yuv420p, audio AAC estéreo, intervalo de fotogramas clave de 2 segundos. No es necesario renovar una clave existente al actualizar la plataforma.

La emisión se valida mediante MediaMTX, con rutas por canal y secreto privado. El backend consulta el estado real; el callback solo autoriza. Renovar/revocar corta la conexión anterior. El worker normaliza vídeo/audio y genera HLS H.264/AAC, DASH/WebM VP9/Opus y capturas JPEG. Límite inicial de dos emisiones procesadas, con cuotas de CPU/memoria y limpieza de segmentos. No hay selector de calidad adaptativa, CDN ni grabación VOD. Consulta [la arquitectura, instalación y límites de vídeo](docs/VIDEO-PIPELINE.md).

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

## Administración y seguridad de cuentas

Los roles globales son espectador, creador, moderador y administrador. La moderación por canal se asigna por separado. Un moderador global puede revisar denuncias y moderar canales/cuentas ordinarias; no puede otorgar roles globales, cambiar configuración de plataforma ni acceder a claves OBS ajenas. Los cambios de rol revocan las sesiones del usuario afectado. No se permite cambiar el propio rol/estado ni retirar el último administrador activo.

Suspender un canal lo oculta, rechaza nuevas publicaciones, revoca su clave y retira sus salidas procesadas. Al reactivarlo, el creador deberá generar una clave nueva. Las denuncias guardan motivo, descripción, estado y resolución; las apelaciones aún no están implementadas. Los anuncios son texto y pueden ocultarse dejándolos vacíos.

2FA requiere una clave privada `ACCOUNT_ENCRYPTION_KEY` de 64 caracteres hexadecimales, conservada junto con las copias de recuperación. No se activa automáticamente para el usuario: debe escanear el QR y confirmar un código. No se guardan códigos de recuperación en claro y los secretos TOTP se cifran. La migración conserva las cookies existentes y elimina solo los seguimientos del propio creador y sus eventos asociados.

Pruebas adicionales: `node scripts/test-totp.mjs`, `node scripts/test-account-admin.mjs` y `node scripts/test-media-output.mjs`. El estado de implementación se refleja también en `/roadmap`.

Privacidad y avisos: [alcance, retención y API](docs/ACCOUNT-DATA-NOTIFICATIONS.md). Pruebas: `node scripts/test-account-data.mjs`.
