const express = require('express');
const config = require('./config');

// La app se crea aparte del servidor para poder probarla sin abrir un puerto.
// Recibe la base de datos como parámetro para que las pruebas usen una en memoria.
function createApp({ db }) {
  const app = express();
  app.locals.db = db;

  app.use(express.json());
  app.use(express.static(config.publicDir));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

module.exports = { createApp };
