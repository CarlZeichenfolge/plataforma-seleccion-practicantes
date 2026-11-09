const config = require('./config');
const { createDb } = require('./db');
const { createApp } = require('./app');
const { createAuthRepository } = require('./repositories/authRepository');
const { asegurarAnalistaInicial } = require('./services/authService');

async function main() {
  const db = createDb(config.dbPath);

  const creado = await asegurarAnalistaInicial(createAuthRepository(db), config.adminUser, config.adminPassword);
  if (creado) console.log(`Analista inicial creado: "${config.adminUser}"`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('Aviso: se está usando la contraseña de analista por defecto. Defínela en el archivo .env.');
  }

  const app = createApp({ db });
  app.listen(config.port, () => {
    console.log(`Servidor escuchando en http://localhost:${config.port}`);
    console.log(`Panel del analista: http://localhost:${config.port}/panel.html`);
    console.log(`Base de datos: ${config.dbPath}`);
  });
}

main().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error);
  process.exit(1);
});
