# Prompt para continuar el proyecto NEXORA

ActÃºa como Senior Full-Stack Engineer y continÃºa este proyecto directamente en los archivos existentes. No empieces desde cero ni reemplaces trabajo Ãºtil.

## Contexto

NEXORA es una plataforma de streaming gaming con estÃ©tica oscura premium, violeta elÃ©ctrico, cian neÃ³n y acentos coral. El frontend estÃ¡ construido con:

- Next.js 15 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Lucide React.
- Prisma 6.16.2.
- SQLite como base de datos local.

El proyecto estÃ¡ en `C:\Users\isaac\Desktop\streamapp`.

## Lo que ya existe

### Frontend

Rutas implementadas:

- `/`
- `/explore`
- `/following`
- `/clips`
- `/live/[slug]`
- `/channel/[slug]`
- `/dashboard`
- `/admin`

El frontend incluye navegaciÃ³n responsive, bÃºsqueda, filtros, tarjetas de streams, clips con modal, chat local, panel de creador, panel administrativo, estados vacÃ­os y diseÃ±o mÃ³vil.

Los datos visuales de la demo estÃ¡n en:

- `lib/mock-data.ts`
- `lib/types.ts`

### Backend

Existe un esquema Prisma en `prisma/schema.prisma` con estos modelos:

- `User`
- `Stream`
- `Follow`
- `ChatMessage`
- `Clip`
- `Report`

Existe el cliente Prisma en:

- `lib/prisma.ts`

Helpers de respuestas:

- `lib/api.ts`

Route Handlers creados:

- `GET /api/health`
- `GET|POST /api/streams`
- `GET|PATCH /api/streams/[slug]`
- `GET|POST|DELETE /api/follows`
- `GET|POST /api/streams/[slug]/chat`
- `GET /api/clips`
- `GET|PATCH /api/admin/users`

El seed estÃ¡ en:

- `prisma/seed.ts`

