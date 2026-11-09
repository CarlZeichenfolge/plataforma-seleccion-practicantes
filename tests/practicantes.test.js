const fs = require('node:fs');
const path = require('node:path');
const { PDF_VALIDO, crearContexto, agenteConSesion, datosPracticante, registrar, parserBinario } = require('./helpers');

describe('API de practicantes (con sesión de analista)', () => {
  let ctx;
  let agente;

  beforeAll(async () => {
    ctx = await crearContexto();
    agente = await agenteConSesion(ctx.app);

    await registrar(ctx.app, datosPracticante()).expect(201);
    await registrar(ctx.app, datosPracticante({ nombre: 'Luis Rojas', correo: 'luis@correo.com', carrera: 'Economía' })).expect(201);
    await registrar(
      ctx.app,
      datosPracticante({ nombre: 'Ana Gómez', correo: 'ana@correo.com' }),
      { buffer: PDF_VALIDO, nombre: 'Hoja de vida Ana Gómez.pdf' },
    ).expect(201);
  });

  afterAll(() => ctx.limpiar());

  describe('GET /api/practicantes', () => {
    test('lista todos, del más reciente al más antiguo', async () => {
      const res = await agente.get('/api/practicantes').expect(200);
      expect(res.body.map((p) => p.nombre)).toEqual(['Ana Gómez', 'Luis Rojas', 'María Fernanda López']);
    });

    test('no expone el nombre interno del archivo', async () => {
      const res = await agente.get('/api/practicantes').expect(200);
      expect(res.body[0]).not.toHaveProperty('hojaVidaArchivo');
      expect(res.body[0]).not.toHaveProperty('hoja_vida_archivo');
    });

    test('filtra por estado', async () => {
      const res = await agente.get('/api/practicantes?estado=pendiente').expect(200);
      expect(res.body).toHaveLength(3);
    });

    test('responde 400 con un estado de filtro inválido', async () => {
      await agente.get('/api/practicantes?estado=aprobado').expect(400);
    });
  });

  describe('GET /api/practicantes/:id', () => {
    test('devuelve el detalle de un practicante', async () => {
      const res = await agente.get('/api/practicantes/2').expect(200);
      expect(res.body).toMatchObject({ id: 2, nombre: 'Luis Rojas', carrera: 'Economía' });
    });

    test('responde 404 si no existe', async () => {
      await agente.get('/api/practicantes/999').expect(404);
    });

    test.each(['abc', '-1', '0', '1.5'])('responde 400 con el id "%s"', async (id) => {
      await agente.get(`/api/practicantes/${id}`).expect(400);
    });
  });

  describe('PATCH /api/practicantes/:id/estado', () => {
    test.each(['viable', 'no_viable', 'pendiente'])('cambia el estado a %s', async (estado) => {
      const res = await agente.patch('/api/practicantes/1/estado').send({ estado }).expect(200);
      expect(res.body.estado).toBe(estado);

      const detalle = await agente.get('/api/practicantes/1').expect(200);
      expect(detalle.body.estado).toBe(estado);
    });

    test('el filtro refleja el cambio de estado', async () => {
      await agente.patch('/api/practicantes/2/estado').send({ estado: 'viable' }).expect(200);
      const res = await agente.get('/api/practicantes?estado=viable').expect(200);
      expect(res.body.map((p) => p.id)).toEqual([2]);
    });

    test.each([['contratado'], [''], [null], [undefined]])('responde 400 con el estado %p', async (estado) => {
      await agente.patch('/api/practicantes/1/estado').send({ estado }).expect(400);
    });

    test('responde 404 si el practicante no existe', async () => {
      await agente.patch('/api/practicantes/999/estado').send({ estado: 'viable' }).expect(404);
    });

    test('responde 400 si el cuerpo no es JSON válido', async () => {
      await agente
        .patch('/api/practicantes/1/estado')
        .set('Content-Type', 'application/json')
        .send('{malo')
        .expect(400);
    });
  });

  describe('GET /api/practicantes/:id/hoja-de-vida', () => {
    test('entrega el PDF para verlo en el navegador', async () => {
      const res = await agente.get('/api/practicantes/3/hoja-de-vida').buffer(true).parse(parserBinario).expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/^inline;/);
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.body.equals(PDF_VALIDO)).toBe(true);
    });

    test('con ?descargar=1 lo descarga con el nombre original (con tildes)', async () => {
      const res = await agente.get('/api/practicantes/3/hoja-de-vida?descargar=1').expect(200);

      expect(res.headers['content-disposition']).toMatch(/^attachment;/);
      expect(res.headers['content-disposition']).toContain(`filename*=UTF-8''${encodeURIComponent('Hoja de vida Ana Gómez.pdf')}`);
    });

    test('responde 404 si el practicante no existe', async () => {
      await agente.get('/api/practicantes/999/hoja-de-vida').expect(404);
    });

    test('responde 404 con un mensaje claro si el archivo ya no está en el servidor', async () => {
      const { hoja_vida_archivo: archivo } = ctx.db.prepare('SELECT hoja_vida_archivo FROM practicantes WHERE id = 1').get();
      fs.rmSync(path.join(ctx.uploadDir, archivo));

      const res = await agente.get('/api/practicantes/1/hoja-de-vida').expect(404);
      expect(res.body.error).toBe('La hoja de vida no se encuentra en el servidor.');
    });
  });
});
