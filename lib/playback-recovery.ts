// Bound retries to this player instance; disposal cancels delayed reconnects.
export function playbackRecovery(notice: (message: string) => void) {
  let networkAttempts = 0;
  let mediaAttempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  return {
    network(reload: () => void) {
      if (stopped || timer) return;
      if (networkAttempts >= 3) {
        notice(
          "La señal sigue sin estar disponible. Comprueba la conexión del emisor o pulsa Reintentar reproducción.",
        );
        return;
      }
      const delay = 1000 * 2 ** networkAttempts++;
      notice("Se ha interrumpido la señal. Reconectando automáticamente…");
      timer = setTimeout(() => {
        timer = undefined;
        if (!stopped) reload();
      }, delay);
    },
    media(recover: () => void) {
      if (stopped) return;
      if (mediaAttempts++ === 0) {
        notice("Recuperando la reproducción…");
        recover();
      } else {
        notice(
          "No se ha podido recuperar el vídeo. Pulsa Reintentar reproducción.",
        );
      }
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
