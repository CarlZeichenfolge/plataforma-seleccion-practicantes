const config = require('./config');
const { createDb } = require('./db');
const { createApp } = require('./app');

const db = createDb(config.dbPath);
const app = createApp({ db });

app.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port}`);
  console.log(`Base de datos: ${config.dbPath}`);
});
