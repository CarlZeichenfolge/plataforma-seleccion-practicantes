const config = require('./config');
const { createApp } = require('./app');

const app = createApp();

app.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port}`);
});
