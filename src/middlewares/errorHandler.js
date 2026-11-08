const multer = require('multer');

// Manejo centralizado de errores: convierte cualquier error en una respuesta
// JSON clara y evita mostrar detalles internos del servidor al cliente.
function notFoundApi(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado.' });
}

// Express reconoce un manejador de errores porque recibe 4 parámetros,
// por eso `next` se declara aunque no se use.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Archivo demasiado grande.',
        detalles: { hojaVida: 'La hoja de vida no puede superar el tamaño máximo permitido.' },
      });
    }
    return res.status(400).json({ error: 'Archivo inválido.', detalles: { hojaVida: 'Solo se permite un archivo PDF.' } });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
  }

  if (err.status && err.status < 500) {
    const body = { error: err.message };
    if (err.campo) body.detalles = { [err.campo]: err.message };
    return res.status(err.status).json(body);
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = { notFoundApi, errorHandler };
