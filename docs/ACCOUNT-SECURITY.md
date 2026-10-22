# Seguridad de cuentas y administración

## Para cada usuario

`/account/security` permite listar sesiones, cerrar una concreta o todas las demás, cambiar contraseña y configurar 2FA. Las sesiones se identifican por un ID independiente; nunca se devuelve su token/hash. La descripción del navegador procede de User-Agent, no prueba la identidad de un dispositivo. La fecha de las sesiones anteriores a la migración corresponde a la actualización.

Configurar 2FA exige la contraseña actual, escanear el QR o introducir la clave en un autenticador y confirmar un código antes de 10 minutos. Activarlo cierra las demás sesiones. TOTP usa SHA-1/6 dígitos/30 s con tolerancia de un intervalo y rechazo de códigos ya usados. Los diez códigos de recuperación son de un solo uso; solo se muestran al generarlos. Renovarlos invalida todos los anteriores. Cambiar contraseña o desactivar 2FA requiere contraseña y segundo factor si está activo; se cierran las demás sesiones.

El cambio de contraseña dentro de una sesión está disponible. **La recuperación por correo y verificación del email siguen pendientes de un servicio de envío configurado.**

## Configuración privada

Generar una clave de 32 bytes aleatorios y guardar su representación hexadecimal (64 caracteres) en `ACCOUNT_ENCRYPTION_KEY` del entorno web. Los secretos TOTP se cifran con AES-256-GCM y se vinculan al ID de la cuenta. Los códigos de recuperación se guardan como hashes SHA-256. No cambiar/perder la clave de cifrado: impediría verificar los autenticadores existentes. Incluirla en copias privadas de configuración y en el ensayo de restauración; nunca en Git, imágenes de contenedor, logs o entregables públicos.

No hay claves de autenticador predeterminadas ni contraseñas de administrador de demostración.

## Roles globales

| Permiso | Administrador | Moderador global | Moderador de canal |
| --- | --- | --- | --- |
| Resumen y auditoría global | Sí | Sí | No |
| Revisar denuncias y resolverlas | Sí | Sí | No |
| Moderar cuentas y suspender canales ordinarios | Sí | Sí | Solo chat de sus canales |
| Actuar sobre cuentas/canales del equipo global | Sí | No | No |
| Asignar roles globales | Sí, contraseña y 2FA si está activa | No | No |
| Asignar moderadores desde el panel global | Sí | No | No |
| Configurar registro y anuncios | Sí | No | No |
| Ver claves OBS, alertas privadas o contraseña de otro usuario | No | No | No |

El propietario conserva la gestión del equipo de su canal. Se consulta el rol actual en backend y durante SSE. Un cambio de rol global cierra las sesiones del usuario afectado. No se permite cambiar el propio rol/estado ni retirar el último administrador activo. Activar 2FA en todas las cuentas del equipo es recomendable; esta versión no impone una política obligatoria global.

Primera administración, solo desde una terminal autorizada:

```bash
npm run admin:promote -- --username nombre_existente
```

También admite el email como único argumento. La cuenta debe existir y estar activa. La asignación se audita y no cambia su contraseña, claves OBS ni sesiones. Las siguientes asignaciones se hacen desde `/admin`.

## Operaciones del panel

- **Resumen:** cuentas, canales, emisiones, seguimientos, denuncias pendientes, equipo con 2FA y estado de vídeo/worker. No representa espectadores simultáneos ni métricas históricas.
- **Usuarios:** búsqueda/paginación, estado y rol. Suspender revoca sesiones y claves de emisión. Un moderador no puede promover cuentas ni sancionar a administradores/moderadores globales.
- **Canales:** búsqueda/paginación, suspensión/reactivación y equipo. Suspender oculta el canal y revoca la clave; al reactivarlo hay que generar una nueva. Los mensajes y el canal no se borran.
- **Denuncias:** usuarios autenticados pueden reportar un canal; máximo cinco por hora y una pendiente por usuario/canal. El equipo registra revisión, resolución o descarte. No hay decisiones automáticas ni apelaciones aún.
- **Configuración:** abrir/cerrar nuevas altas y publicar un anuncio de texto. Cerrar el registro no bloquea accesos existentes.
- **Auditoría:** últimas 100 acciones, incluyendo cambios de rol/estado, suspensiones, equipos, resolución de denuncias, configuración y operaciones de seguridad de cuentas. Retención/exportación avanzada pendientes.

La migración conserva datos/credenciales/sesiones y elimina seguimientos del propio creador y sus eventos de alerta. El auto-seguimiento se rechaza antes de crear una relación o alerta; la interfaz muestra «Tu canal».
