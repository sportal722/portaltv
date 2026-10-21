# NEXORA

Prototipo de una plataforma de streaming en español con identidad propia: fondo oscuro, violeta eléctrico, cian y coral. Lema: **Tu mundo, en directo.**

## Ejecutar

Requiere Node.js 20.9 o posterior y npm.

```bash
npm ci
npm run dev
```

Abrir http://localhost:3000. Para producción local: `npm run build` y `npm start`.

## Implementado

- Next.js 15, React 19 y TypeScript; interfaz adaptable a móvil y escritorio.
- Logo SVG, favicon, metadatos y estilos de marca.
- Descubrimiento, búsqueda por canal/juego/título, filtros y categorías.
- Canales favoritos persistidos en localStorage, carrusel y notificaciones.
- Perfil local, borrador de creador y chat de demostración.
- Ventanas con cierre por Escape, navegación con teclado y reducción de movimiento.

## Alcance de la demo

Los canales, cifras, clips y mensajes iniciales son ejemplos. La vista de canal muestra una imagen y un aviso; **no reproduce una emisión real**. Clips abre esa misma vista previa, sin vídeo. El perfil local no es registro ni autenticación. No hay backend, base de datos, RTMP, pagos ni servicios de terceros conectados. Los favoritos y borradores se guardan solo en este navegador; el chat se conserva durante la visita.

`continuar.md` conserva el contexto y los requisitos del proyecto anterior. Ese código no está presente en este repositorio; las tareas de backend y producción descritas allí quedan pendientes.

## Verificar

```bash
npm run build
npm run typecheck
npm audit
```

## Recursos visuales

Las portadas y capturas de los videojuegos provienen de los recursos públicos de Steam y pertenecen a sus respectivos titulares (Valve, FromSoftware/Bandai Namco, CD PROJEKT RED, EA/Respawn, Xbox y Team Cherry). Las fotografías de perfil son de Unsplash. Los archivos usados están en `public/images`; no se necesitan peticiones a esos servicios al navegar. Las fuentes DM Sans y Barlow Condensed se solicitan a Google Fonts, con fuentes locales de respaldo.