Comandos configurados en `package.json`:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:setup
```

## Estado de verificaciÃ³n

`npm run build` pasa correctamente y genera las pÃ¡ginas y APIs.

La inicializaciÃ³n SQLite mediante `npm run db:setup` todavÃ­a falla en este entorno Windows con un error genÃ©rico del Prisma Schema Engine al ejecutar `prisma db push`. Investiga esto antes de modificar el esquema. No afirmes que la base estÃ¡ funcionando hasta comprobarlo realmente.

El cliente Prisma se genera correctamente con `npm run db:generate`.

## Tareas pendientes prioritarias

### 1. Resolver la base de datos local

Investiga el error de `prisma db push` en Windows:

```text
Error: Schema engine error:
```

Comprueba:

- `npx prisma -v`.
- Que `DATABASE_URL="file:./dev.db"` exista en `.env`.
- Que los binarios de Prisma estÃ©n instalados correctamente.
- Si el problema estÃ¡ relacionado con la versiÃ³n de Node, Prisma o los binarios Windows.
- Si conviene fijar una versiÃ³n estable concreta de Prisma.

DespuÃ©s ejecuta:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Verifica que exista `prisma/dev.db` y que las consultas funcionen.

### 2. Conectar el frontend con las APIs

Actualmente buena parte del frontend sigue utilizando `lib/mock-data.ts` directamente. Sustituye gradualmente esos datos por llamadas a las APIs sin romper la experiencia visual.

Prioridad:

1. `/explore` y la pÃ¡gina de inicio deben cargar streams desde `GET /api/streams`.
2. `/live/[slug]` debe cargar el stream y mensajes desde la API.
3. El chat debe enviar mensajes con `POST /api/streams/[slug]/chat`.
4. Seguir/dejar de seguir debe usar `/api/follows` y dejar de depender solo de `localStorage`.
5. `/clips` debe cargar datos desde `GET /api/clips`.
6. `/admin` debe consultar y actualizar usuarios mediante `/api/admin/users`.

MantÃ©n estados de carga, errores y estados vacÃ­os comprensibles.

### 3. AÃ±adir validaciÃ³n y errores

AÃ±ade validaciÃ³n de payloads para las Route Handlers. Puedes usar una librerÃ­a ligera si es realmente necesaria, pero evita dependencias innecesarias.

Debe validarse como mÃ­nimo:

- Longitud y formato de tÃ­tulos.
- CategorÃ­as permitidas.
- Slugs vÃ¡lidos.
- Mensajes de chat entre 1 y 300 caracteres.
- Estados de usuario vÃ¡lidos.
- Campos obligatorios en creaciÃ³n y actualizaciÃ³n de streams.

Devuelve errores JSON consistentes con cÃ³digos HTTP apropiados.

### 4. AutenticaciÃ³n y autorizaciÃ³n

La aplicaciÃ³n todavÃ­a usa `demo-user` y no tiene autenticaciÃ³n real. Prepara una arquitectura clara para incorporar autenticaciÃ³n despuÃ©s.

Antes de producciÃ³n habrÃ¡ que:

- Sustituir `NEXORA_DEMO_USER_ID` por una sesiÃ³n real.
- Proteger follows y chat.
- Proteger endpoints administrativos.
- Validar roles `viewer`, `creator`, `moderator` y `admin`.
- Evitar que un usuario cambie estados administrativos sin autorizaciÃ³n.

No simules que la autenticaciÃ³n ya estÃ¡ conectada.

### 5. Streaming real

No implementes RTMP real todavÃ­a salvo que sea necesario preparar interfaces. DiseÃ±a una capa separada para integrar posteriormente:

- Ingesta RTMP o WHIP.
- Playback HLS o DASH.
- Estado de emisiÃ³n.
- Clave privada de transmisiÃ³n.
- Heartbeats y actualizaciÃ³n de espectadores.

Nunca expongas claves de stream al frontend pÃºblico.

### 6. Chat en tiempo real

El chat actual es HTTP y persistente en SQLite. Para la siguiente fase, prepara una abstracciÃ³n que permita migrar a WebSockets o SSE con:

- ModeraciÃ³n.
- Rate limiting.
- Borrado de mensajes.
- Silenciar usuarios.
- Lista de palabras bloqueadas.

No introduzcas WebSockets si no puedes probarlos localmente.

### 7. Calidad y seguridad

Revisa todo el proyecto y corrige:

- Imports no utilizados.
- Tipos dÃ©biles o `any` innecesarios.
- Rutas que no gestionan errores.
- Falta de accesibilidad.
- Problemas de responsive design.
- Uso inseguro de datos provenientes de requests.
- Falta de Ã­ndices o relaciones Prisma.
- ExposiciÃ³n de datos privados.

Ejecuta al final:

```bash
npm run build
npx tsc --noEmit
```

No afirmes que una prueba pasÃ³ si realmente no se pudo ejecutar.

## Restricciones importantes

- No borres ni rehagas el frontend sin motivo.
- MantÃ©n la identidad visual NEXORA.
- No aÃ±adas servicios de pago.
- No introduzcas Supabase, Firebase ni servicios externos sin justificarlo.
- No implementes pagos, suscripciones o publicidad todavÃ­a.
- No uses datos falsos para afirmar que hay streaming real.
- MantÃ©n los secretos fuera del repositorio.
- Actualiza `README.md` con cada cambio importante.
- Si una limitaciÃ³n del entorno impide probar algo, documenta exactamente el error.

## Resultado esperado

Deja una aplicaciÃ³n full-stack local en la que:

1. La base de datos se pueda crear con un comando.
2. El seed cargue streams, usuarios, follows y mensajes.
3. Las pÃ¡ginas principales consuman el backend.
4. Chat, follows y administraciÃ³n persistan localmente.
5. El proyecto compile sin errores de TypeScript.
6. README y documentaciÃ³n expliquen claramente quÃ© estÃ¡ conectado y quÃ© sigue siendo una simulaciÃ³n.

Empieza inspeccionando los archivos actuales y continÃºa desde el estado existente.


## Nuevos requisitos imprescindibles

Antes de considerar el proyecto listo para uso real, implementa también lo siguiente.

### Registro e inicio de sesión

- Crear /register y /login con diseño coherente con NEXORA.
- Permitir registro de espectadores y creadores.
- Validar email, nombre de usuario y contraseña en el servidor.
- Hashear contraseñas con Argon2id o scrypt. Nunca guardar contraseñas en texto plano.
- Crear sesiones persistentes mediante cookie HttpOnly, Secure en producción, SameSite=Lax, expiración y revocación.
- Crear /api/auth/register, /api/auth/login, /api/auth/logout y /api/auth/me.
- Mostrar el usuario autenticado en la barra superior y añadir cierre de sesión.
- Proteger dashboard, configuración de creador y endpoints administrativos.
- No usar demo-user como identidad real cuando exista una sesión.
- Añadir recuperación de contraseña y verificación de email como fase posterior si todavía no hay proveedor de correo.

### Área privada del creador

Amplía /dashboard o crea /creator/settings con:

- Perfil del creador, descripción, avatar y banner.
- Título y categoría por defecto.
- Estado de conexión del servidor de streaming.
- Instrucciones claras para OBS.
- URL RTMP o WHIP del servidor.
- Clave de stream regenerable.
- Estado de conexión y última comprobación.
- Botones para revocar y regenerar credenciales.
- Aviso visible de que una clave revocada deja de funcionar inmediatamente.

### Claves de APIs y secretos

Crear una sección privada para configurar integraciones como proveedor de vídeo, almacenamiento de clips, CDN, email transaccional y moderación.

Reglas obligatorias:

- Nunca devolver claves completas al navegador después de guardarlas.
- Mostrar únicamente los últimos cuatro caracteres y la fecha de actualización.
- Cifrar los valores en el servidor con una clave maestra de entorno.
- No imprimir secretos en logs.
- No guardar secretos en localStorage.
- Añadir guardar, probar conexión, reemplazar y eliminar.
- Permitir acceso solo al propietario o a un administrador autorizado.
- Separar claves públicas de privadas.
- Documentar rotación y revocación.

Variables previstas para producción:

    DATABASE_URL="postgresql://..."
    AUTH_ENCRYPTION_KEY="generar-un-secreto-largo-y-aleatorio"
    SESSION_SECRET="generar-otro-secreto-largo-y-aleatorio"
    APP_URL="https://tudominio.com"
    STORAGE_ENDPOINT="..."
    STORAGE_ACCESS_KEY="..."
    STORAGE_SECRET_KEY="..."
    VIDEO_PROVIDER_API_KEY="..."
    SMTP_HOST="..."
    SMTP_USER="..."
    SMTP_PASSWORD="..."

No incluir valores reales en Git, README, capturas ni respuestas de API.

## Cómo llevar NEXORA a producción

Cuando el backend local esté probado, sigue este orden:

1. Configurar un dominio y activar HTTPS.
2. Desplegar Next.js en Vercel, Railway, Fly.io o un servidor Node propio.
3. Sustituir SQLite por PostgreSQL administrado. SQLite debe quedarse para desarrollo o demos pequeñas.
4. Configurar DATABASE_URL en las variables privadas del proveedor.
5. Ejecutar migraciones versionadas con prisma migrate deploy; no usar prisma db push como estrategia de producción.
6. Configurar las claves de entorno desde el panel de secretos del proveedor.
7. Configurar almacenamiento de objetos para avatares, banners, thumbnails y clips.
8. Integrar un proveedor de streaming con RTMP/WHIP para ingestión y HLS/DASH para reproducción.
9. Mantener claves RTMP y API exclusivamente en servidor.
10. Usar Redis o equivalente para rate limiting, sesiones efímeras, presencia y colas.
11. Migrar el chat a WebSockets o SSE con autenticación, moderación y límites.
12. Configurar backups automáticos de PostgreSQL y probar restauraciones.
13. Añadir monitorización de errores, logs sin secretos, métricas y alertas.
14. Configurar privacidad, cookies, términos de uso, moderación y eliminación de cuentas.
15. Probar registro, login, permisos, archivos, chat, follows, claves y administración antes de abrir el sitio.

### Criterio de listo para uso real

No marques el proyecto como producción hasta comprobar:

- Registro, login y logout funcionan.
- Un usuario no puede acceder a datos privados de otro.
- Un creador puede guardar y revocar credenciales sin exponerlas.
- La administración respeta roles.
- Contraseñas, cookies y claves están protegidas.
- Hay backups y migraciones reproducibles.
- OBS llega al reproductor mediante streaming real.
- El chat tiene autenticación, moderación y rate limiting.
- npm run build y npx tsc --noEmit pasan.
- El despliegue se ha probado en un entorno similar a producción.

No afirmes que la web está lista para usuarios reales mientras falte cualquiera de estos puntos.

