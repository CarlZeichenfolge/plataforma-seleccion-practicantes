// Utilidades compartidas por las pruebas. Cada suite crea su propia app con una
// base de datos en memoria y una carpeta temporal, así las pruebas no tocan los
// datos reales ni dependen unas de otras.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createDb } = require('../src/db');
const { createApp } = require('../src/app');
const { createAuthRepository } = require('../src/repositories/authRepository');
const { asegurarAnalistaInicial } = require('../src/services/authService');

const ANALISTA = { usuario: 'analista', password: 'Clave-de-prueba-123' };

// PDF mínimo válido: empieza con la firma "%PDF-".
const PDF_VALIDO = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function crearContexto({ maxFileBytes } = {}) {
  const db = createDb(':memory:');
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'practicantes-test-'));
  await asegurarAnalistaInicial(createAuthRepository(db), ANALISTA.usuario, ANALISTA.password);
  const app = createApp({ db, uploadDir, ...(maxFileBytes ? { maxFileBytes } : {}) });

  return {
    app,
    db,
    uploadDir,
    limpiar() {
      db.close();
      fs.rmSync(uploadDir, { recursive: true, force: true });
    },
  };
}

/** Agente de Supertest que conserva la cookie de sesión entre peticiones. */
async function agenteConSesion(app) {
  const agente = request.agent(app);
  await agente.post('/api/auth/login').send(ANALISTA).expect(200);
  return agente;
}

function datosPracticante(cambios = {}) {
  return {
    nombre: 'María Fernanda López',
    correo: 'maria@correo.com',
    carrera: 'Ingeniería de Sistemas',
    semestre: '8',
    ...cambios,
  };
}

/** Envía el formulario de registro como multipart/form-data, igual que el navegador. */
function registrar(app, campos = datosPracticante(), archivo = { buffer: PDF_VALIDO, nombre: 'hoja-de-vida.pdf' }) {
  const req = request(app).post('/api/practicantes');
  for (const [clave, valor] of Object.entries(campos)) req.field(clave, valor);
  if (archivo) {
    req.attach('hojaVida', archivo.buffer, {
      // `filepath` envía el nombre tal cual (incluso con "../"), para probar
      // que es el servidor el que lo limpia y no la librería del cliente.
      ...(archivo.ruta ? { filepath: archivo.ruta } : { filename: archivo.nombre }),
      contentType: archivo.tipo ?? 'application/pdf',
    });
  }
  return req;
}

/** Parser para leer respuestas binarias (PDF) como Buffer en Supertest. */
function parserBinario(res, callback) {
  const partes = [];
  res.on('data', (parte) => partes.push(parte));
  res.on('end', () => callback(null, Buffer.concat(partes)));
}

module.exports = { ANALISTA, PDF_VALIDO, crearContexto, agenteConSesion, datosPracticante, registrar, parserBinario };
