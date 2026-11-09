const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Configuración centralizada: lee variables de entorno con valores por defecto
// para que el proyecto funcione aunque no exista un archivo .env.
const config = {
  port: Number(process.env.PORT) || 3000,
  adminUser: process.env.ADMIN_USER || 'analista',
  adminPassword: process.env.ADMIN_PASSWORD || 'Analista123*',
  dbPath: path.resolve(ROOT, process.env.DB_PATH || 'data/practicantes.db'),
  uploadDir: path.resolve(ROOT, process.env.UPLOAD_DIR || 'uploads'),
  maxFileBytes: (Number(process.env.MAX_FILE_MB) || 5) * 1024 * 1024,
  publicDir: path.join(ROOT, 'public'),
};

module.exports = config;
