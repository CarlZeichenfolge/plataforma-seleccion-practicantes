const express = require('express');
const config = require('./config');

// La app se crea aparte del servidor para poder probarla sin abrir un puerto.
function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(config.publicDir));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

module.exports = { createApp };
