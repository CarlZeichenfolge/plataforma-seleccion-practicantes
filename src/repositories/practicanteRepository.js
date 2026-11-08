// Capa de acceso a datos: es el único lugar del proyecto que escribe SQL
// sobre la tabla de practicantes. Todas las consultas usan parámetros (?)
// para evitar inyección SQL.

const COLUMNAS_PUBLICAS = `
  id, nombre, correo, carrera, semestre,
  hoja_vida_nombre AS hojaVidaNombre,
  estado,
  creado_en AS creadoEn,
  actualizado_en AS actualizadoEn
`;

function createPracticanteRepository(db) {
  const stmts = {
    insertar: db.prepare(`
      INSERT INTO practicantes (nombre, correo, carrera, semestre, hoja_vida_archivo, hoja_vida_nombre)
      VALUES (@nombre, @correo, @carrera, @semestre, @hojaVidaArchivo, @hojaVidaNombre)
    `),
    listar: db.prepare(`SELECT ${COLUMNAS_PUBLICAS} FROM practicantes ORDER BY creado_en DESC, id DESC`),
    listarPorEstado: db.prepare(`
      SELECT ${COLUMNAS_PUBLICAS} FROM practicantes WHERE estado = ? ORDER BY creado_en DESC, id DESC
    `),
    porId: db.prepare(`SELECT ${COLUMNAS_PUBLICAS} FROM practicantes WHERE id = ?`),
    archivoPorId: db.prepare(`
      SELECT hoja_vida_archivo AS archivo, hoja_vida_nombre AS nombre FROM practicantes WHERE id = ?
    `),
    existeCorreo: db.prepare(`SELECT 1 FROM practicantes WHERE correo = ?`),
    actualizarEstado: db.prepare(`
      UPDATE practicantes SET estado = ?, actualizado_en = datetime('now') WHERE id = ?
    `),
  };

  return {
    crear(datos) {
      const { lastInsertRowid } = stmts.insertar.run(datos);
      return this.obtenerPorId(lastInsertRowid);
    },

    /** Lista todos los practicantes, o solo los de un estado si se indica. */
    listar(estado) {
      return estado ? stmts.listarPorEstado.all(estado) : stmts.listar.all();
    },

    obtenerPorId(id) {
      return stmts.porId.get(id) ?? null;
    },

    obtenerArchivo(id) {
      return stmts.archivoPorId.get(id) ?? null;
    },

    existeCorreo(correo) {
      return Boolean(stmts.existeCorreo.get(correo));
    },

    /** Devuelve el practicante actualizado, o null si no existe. */
    actualizarEstado(id, estado) {
      const { changes } = stmts.actualizarEstado.run(estado, id);
      return changes > 0 ? this.obtenerPorId(id) : null;
    },
  };
}

module.exports = { createPracticanteRepository };
