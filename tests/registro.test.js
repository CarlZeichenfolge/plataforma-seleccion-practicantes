const fs = require('node:fs');
const path = require('node:path');
const { PDF_VALIDO, crearContexto, datosPracticante, registrar } = require('./helpers');

const REGEX_UUID_PDF = /^[0-9a-f-]{36}\.pdf$/;

describe('POST /api/practicantes (registro público)', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await crearContexto({ maxFileBytes: 1024 });
  });

  afterEach(() => ctx.limpiar());

  test('registra un practicante válido con estado pendiente', async () => {
    const res = await registrar(ctx.app).expect(201);

    expect(res.body).toMatchObject({
      id: 1,
      nombre: 'María Fernanda López',
      correo: 'maria@correo.com',
      carrera: 'Ingeniería de Sistemas',
      semestre: 8,
      estado: 'pendiente',
      hojaVidaNombre: 'hoja-de-vida.pdf',
    });
  });

  test('guarda el PDF en disco con un nombre UUID, no con el original', async () => {
    await registrar(ctx.app).expect(201);

    const archivos = fs.readdirSync(ctx.uploadDir);
    expect(archivos).toHaveLength(1);
    expect(archivos[0]).toMatch(REGEX_UUID_PDF);
    expect(fs.readFileSync(path.join(ctx.uploadDir, archivos[0]))).toEqual(PDF_VALIDO);
  });

  test('la respuesta no expone la ruta interna del archivo', async () => {
    const res = await registrar(ctx.app).expect(201);
    expect(JSON.stringify(res.body)).not.toMatch(REGEX_UUID_PDF);
  });

  test('un nombre de archivo malicioso no sirve para escribir fuera de la carpeta', async () => {
    const res = await registrar(ctx.app, datosPracticante(), { buffer: PDF_VALIDO, ruta: '../../server.pdf' }).expect(201);

    expect(res.body.hojaVidaNombre).toBe('server.pdf');
    expect(fs.readdirSync(ctx.uploadDir)[0]).toMatch(REGEX_UUID_PDF);
  });

  test('responde 400 con un mensaje por cada campo faltante', async () => {
    const res = await registrar(ctx.app, {}, null).expect(400);

    expect(Object.keys(res.body.detalles).sort()).toEqual(['carrera', 'correo', 'hojaVida', 'nombre', 'semestre']);
  });

  test('rechaza un archivo de texto disfrazado de PDF', async () => {
    const res = await registrar(ctx.app, datosPracticante(), {
      buffer: Buffer.from('no soy un pdf'),
      nombre: 'falso.pdf',
    }).expect(400);

    expect(res.body.detalles.hojaVida).toBe('El archivo no es un PDF válido.');
    expect(fs.readdirSync(ctx.uploadDir)).toHaveLength(0);
  });

  test('rechaza archivos que no son PDF por tipo y extensión', async () => {
    const res = await registrar(ctx.app, datosPracticante(), {
      buffer: PDF_VALIDO,
      nombre: 'hoja.docx',
      tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }).expect(400);

    expect(res.body.detalles.hojaVida).toMatch(/PDF/);
  });

  test('responde 413 si el archivo supera el tamaño máximo', async () => {
    const grande = Buffer.concat([PDF_VALIDO, Buffer.alloc(2048)]);
    await registrar(ctx.app, datosPracticante(), { buffer: grande, nombre: 'grande.pdf' }).expect(413);

    expect(fs.readdirSync(ctx.uploadDir)).toHaveLength(0);
  });

  test('responde 409 si el correo ya existe, sin importar mayúsculas', async () => {
    await registrar(ctx.app).expect(201);
    const res = await registrar(ctx.app, datosPracticante({ correo: 'MARIA@Correo.COM' })).expect(409);

    expect(res.body.detalles.correo).toBe('Este correo ya fue registrado.');
    expect(fs.readdirSync(ctx.uploadDir)).toHaveLength(1);
  });

  test('conserva tildes y ñ en el nombre original del archivo', async () => {
    const res = await registrar(ctx.app, datosPracticante(), { buffer: PDF_VALIDO, nombre: 'Hoja de vida Peña.pdf' }).expect(201);
    expect(res.body.hojaVidaNombre).toBe('Hoja de vida Peña.pdf');
  });
});
