const NOMBRE_COOKIE = 'sid';

// La cookie no es accesible desde JavaScript (httpOnly), solo se envía a este
// mismo sitio (sameSite strict, protege contra CSRF) y en producción solo por HTTPS.
function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

function leerCookie(req, nombre) {
  const encabezado = req.headers.cookie;
  if (!encabezado) return null;
  for (const parte of encabezado.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) {
      try {
        return decodeURIComponent(resto.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function createAuthMiddleware(authService) {
  function obtenerSesion(req) {
    const token = leerCookie(req, NOMBRE_COOKIE);
    const sesion = authService.validarSesion(token);
    return sesion ? { ...sesion, token } : null;
  }

  return {
    obtenerSesion,

    /** Para la API: responde 401 en JSON si no hay sesión. */
    requiereAnalista(req, res, next) {
      const sesion = obtenerSesion(req);
      if (!sesion) return res.status(401).json({ error: 'Debes iniciar sesión como analista.' });
      req.analista = sesion;
      next();
    },

    /** Para páginas: redirige al login si no hay sesión. */
    requiereAnalistaPagina(req, res, next) {
      const sesion = obtenerSesion(req);
      if (!sesion) return res.redirect(303, '/login.html');
      req.analista = sesion;
      next();
    },
  };
}

module.exports = { createAuthMiddleware, leerCookie, opcionesCookie, NOMBRE_COOKIE };
