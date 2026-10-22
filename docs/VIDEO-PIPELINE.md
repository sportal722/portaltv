# Vídeo compatible y miniaturas del directo

## Recorrido

OBS → RTMPS/MediaMTX → RTSP TCP interno → worker FFmpeg → archivos de ventana móvil → Caddy HTTPS → navegador.

El worker consulta `/api/video/jobs` cada dos segundos con un token privado. Solo recibe rutas de claves vigentes de cuentas habilitadas que realmente están emitiendo. No recibe claves OBS ni contraseñas de usuarios. La lectura RTSP requiere autenticación y escucha únicamente en loopback.

Por cada emisión se abre **un proceso FFmpeg** que comparte la decodificación de entrada:

| Salida | Formato y límites |
| --- | --- |
| Principal | HLS MPEG-TS, H.264 Main/yuv420p, hasta 1280×720 a 30 fps, 2,4 Mbps objetivo/2,8 Mbps máximo; AAC estéreo 48 kHz/128 kbps |
| Compatibilidad | DASH/WebM, VP9 hasta 854×480 a 24 fps, objetivo 900 kbps; Opus estéreo 48 kHz/96 kbps |
| Miniatura | JPEG hasta 480×270 cada 10 s; publicación atómica; la portada consulta el catálogo cada 10 s |

Se conserva la proporción del vídeo y no se aumenta una resolución pequeña. Las fuentes sin audio funcionan. Se prueban H.264 y HEVC, incluido audio AAC multicanal; la aceptación de otros códecs depende de MediaMTX y de los decodificadores FFmpeg instalados. No se garantiza cualquier formato ni navegadores obsoletos. El navegador elige HLS cuando admite H.264/AAC y usa WebM cuando no los admite. Ambos se preparan una vez por emisión, independientemente de sus espectadores. No son una escalera ABR ni un selector manual de calidad.

## Recursos y funcionamiento

- Límite inicial: **dos emisiones procesadas simultáneamente**, cuota agregada de 3 CPU, 3 GiB de RAM y 256 procesos/hilos. Las emisiones adicionales esperan y la API comunica `capacity`.
- Web: cuota de 1,5 CPU, manteniendo el límite de memoria existente. No se alteran servicios Pterodactyl ni parámetros globales del kernel.
- No se presupone GPU: el dedicado expone solamente el dispositivo gráfico AST; no hay nodo Intel de render disponible para FFmpeg.
- Segmentos de 2 s, ventana de ocho segmentos más un margen pequeño para clientes retrasados. Los segmentos antiguos se eliminan; no se graba un VOD.
- Reinicio del codificador si sale o deja de actualizar HLS durante 30 s, con espera creciente hasta 30 s. Los identificadores de generación evitan mezclar segmentos antes/después de una reconexión.
- Si desaparece una ruta autorizada se termina el proceso y se retiran sus archivos. Si falla la API, hay 15 s de tolerancia y después se retiran los trabajos. El estado del worker caduca en la web tras 15 s.
- Las capturas caducan a los 30 s. Al desconectarse el canal se vuelve a la portada personalizada o al estado vacío. Nunca se conserva una captura vieja como si fuera un directo actual.
- Caddy sirve exclusivamente los nombres/extensiones previstos desde `public/`. No publica el estado interno, archivos temporales ni directorios. Manifiestos sin caché; segmentos con caché de 30 s y JPEG con 5 s.

## Instalación sobre el despliegue existente

1. Construir la web y el worker desde la misma revisión; conservar imágenes/configuración anteriores y copia consistente de SQLite.
2. Crear `/srv/nexora/media` con propietario 1000:1000 y permisos 755. Montarlo en lectura para la web y lectura/escritura para el worker.
3. Crear `/opt/nexora/config/worker.env` con permisos 600 y solo `MEDIAMTX_API_PASSWORD`, obtenido de la configuración privada existente; no incluirlo en Git ni en logs.
4. Combinar `deploy/video-worker.compose.yaml` con Compose y usar una etiqueta de imagen por revisión en producción. La configuración de la web añade `VIDEO_MEDIA_URL` y `VIDEO_STATE_FILE`.
5. Habilitar RTSP TCP en MediaMTX: `rtsp: true`, `rtspAddress: 127.0.0.1:8554`, `rtspTransports: [tcp]`. Guardar la configuración y aplicar mediante su API autenticada; comprobar que la conexión RTMPS existente no se reinicia.
6. Importar `deploy/video.caddy` dentro del sitio de la plataforma, antes del destino web. Validar Caddy antes de recargar.
7. Arrancar únicamente web/worker. Comprobar `/api/health`, salud del worker, salida real HLS/WebM, capturas y permisos. No abrir el puerto 8554 a Internet.

No ejecutar `docker compose down` para actualizar la web. Para revertir: desactivar el worker y retirar sus variables/montaje de la web, restaurar imagen web/configuración Caddy anterior; la ruta HLS original sigue disponible como mecanismo de reversión. Las claves y la base de datos no cambian con esta entrega.

## Verificación y capacidad

```bash
npm run build
npm run test:api
npm run test:community
node scripts/test-playback-recovery.mjs
MEDIAMTX_BINARY=/ruta/a/mediamtx python3 scripts/test-video-worker.py
```

La prueba utiliza cuentas, base y puertos aislados: HEVC/5.1, conversión, decodificación de ambas salidas, cambios reales de JPEG, autenticación del worker, revocación, espera por capacidad, vídeo sin audio y limpieza. FFmpeg 8 puede emitir `Error parsing Opus packet header` al abrir DASH/WebM y finalizar correctamente; comprobar también reproducción real con dash.js, sin asumir que un código de salida cero demuestra ausencia de avisos.

Medición del dedicado (22/10/2026, Xeon E-2274G, 4 núcleos/8 hilos, 32 GiB): dos entradas sintéticas de 720p y 1080p, 25,2 s de prueba, 45,1 s de CPU total (~1,79 núcleos), máximo registrado de un proceso hijo ~251 MiB, generación de ambas salidas y miniaturas sin errores bajo cuota de 3 CPU. Es una muestra de procesamiento, no una prueba de carga de espectadores ni una garantía para cualquier contenido. Cada espectador consume aproximadamente el bitrate de la salida elegida; CDN, ABR, rendimiento sostenido y escalado siguen pendientes.
