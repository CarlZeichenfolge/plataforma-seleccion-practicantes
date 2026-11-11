const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const { validarRegistro, esPdfValido } = require('../validators/practicanteValidator');
const { createUploadHojaVida } = require('../middlewares/uploadHojaVida');
const { ESTADOS, esErrorDeUnicidad } = require('../db');

// Los archivos siempre se guardan como "<uuid>.pdf". Se verifica de nuevo antes
// de leer del disco, como defensa adicional contra rutas manipuladas.
const REGEX_ARCHIVO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

/**
 * Encabezado Content-Disposition con el nombre original del archivo.
 * `filename` lleva una versión solo ASCII para navegadores antiguos y
 * `filename*` la versión UTF-8 completa (tildes, ñ), según el RFC 6266.
 */
function contentDisposition(tipo, nombre) {
  const ascii = nombre.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'hoja-de-vida.pdf';
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/** Convierte el :id de la URL en entero positivo, o null si no es válido. */
function parsearId(valor) {
  const id = Number(valor);
  return /^\d+$/.test(valor) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Deja solo un nombre de archivo legible para mostrarlo; nunca se usa como ruta. */
function limpiarNombreOriginal(nombre) {
  const limpio = path.basename(nombre).replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim();
  return (limpio || 'hoja-de-vida.pdf').slice(0, 150);
}

function createPracticantesRouter({ repo, uploadDir, maxFileBytes, requiereAnalista }) {
  const router = express.Router();
  const uploadHojaVida = createUploadHojaVida({ maxFileBytes });

  // POST /api/practicantes -> registra un practicante con su hoja de vida.
  // Es la única ruta pública: la usan los practicantes desde el formulario.
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
      if (esErrorDeUnicidad(error)) {
        return res.status(409).json({
          error: 'Ya existe un registro con ese correo.',
          detalles: { correo: 'Este correo ya fue registrado.' },
        });
      }
      throw error;
    }
  });

  // Desde aquí, todas las rutas exigen una sesión de analista.
  router.use(requiereAnalista);

  // GET /api/practicantes?estado=viable -> lista de practicantes (filtro opcional).
  router.get('/', (req, res) => {
    const { estado } = req.query;
    if (estado !== undefined && !ESTADOS.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}.` });
    }
    res.json(repo.listar(estado));
  });

  // GET /api/practicantes/:id -> detalle de un practicante.
  router.get('/:id', (req, res) => {
    const id = parsearId(req.params.id);
    if (!id) return res.status(400).json({ error: 'El id debe ser un número entero positivo.' });

    const practicante = repo.obtenerPorId(id);
    if (!practicante) return res.status(404).json({ error: 'Practicante no encontrado.' });

    res.json(practicante);
  });

  // GET /api/practicantes/:id/hoja-de-vida -> entrega el PDF para verlo en el navegador.
  // Con ?descargar=1 el navegador lo descarga con su nombre original.
  router.get('/:id/hoja-de-vida', async (req, res) => {
    const id = parsearId(req.params.id);
    if (!id) return res.status(400).json({ error: 'El id debe ser un número entero positivo.' });

    const archivo = repo.obtenerArchivo(id);
    if (!archivo) return res.status(404).json({ error: 'Practicante no encontrado.' });
    if (!REGEX_ARCHIVO.test(archivo.archivo)) {
      return res.status(500).json({ error: 'El archivo registrado no es válido.' });
    }

    const ruta = path.join(uploadDir, archivo.archivo);
    try {
      await fs.access(ruta);
    } catch {
      return res.status(404).json({ error: 'La hoja de vida no se encuentra en el servidor.' });
    }

    const descargar = req.query.descargar === '1';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(descargar ? 'attachment' : 'inline', archivo.nombre),
      // Son datos personales: que el navegador no los guarde en caché.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.sendFile(ruta, { cacheControl: false, lastModified: false });
  });

  // PATCH /api/practicantes/:id/estado -> marca como viable / no viable (o vuelve a pendiente).
  router.patch('/:id/estado', (req, res) => {
    const id = parsearId(req.params.id);
    if (!id) return res.status(400).json({ error: 'El id debe ser un número entero positivo.' });

    const estado = req.body?.estado;
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}.`,
        detalles: { estado: 'Estado inválido.' },
      });
    }

    const practicante = repo.actualizarEstado(id, estado);
    if (!practicante) return res.status(404).json({ error: 'Practicante no encontrado.' });

    res.json(practicante);
  });

  return router;
}

module.exports = { createPracticantesRouter };
