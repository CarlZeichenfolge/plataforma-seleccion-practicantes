const request = require('supertest');
const { ANALISTA, crearContexto, agenteConSesion, registrar } = require('./helpers');

describe('Autenticación de analistas', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await crearContexto();
  });

  afterEach(() => ctx.limpiar());

  describe('rutas protegidas sin sesión', () => {
    test.each([
      ['GET', '/api/practicantes'],
      ['GET', '/api/practicantes/1'],
      ['GET', '/api/practicantes/1/hoja-de-vida'],
      ['PATCH', '/api/practicantes/1/estado'],
    ])('%s %s responde 401', async (metodo, ruta) => {
      const res = await request(ctx.app)[metodo.toLowerCase()](ruta).send({ estado: 'viable' });
      expect(res.status).toBe(401);
    });

    test('el panel redirige al login', async () => {
      const res = await request(ctx.app).get('/panel.html').expect(303);
      expect(res.headers.location).toBe('/login.html');
    });

    test('una cookie inventada no da acceso', async () => {
      await request(ctx.app).get('/api/practicantes').set('Cookie', 'sid=token-falso').expect(401);
    });

    test('el registro de practicantes sigue siendo público', async () => {
      await registrar(ctx.app).expect(201);
    });
  });

  describe('POST /api/auth/login', () => {
    test('responde 400 si faltan usuario o contraseña', async () => {
      const res = await request(ctx.app).post('/api/auth/login').send({}).expect(400);
      expect(Object.keys(res.body.detalles).sort()).toEqual(['password', 'usuario']);
    });

    test('usa el mismo mensaje para contraseña incorrecta y usuario inexistente', async () => {
      const malaClave = await request(ctx.app).post('/api/auth/login').send({ ...ANALISTA, password: 'mala' }).expect(401);
      const noExiste = await request(ctx.app).post('/api/auth/login').send({ usuario: 'nadie', password: 'mala' }).expect(401);
      expect(malaClave.body.error).toBe(noExiste.body.error);
    });

    test('con credenciales correctas crea una cookie HttpOnly y SameSite=Strict', async () => {
      const res = await request(ctx.app).post('/api/auth/login').send(ANALISTA).expect(200);
      const cookie = res.headers['set-cookie'][0];

      expect(res.body).toEqual({ usuario: 'analista' });
      expect(cookie).toMatch(/^sid=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });

    test('el usuario no distingue mayúsculas', async () => {
      await request(ctx.app).post('/api/auth/login').send({ ...ANALISTA, usuario: 'ANALISTA' }).expect(200);
    });

    test('la base de datos guarda el hash del token, no el token', async () => {
      const res = await request(ctx.app).post('/api/auth/login').send(ANALISTA).expect(200);
      const token = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
      const { token_hash: tokenHash } = ctx.db.prepare('SELECT token_hash FROM sesiones').get();

      expect(tokenHash).not.toBe(token);
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    test('la contraseña se guarda cifrada con bcrypt', () => {
      const { password_hash: hash } = ctx.db.prepare('SELECT password_hash FROM analistas').get();
      expect(hash).not.toContain(ANALISTA.password);
      expect(hash).toMatch(/^\$2[aby]\$12\$/);
    });

    test('bloquea el acceso tras 5 intentos fallidos, incluso con la clave correcta', async () => {
      for (let i = 0; i < 5; i++) {
        await request(ctx.app).post('/api/auth/login').send({ ...ANALISTA, password: `mala-${i}` }).expect(401);
      }
      const res = await request(ctx.app).post('/api/auth/login').send(ANALISTA).expect(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('sesión activa', () => {
    test('da acceso a la API y al panel', async () => {
      const agente = await agenteConSesion(ctx.app);
      await agente.get('/api/practicantes').expect(200);
      await agente.get('/panel.html').expect(200);
    });

    test('GET /api/auth/sesion indica quién inició sesión', async () => {
      const agente = await agenteConSesion(ctx.app);
      const res = await agente.get('/api/auth/sesion').expect(200);
      expect(res.body).toEqual({ autenticado: true, usuario: 'analista' });

      const anonimo = await request(ctx.app).get('/api/auth/sesion').expect(200);
      expect(anonimo.body).toEqual({ autenticado: false });
    });

    test('al cerrar sesión, la cookie anterior deja de servir', async () => {
      const login = await request(ctx.app).post('/api/auth/login').send(ANALISTA).expect(200);
      const cookie = login.headers['set-cookie'][0].split(';')[0];

      await request(ctx.app).get('/api/practicantes').set('Cookie', cookie).expect(200);
      await request(ctx.app).post('/api/auth/logout').set('Cookie', cookie).expect(204);
      await request(ctx.app).get('/api/practicantes').set('Cookie', cookie).expect(401);
    });
  });
});
