// Acceso a datos de analistas y sesiones. Igual que en el repositorio de
// practicantes, todas las consultas usan parámetros para evitar inyección SQL.

function createAuthRepository(db) {
  const stmts = {
    analistaPorUsuario: db.prepare(`
      SELECT id, usuario, password_hash AS passwordHash FROM analistas WHERE usuario = ?
    `),
    crearAnalista: db.prepare(`INSERT INTO analistas (usuario, password_hash) VALUES (?, ?)`),
    crearSesion: db.prepare(`INSERT INTO sesiones (token_hash, analista_id, expira_en) VALUES (?, ?, ?)`),
    sesionValida: db.prepare(`
      SELECT a.id AS analistaId, a.usuario
      FROM sesiones s JOIN analistas a ON a.id = s.analista_id
      WHERE s.token_hash = ? AND s.expira_en > ?
    `),
    eliminarSesion: db.prepare(`DELETE FROM sesiones WHERE token_hash = ?`),
    eliminarExpiradas: db.prepare(`DELETE FROM sesiones WHERE expira_en <= ?`),
  };

  return {
    analistaPorUsuario(usuario) {
      return stmts.analistaPorUsuario.get(usuario) ?? null;
    },
    crearAnalista(usuario, passwordHash) {
      stmts.crearAnalista.run(usuario, passwordHash);
    },
    crearSesion(tokenHash, analistaId, expiraEn) {
      stmts.crearSesion.run(tokenHash, analistaId, expiraEn);
    },
    sesionValida(tokenHash, ahora) {
      return stmts.sesionValida.get(tokenHash, ahora) ?? null;
    },
    eliminarSesion(tokenHash) {
      stmts.eliminarSesion.run(tokenHash);
    },
    eliminarExpiradas(ahora) {
      stmts.eliminarExpiradas.run(ahora);
    },
  };
}

module.exports = { createAuthRepository };
