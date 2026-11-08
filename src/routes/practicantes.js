const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const { validarRegistro, esPdfValido } = require('../validators/practicanteValidator');
const { createUploadHojaVida } = require('../middlewares/uploadHojaVida');

/** Deja solo un nombre de archivo legible para mostrarlo; nunca se usa como ruta. */
function limpiarNombreOriginal(nombre) {
  const limpio = path.basename(nombre).replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim();
  return (limpio || 'hoja-de-vida.pdf').slice(0, 150);
}

function createPracticantesRouter({ repo, uploadDir, maxFileBytes }) {
  const router = express.Router();
  const uploadHojaVida = createUploadHojaVida({ maxFileBytes });

  // POST /api/practicantes -> registra un practicante con su hoja de vida.
  router.post('/', uploadHojaVida, async (req, res) => {
    const { datos, errores } = validarRegistro(req.body);

    if (!req.file) errores.hojaVida = 'La hoja de vida en PDF es obligatoria.';
    else if (!esPdfValido(req.file.buffer)) errores.hojaVida = 'El archivo no es un PDF válido.';

    if (Object.keys(errores).length > 0) {
      return res.status(400).json({ error: 'Datos inválidos.', detalles: errores });
    }

    if (repo.existeCorreo(datos.correo)) {
      return res.status(409).json({
        error: 'Ya existe un registro con ese correo.',
        detalles: { correo: 'Este correo ya fue registrado.' },
      });
    }

    // Nombre generado por el servidor: evita sobrescrituras y rutas maliciosas.
    const hojaVidaArchivo = `${crypto.randomUUID()}.pdf`;
    const rutaArchivo = path.join(uploadDir, hojaVidaArchivo);
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(rutaArchivo, req.file.buffer, { flag: 'wx' });

    try {
      const practicante = repo.crear({
        ...datos,
        hojaVidaArchivo,
        hojaVidaNombre: limpiarNombreOriginal(req.file.originalname),
      });
      return res.status(201).json(practicante);
    } catch (error) {
      // Si falla la base de datos, se borra el archivo para no dejar huérfanos.
      await fs.rm(rutaArchivo, { force: true });
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          error: 'Ya existe un registro con ese correo.',
          detalles: { correo: 'Este correo ya fue registrado.' },
        });
      }
      throw error;
    }
  });

  return router;
}

module.exports = { createPracticantesRouter };
