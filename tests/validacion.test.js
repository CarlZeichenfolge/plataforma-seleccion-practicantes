const { validarRegistro, esPdfValido } = require('../src/validators/practicanteValidator');

const valido = {
  nombre: 'María Fernanda López',
  correo: 'maria@correo.com',
  carrera: 'Ingeniería de Sistemas',
  semestre: '8',
};

describe('validarRegistro', () => {
  test('acepta datos válidos y los normaliza', () => {
    const { datos, errores } = validarRegistro({
      ...valido,
      nombre: '  María   Fernanda  López ',
      correo: 'MARIA@Correo.com',
    });
    expect(errores).toEqual({});
    expect(datos).toEqual({
      nombre: 'María Fernanda López',
      correo: 'maria@correo.com',
      carrera: 'Ingeniería de Sistemas',
      semestre: 8,
    });
  });

  test('marca todos los campos obligatorios cuando llegan vacíos', () => {
    const { errores } = validarRegistro({});
    expect(Object.keys(errores).sort()).toEqual(['carrera', 'correo', 'nombre', 'semestre']);
  });

  test('no acepta un nombre con espacios solamente', () => {
    expect(validarRegistro({ ...valido, nombre: '    ' }).errores.nombre).toBe('El nombre completo es obligatorio.');
  });

  test.each(['J3', 'Juan123', '<script>', 'Ana_Pérez'])('rechaza el nombre "%s"', (nombre) => {
    expect(validarRegistro({ ...valido, nombre }).errores.nombre).toBeDefined();
  });

  test.each(["José O'Neill", 'Ana-María Peña', 'Ñusta Quispe'])('acepta el nombre "%s"', (nombre) => {
    expect(validarRegistro({ ...valido, nombre }).errores.nombre).toBeUndefined();
  });

  test.each(['correo', 'correo@', '@dominio.com', 'a@b', 'a b@c.com'])('rechaza el correo "%s"', (correo) => {
    expect(validarRegistro({ ...valido, correo }).errores.correo).toBeDefined();
  });

  test.each(['0', '13', '2.5', 'abc', '-1'])('rechaza el semestre "%s"', (semestre) => {
    expect(validarRegistro({ ...valido, semestre }).errores.semestre).toBeDefined();
  });

  test.each(['1', '12'])('acepta el semestre límite %s', (semestre) => {
    expect(validarRegistro({ ...valido, semestre }).errores.semestre).toBeUndefined();
  });

  test('ignora campos que no son texto', () => {
    const { errores } = validarRegistro({ nombre: ['Ana'], correo: { a: 1 }, carrera: 5, semestre: null });
    expect(Object.keys(errores)).toHaveLength(4);
  });
});

describe('esPdfValido', () => {
  test('reconoce un PDF por su firma', () => {
    expect(esPdfValido(Buffer.from('%PDF-1.7\n...'))).toBe(true);
  });

  test('rechaza un archivo de texto aunque se llame .pdf', () => {
    expect(esPdfValido(Buffer.from('esto no es un pdf'))).toBe(false);
  });

  test('rechaza archivos vacíos o que no son buffers', () => {
    expect(esPdfValido(Buffer.alloc(0))).toBe(false);
    expect(esPdfValido('%PDF-1.4')).toBe(false);
    expect(esPdfValido(undefined)).toBe(false);
  });
});
