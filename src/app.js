const path = require('node:path');
const express = require('express');
const config = require('./config');
const { createPracticanteRepository } = require('./repositories/practicanteRepository');
const { createAuthRepository } = require('./repositories/authRepository');
const { createAuthService } = require('./services/authService');
const { createAuthMiddleware } = require('./middlewares/auth');
const { createPracticantesRouter } = require('./routes/practicantes');
const { createAuthRouter } = require('./routes/auth');
const { notFoundApi, errorHandler } = require('./middlewares/errorHandler');

// La app se crea aparte del servidor para poder probarla sin abrir un puerto.
// Recibe la base de datos y las rutas como parámetros para que las pruebas
// usen una base en memoria y una carpeta temporal.
function createApp({ db, uploadDir = config.uploadDir, maxFileBytes = config.maxFileBytes, limiter }) {
  const app = express();
  const repo = createPracticanteRepository(db);
  const authService = createAuthService(createAuthRepository(db));
  const auth = createAuthMiddleware(authService);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  // El panel solo se entrega con sesión; sin ella, redirige al login.
  // Se declara antes de los archivos estáticos para que no se salte esta revisión.
  app.get(['/panel', '/panel.html'], auth.requiereAnalistaPagina, (req, res) => {
    res.sendFile(path.join(config.publicDir, 'panel.html'));
  });

  app.use(express.static(config.publicDir));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter({ authService, auth, limiter }));
  app.use(
    '/api/practicantes',
    createPracticantesRouter({ repo, uploadDir, maxFileBytes, requiereAnalista: auth.requiereAnalista }),
  );

  app.use('/api', notFoundApi);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
