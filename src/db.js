const fs = require('node:fs');
const path = require('node:path');
// SQLite viene incluido en Node.js (22.13+): no hay que instalar ni compilar
// ninguna dependencia nativa, así `npm install` funciona en cualquier equipo.
const { DatabaseSync } = require('node:sqlite');

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

  CREATE TABLE IF NOT EXISTS analistas (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario               TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash         TEXT    NOT NULL,
    creado_en             TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Solo se guarda el hash del token de sesión: si alguien copiara la base
  -- de datos, no podría usar esos valores para entrar.
  CREATE TABLE IF NOT EXISTS sesiones (
    token_hash            TEXT    PRIMARY KEY,
    analista_id           INTEGER NOT NULL REFERENCES analistas(id) ON DELETE CASCADE,
    expira_en             INTEGER NOT NULL
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

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

// Código extendido de SQLite para "violación de restricción UNIQUE".
const SQLITE_CONSTRAINT_UNIQUE = 2067;
const esErrorDeUnicidad = (error) => error?.errcode === SQLITE_CONSTRAINT_UNIQUE;

module.exports = { createDb, ESTADOS, esErrorDeUnicidad };
