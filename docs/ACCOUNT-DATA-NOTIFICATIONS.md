# Datos personales y avisos de directo

## Exportación y eliminación

Desde `/account/security`, ambas operaciones requieren sesión propia, contraseña y segundo factor si está activado. El cliente no puede elegir el usuario objetivo. La eliminación requiere además escribir el nombre exacto y aceptar una confirmación. El último administrador activo no puede eliminarse hasta asignar otro.

- `POST /api/account/export`: cuerpo `{password, code?}`. Devuelve JSON con cuenta, canales, mensajes propios (incluido chat privado escrito por el usuario), seguimientos, sesiones sin tokens, pertenencia a equipos, sanciones, reglas/comandos/alertas propias, notificaciones y denuncias enviadas. No incluye contraseñas/hashes, claves OBS, tokens de alertas, secretos 2FA, ni conversaciones ajenas. Límite de 10 000 filas por sección: si se supera devuelve 413 sin entregar una exportación incompleta; administración debe preparar la copia completa. Los documentos pueden contener datos personales: el usuario debe guardarlos en privado.
- `DELETE /api/account/delete`: cuerpo `{password, code?, confirmation: username}`. Borra la cuenta, sus canales y relaciones por cascada, mensajes propios, sesiones, credenciales, avisos/estados de directo, reportes propios o de sus canales y eventos de seguimiento por nombre. Conserva las acciones de auditoría desvinculadas del canal, con actor anonimizado y sustitución de identificadores conocidos en el objetivo. Registra la eliminación sin identificar al usuario. La emisión activa se desconecta después de confirmar la transacción; si el servidor de vídeo no responde, las credenciales ya están revocadas y el worker retira sus salidas en el siguiente sondeo.

La eliminación actúa sobre la base operativa. Las copias del servidor pueden seguir conteniendo datos: las copias diarias conservan las últimas 14, mientras que las copias manuales previas a despliegues requieren retirada administrativa. Los textos escritos por otras personas pueden contener menciones o datos personales que no se detectan automáticamente. Una restauración debe reaplicar las solicitudes de eliminación antes de reabrir el servicio; ese procedimiento y la retención legal integral siguen pendientes. No se afirma cumplimiento legal completo.

## Notificaciones

`/notifications` muestra avisos reales de inicio, lectura y preferencias por canal seguido. No envía correo ni push. Los seguimientos existentes y nuevos reciben avisos internos por defecto; pueden silenciarse sin dejar de seguir. Solo se avisa a seguidores activos presentes al iniciar; seguir un canal ya en directo no crea un aviso retroactivo.

La integración actual requiere el worker de vídeo: su sondeo privado consulta MediaMTX y registra canales autorizados en directo. Se conserva el último avistamiento cada 10 segundos. Un intervalo de más de 60 segundos desde el último avistamiento abre una nueva emisión; reconexiones breves y rotaciones de clave no generan otro aviso. Al estrenar esta función se avisa una vez de los canales ya activos. Tras una indisponibilidad prolongada del sondeo puede aparecer un nuevo aviso aunque el emisor siguiera conectado. No equivale a un registro histórico preciso de emisiones.

La creación del estado y avisos ocurre en una transacción con unicidad por usuario/canal/inicio. Si falla, se revierte y reintenta en el siguiente sondeo sin bloquear la entrega de vídeo. Las inserciones se agrupan para los límites de SQLite; todavía falta validar la distribución masiva con muchos seguidores.

La bandeja consulta los últimos 30 días. Los avisos anteriores se purgan durante el siguiente sondeo con canales activos; no es una garantía de borrado a la hora exacta. Se ocultan avisos de canales suspendidos o propietarios suspendidos. El borrado de usuario/canal elimina sus avisos.

- `GET /api/notifications?before=ID`: hasta 50 avisos, contador sin leer y cursor `next`.
- `POST /api/notifications/read`: `{through: ID}` marca solo avisos propios hasta ese ID; no marca avisos nuevos que llegaron después de cargar la página.
- `GET /api/notifications/preferences?after=STREAM_ID`: hasta 50 canales seguidos y cursor `next`.
- `PATCH /api/notifications/preferences`: `{streamId, notifyLive: boolean}`, siempre sobre un seguimiento propio.

La página se actualiza cada 15 segundos mientras es visible. Los nombres/títulos se presentan como texto, sin HTML proporcionado por usuarios.
