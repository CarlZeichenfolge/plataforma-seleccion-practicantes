const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

// Costo 12: cada verificación tarda unos cientos de milisegundos. Para un usuario
// es imperceptible, pero hace muy lento probar miles de contraseñas por fuerza bruta.
const COSTO_BCRYPT = 12;
const DURACION_SESION_MS = 8 * 60 * 60 * 1000; // una jornada laboral

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Si el usuario no existe se compara igual contra este hash (de una cadena
// aleatoria, con el mismo costo), para que la respuesta tarde lo mismo y no
// revele qué usuarios existen.
const HASH_FALSO = '$2b$12$CnQn04aNuM9r.F2jLBqTBuhaUF9vQsSOtg7rUsDNQbXzQPdM287xK';

function createAuthService(repo) {
  return {
    /** Devuelve { token, usuario, expiraEn } si las credenciales son correctas, o null. */
    async iniciarSesion(usuario, password) {
      const analista = repo.analistaPorUsuario(usuario);
      const coincide = await bcrypt.compare(password, analista?.passwordHash ?? HASH_FALSO);
      if (!analista || !coincide) return null;

      const ahora = Date.now();
      repo.eliminarExpiradas(ahora);

      // Token aleatorio de 256 bits: imposible de adivinar. Al navegador va el token;
      // a la base de datos, solo su hash.
      const token = crypto.randomBytes(32).toString('base64url');
      const expiraEn = ahora + DURACION_SESION_MS;
      repo.crearSesion(hashToken(token), analista.id, expiraEn);
      return { token, usuario: analista.usuario, expiraEn };
    },

    /** Devuelve { analistaId, usuario } si el token corresponde a una sesión vigente. */
    validarSesion(token) {
      if (!token) return null;
      return repo.sesionValida(hashToken(token), Date.now());
    },

    cerrarSesion(token) {
      if (token) repo.eliminarSesion(hashToken(token));
    },
  };
}

/** Crea el analista inicial (desde las variables de entorno) si todavía no existe. */
async function asegurarAnalistaInicial(repo, usuario, password) {
  if (repo.analistaPorUsuario(usuario)) return false;
  repo.crearAnalista(usuario, await bcrypt.hash(password, COSTO_BCRYPT));
  return true;
}

module.exports = { createAuthService, asegurarAnalistaInicial, DURACION_SESION_MS };
