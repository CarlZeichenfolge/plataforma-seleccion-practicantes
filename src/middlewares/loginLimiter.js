// Límite de intentos fallidos de inicio de sesión por dirección IP, en memoria.
// Tras `maxIntentos` fallos dentro de la ventana, se bloquea hasta que termine.
// Frena ataques de fuerza bruta sin depender de servicios externos.

function createLoginLimiter({ maxIntentos = 5, ventanaMs = 15 * 60 * 1000 } = {}) {
  const intentos = new Map(); // ip -> { fallos, desde }

  function vigente(ip, ahora) {
    const registro = intentos.get(ip);
    if (registro && ahora - registro.desde >= ventanaMs) {
      intentos.delete(ip);
      return null;
    }
    return registro ?? null;
  }

  function middleware(req, res, next) {
    const ahora = Date.now();
    const registro = vigente(req.ip, ahora);
    if (registro && registro.fallos >= maxIntentos) {
      const segundos = Math.ceil((registro.desde + ventanaMs - ahora) / 1000);
      res.set('Retry-After', String(segundos));
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Espera ${Math.ceil(segundos / 60)} minuto(s) e inténtalo de nuevo.`,
      });
    }
    next();
  }

  middleware.registrarFallo = (req) => {
    const ahora = Date.now();
    const registro = vigente(req.ip, ahora) ?? { fallos: 0, desde: ahora };
    registro.fallos += 1;
    intentos.set(req.ip, registro);
  };

  middleware.reiniciar = (req) => intentos.delete(req.ip);

  return middleware;
}

module.exports = { createLoginLimiter };
