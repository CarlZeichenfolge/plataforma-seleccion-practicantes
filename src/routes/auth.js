const express = require('express');
const { DURACION_SESION_MS } = require('../services/authService');
const { leerCookie, opcionesCookie, NOMBRE_COOKIE } = require('../middlewares/auth');
const { createLoginLimiter } = require('../middlewares/loginLimiter');

function createAuthRouter({ authService, auth, limiter = createLoginLimiter() }) {
  const router = express.Router();

  // POST /api/auth/login -> valida credenciales y crea la sesión en una cookie.
  router.post('/login', limiter, async (req, res) => {
    const usuario = typeof req.body?.usuario === 'string' ? req.body.usuario.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const errores = {};
    if (!usuario) errores.usuario = 'Ingresa tu usuario.';
    else if (usuario.length > 100) errores.usuario = 'El usuario es demasiado largo.';
    if (!password) errores.password = 'Ingresa tu contraseña.';
    else if (password.length > 200) errores.password = 'La contraseña es demasiado larga.';
    if (Object.keys(errores).length > 0) {
      return res.status(400).json({ error: 'Datos inválidos.', detalles: errores });
    }

    const sesion = await authService.iniciarSesion(usuario, password);
    if (!sesion) {
      limiter.registrarFallo(req);
      // Mensaje genérico: no revela si el usuario existe o si falló la contraseña.
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    limiter.reiniciar(req);
    res.cookie(NOMBRE_COOKIE, sesion.token, { ...opcionesCookie(), maxAge: DURACION_SESION_MS });
    res.json({ usuario: sesion.usuario });
  });

  // POST /api/auth/logout -> elimina la sesión del servidor y borra la cookie.
  router.post('/logout', (req, res) => {
    authService.cerrarSesion(leerCookie(req, NOMBRE_COOKIE));
    res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
    res.status(204).end();
  });

  // GET /api/auth/sesion -> indica si hay una sesión activa y de quién es.
  // Responde 200 en ambos casos: no tener sesión aquí es una respuesta válida, no un error.
  router.get('/sesion', (req, res) => {
    const sesion = auth.obtenerSesion(req);
    res.json(sesion ? { autenticado: true, usuario: sesion.usuario } : { autenticado: false });
  });

  return router;
}

module.exports = { createAuthRouter };
