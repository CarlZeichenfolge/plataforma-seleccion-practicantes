const path = require('node:path');
const multer = require('multer');

// El archivo se recibe en memoria (máx. 5 MB) para validarlo antes de escribirlo
// en disco. Así un archivo rechazado nunca queda guardado en el servidor.
function createUploadHojaVida({ maxFileBytes }) {
  return multer({
    storage: multer.memoryStorage(),
    // Los navegadores envían el nombre del archivo en UTF-8 (tildes, ñ).
    defParamCharset: 'utf8',
    limits: { fileSize: maxFileBytes, files: 1, fields: 10 },
    fileFilter(req, file, cb) {
      const esPdf = file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf';
      if (!esPdf) {
        const error = new Error('La hoja de vida debe ser un archivo PDF.');
        error.status = 400;
        error.campo = 'hojaVida';
        return cb(error);
      }
      cb(null, true);
    },
  }).single('hojaVida');
}

module.exports = { createUploadHojaVida };
