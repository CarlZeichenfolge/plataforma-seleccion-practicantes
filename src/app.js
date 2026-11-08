const express = require('express');
const config = require('./config');
const { createPracticanteRepository } = require('./repositories/practicanteRepository');
const { createPracticantesRouter } = require('./routes/practicantes');
const { notFoundApi, errorHandler } = require('./middlewares/errorHandler');

// La app se crea aparte del servidor para poder probarla sin abrir un puerto.
// Recibe la base de datos y las rutas como parámetros para que las pruebas
// usen una base en memoria y una carpeta temporal.
function createApp({ db, uploadDir = config.uploadDir, maxFileBytes = config.maxFileBytes }) {
  const app = express();
  const repo = createPracticanteRepository(db);

  app.use(express.json());
  app.use(express.static(config.publicDir));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/practicantes', createPracticantesRouter({ repo, uploadDir, maxFileBytes }));

  app.use('/api', notFoundApi);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
