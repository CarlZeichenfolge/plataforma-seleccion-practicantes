// Validación del registro en el servidor. El front también valida, pero el
// back nunca confía en lo que llega del navegador porque se puede saltar.

const REGEX_NOMBRE = /^[\p{L}][\p{L}\s'.-]*$/u;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Valida y normaliza los campos del formulario de registro.
 * @returns {{ datos: object, errores: Record<string, string> }}
 */
function validarRegistro(body = {}) {
  const errores = {};

  const nombre = texto(body.nombre);
  if (!nombre) errores.nombre = 'El nombre completo es obligatorio.';
  else if (nombre.length < 3 || nombre.length > 100) errores.nombre = 'El nombre debe tener entre 3 y 100 caracteres.';
  else if (!REGEX_NOMBRE.test(nombre)) errores.nombre = 'El nombre solo puede contener letras y espacios.';

  const correo = texto(body.correo).toLowerCase();
  if (!correo) errores.correo = 'El correo electrónico es obligatorio.';
  else if (correo.length > 254 || !REGEX_CORREO.test(correo)) errores.correo = 'El correo electrónico no es válido.';

  const carrera = texto(body.carrera);
  if (!carrera) errores.carrera = 'La carrera universitaria es obligatoria.';
  else if (carrera.length < 3 || carrera.length > 100) errores.carrera = 'La carrera debe tener entre 3 y 100 caracteres.';

  const semestreTexto = texto(body.semestre);
  const semestre = Number(semestreTexto);
  if (!semestreTexto) errores.semestre = 'El semestre actual es obligatorio.';
  else if (!Number.isInteger(semestre) || semestre < 1 || semestre > 12) errores.semestre = 'El semestre debe ser un número entre 1 y 12.';

  return { datos: { nombre, correo, carrera, semestre }, errores };
}

/** Un PDF real siempre empieza con los bytes "%PDF-", sin importar su extensión. */
function esPdfValido(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

module.exports = { validarRegistro, esPdfValido };
