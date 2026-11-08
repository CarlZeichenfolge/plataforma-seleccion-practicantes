const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

// Estados válidos de un practicante dentro del proceso de selección.
const ESTADOS = Object.freeze(['pendiente', 'viable', 'no_viable']);

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS practicantes (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre                TEXT    NOT NULL,
    correo                TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    carrera               TEXT    NOT NULL,
    semestre              INTEGER NOT NULL CHECK (semestre BETWEEN 1 AND 12),
    hoja_vida_archivo     TEXT    NOT NULL,
    hoja_vida_nombre      TEXT    NOT NULL,
    estado                TEXT    NOT NULL DEFAULT 'pendiente'
                                  CHECK (estado IN ('pendiente', 'viable', 'no_viable')),
    creado_en             TEXT    NOT NULL DEFAULT (datetime('now')),
    actualizado_en        TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

/**
 * Abre (o crea) la base de datos SQLite y aplica el esquema.
 * @param {string} dbPath Ruta del archivo .db, o ':memory:' para pruebas.
 */
function createDb(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

module.exports = { createDb, ESTADOS };
