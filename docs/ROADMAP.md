# Hoja de ruta de NEXORA

Esta primera entrega limpia la demo y construye herramientas operativas para creadores y equipos. No equivale a completar las 28 áreas ni a una certificación de preparación para lanzamiento masivo.

## Entrega actual

- [x] Catálogo y recursos sin canales, identidades o imágenes de muestra; seed vacío.
- [x] Migración que conserva cuentas reales, sesiones, conversaciones, seguidores y claves OBS.
- [x] Estudio separado del panel global, con edición de título, categoría/actividad, etiquetas, idioma, descripción y miniatura HTTPS con vista previa.
- [x] Estado real de emisión y administración privada de clave RTMPS.
- [x] Seguidores, actividad reciente, mensajes conservados y equipo desde la base de datos.
- [x] Roles por canal aplicados en backend; retirada de acceso durante SSE.
- [x] Chat público y chat privado de moderadores, reconexión SSE y borrado autorizado.
- [x] Modo lento, solo seguidores, filtros, sanciones temporales/permanentes y registro de acciones.
- [x] Comandos persistentes, espera compartida, plantilla de usuario y permisos del equipo.
- [x] Alertas de seguidores configurables y fuente OBS con URL privada renovable/revocable, pruebas y deduplicación.
- [x] Centro global: usuarios/roles, equipos, suspensión de canales, denuncias/resoluciones, ajustes de registro/anuncios y auditoría.
- [x] 2FA TOTP con QR, secretos cifrados y códigos de recuperación de un uso; sesiones con cierre remoto y cambio de contraseña.
- [x] Exportación propia sin credenciales y eliminación con reautenticación, cascadas, auditoría anonimizada y protección del último administrador.
- [x] Bandeja de avisos de directo, preferencias por canal, lectura, paginación y deduplicación de reconexiones.
- [x] Auto-seguimiento prohibido en API/interfaz y limpieza de los registros propios existentes.
- [x] Pruebas de autenticación, permisos, migración y persistencia.
- [x] Conversión de compatibilidad a H.264/AAC y WebM VP9/Opus; selección por capacidad del navegador, reintentos y capturas reales cada 10 s.
- [x] Procesamiento compartido por emisión, cuotas de recursos y entrega estática de segmentos con Caddy. Ver [límites y pruebas](VIDEO-PIPELINE.md).

## Fase siguiente: seguridad y lanzamiento controlado (P0)

1. Servicio de correo real: verificación, recuperación, límites, tokens de un solo uso y revocación. Elegir proveedor/dominio remitente; nunca simular envíos exitosos.
2. Ampliar protección del equipo: 2FA, códigos de recuperación y gestión de sesiones ya disponibles; quedan políticas de 2FA obligatoria por organización y alertas de accesos.
3. Ampliar privacidad, bloqueos personales y retención. Exportación/eliminación propia ya disponibles. Acordar términos, normas de comunidad y procedimiento de copyright con datos legales reales.
4. Apelaciones y soporte con permisos específicos; ampliar auditoría a futuras operaciones. Ya existen denuncias/revisión y registro de las acciones de cuenta/administración implementadas.
5. Copias fuera del VPS y restauración de prueba; objetivos RPO/RTO, monitorización de capacidad y notificación de incidentes.
6. Ampliar diagnóstico del reproductor y recuperación ya implementada; realizar pruebas sostenidas en navegadores y dispositivos con H.264/AAC. Definir objetivo de latencia y detección de señal congelada.
7. Pruebas de carga/abuso y límites de concurrencia en chat, cuentas e ingestión. El polling SQLite/SSE actual es una base para una comunidad pequeña, no una garantía de escala.

## Fase 2: contenido y comunidad (P1)

- Perfiles/avatar/banner propios y almacenamiento de objetos con cuotas y validación de archivos.
- Emisiones históricas, métricas de espectadores/minutos vistos y estadísticas por periodo. Separar sesiones de reproducción de personas únicas.
- Correo/push de directo, calendario y recordatorios. Las notificaciones internas configurables ya están disponibles.
- VOD/clips: almacenamiento, worker de procesado, política de caducidad, visibilidad y derechos.
- Chat con emotes, menciones, informes, filtros más avanzados y canal de reportes del reproductor.
- Calidad de reproducción automática/manual solo cuando existan variantes reales; PiP, atajos, subtítulos y controles accesibles.
- Centro de ayuda, solicitudes de funciones, votos y seguimiento público.

## Fase 3: crecimiento (P2–P3)

- Separar ingestión, transcodificación y distribución. Añadir variantes HLS, CDN, almacenamiento y colas de trabajo.
- Medir coste por hora vista y capacidad antes de habilitar más canales. Elegir proveedores según presupuesto y audiencia real.
- PostgreSQL para datos; broker/pubsub para eventos distribuidos y caché. Evitar acoplar las APIs de canal a un único servidor MediaMTX.
- API versionada, OAuth, webhooks con firmas/reintentos y cuotas; integraciones con bots.
- Analítica agregada, CSV, comparativas y detección de tráfico artificial.
- PWA, preferencias de idioma/tema/movimiento y compatibilidad extendida.

## Fase 4: negocio y funciones avanzadas (P2–P4)

- Pagos/suscripciones/propinas mediante proveedor autorizado: libro de movimientos inmutable, conciliación, reembolsos, KYC/fiscalidad aplicable. Requiere decisiones comerciales y legales.
- Puntos/recompensas, eventos, colaboración, invitados, emisiones privadas y pistas adicionales.
- Subtítulos/transcripciones/traducción y propuestas asistidas por IA con revisión humana.
- Paneles de soporte/departamentos, feature flags, costes, incidentes y experimentos de producto.

## Límites actuales y decisiones

- Conversión HLS hasta 720p y WebM hasta 480p para compatibilidad; no hay escalera ABR, selector manual de resolución ni CDN. Límite inicial de dos emisiones procesadas; aún falta carga sostenida de espectadores.
- Un solo VPS y SQLite; sigue siendo un punto único de fallo. Los servicios Pterodactyl existentes permanecen separados de la aplicación, pero comparten máquina.
- No se anuncian recuperación por correo, VOD, monetización, estadísticas históricas ni soporte de gran escala como terminados.
- Miniaturas por URL pública HTTPS; los navegadores contactan con el servidor de imágenes elegido por el creador. La carga propia y el proxy seguro de imágenes se implementarán con el almacenamiento de objetos.
- Mensajes y auditoría persisten; definir retención y exportación antes de ampliar el lanzamiento.
- Las alertas actuales cubren seguimiento y pruebas. Suscripciones/propinas se conectarán solo después de implementar esos eventos reales.
- Categoría, actividad, etiquetas e idioma son campos diferentes. No se crean categorías, creadores o métricas inventadas.

## Criterio de cierre por fase

Cada fase debe tener migraciones, permisos en backend, estados vacíos/error, pruebas de regresión y límites documentados. Los cambios externos de pagos, correo/CDN y requisitos legales necesitan configuración concreta; una pantalla vacía no cuenta como una función terminada.
