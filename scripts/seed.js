// Carga practicantes de ejemplo, con hojas de vida en PDF, para probar o
// mostrar la plataforma sin registrar a mano.
//
//   npm run seed              agrega los ejemplos (omite correos que ya existen)
//   npm run seed -- --limpiar borra todos los practicantes y sus PDF antes de cargar

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');
const { createDb } = require('../src/db');
const { createAuthRepository } = require('../src/repositories/authRepository');
const { asegurarAnalistaInicial } = require('../src/services/authService');

const EJEMPLOS = [
  ['María Fernanda López', 'maria.lopez@correo.com', 'Ingeniería de Sistemas', 8, 'pendiente', 0],
  ['Juan Pablo Martínez', 'jp.martinez@correo.com', 'Ingeniería de Software', 7, 'viable', 1],
  ['Valentina Herrera Ruiz', 'valentina.herrera@correo.com', 'Ciencia de Datos', 6, 'pendiente', 1],
  ['Santiago Ríos Castaño', 'santiago.rios@correo.com', 'Ingeniería Electrónica', 9, 'no_viable', 2],
  ['Laura Camila Pérez', 'laura.perez@correo.com', 'Ingeniería Industrial', 8, 'viable', 2],
  ['Andrés Felipe Gómez', 'andres.gomez@correo.com', 'Ingeniería de Sistemas', 10, 'pendiente', 3],
  ['Daniela Ospina Muñoz', 'daniela.ospina@correo.com', 'Estadística', 7, 'viable', 4],
  ['Sebastián Torres', 'sebastian.torres@correo.com', 'Matemáticas', 5, 'no_viable', 5],
  ['Natalia Rincón Vargas', 'natalia.rincon@correo.com', 'Administración de Empresas', 9, 'pendiente', 6],
];

const HABILIDADES = {
  'Ingeniería de Sistemas': 'JavaScript, Node.js, SQL, Git, metodologías ágiles',
  'Ingeniería de Software': 'Java, Spring Boot, React, pruebas unitarias, Docker',
  'Ciencia de Datos': 'Python, pandas, SQL, Power BI, estadística aplicada',
  'Ingeniería Electrónica': 'C, sistemas embebidos, redes, Python',
  'Ingeniería Industrial': 'Excel avanzado, análisis de procesos, Lean, SQL básico',
  Estadística: 'R, Python, modelos de regresión, visualización de datos',
  Matemáticas: 'Python, álgebra lineal, optimización, LaTeX',
  'Administración de Empresas': 'Excel, gestión de proyectos, Power BI, servicio al cliente',
};

/** Genera un PDF válido de una página con texto (fuente Helvetica, sin dependencias). */
function pdfHojaDeVida([nombre, correo, carrera, semestre]) {
  const lineas = [
    [22, nombre],
    [12, `${carrera} · ${semestre}.º semestre`],
    [12, correo],
    [12, ''],
    [14, 'Perfil'],
    [11, 'Estudiante interesado en una práctica profesional en desarrollo de software.'],
    [12, ''],
    [14, 'Habilidades'],
    [11, HABILIDADES[carrera] ?? 'Trabajo en equipo, comunicación, Excel'],
    [12, ''],
    [14, 'Experiencia'],
    [11, 'Monitor académico (2025 - 2026). Proyecto de aula con base de datos y API REST.'],
    [12, ''],
    [9, 'Documento de ejemplo generado por scripts/seed.js'],
  ];
  const escapar = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  let y = 740;
  const contenido = ['BT'];
  for (const [tamano, texto] of lineas) {
    contenido.push(`/F1 ${tamano} Tf`, `1 0 0 1 60 ${y} Tm`, `(${escapar(texto)}) Tj`);
    y -= tamano + 10;
  }
  contenido.push('ET');
  const stream = contenido.join('\n');

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((objeto, i) => {
    const posicion = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
    return posicion;
  });
  const inicioXref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  // latin1 coincide con WinAnsi en tildes y ñ, así se ven bien en el PDF.
  return Buffer.from(pdf.replace(/·/g, '-'), 'latin1');
}

async function main() {
  const limpiar = process.argv.includes('--limpiar');
  const db = createDb(config.dbPath);
  fs.mkdirSync(config.uploadDir, { recursive: true });

  if (limpiar) {
    db.exec('DELETE FROM practicantes');
    for (const archivo of fs.readdirSync(config.uploadDir)) {
      if (archivo.endsWith('.pdf')) fs.rmSync(path.join(config.uploadDir, archivo));
    }
    console.log('Se borraron los practicantes y hojas de vida anteriores.');
  }

  await asegurarAnalistaInicial(createAuthRepository(db), config.adminUser, config.adminPassword);

  const existe = db.prepare('SELECT 1 FROM practicantes WHERE correo = ?');
  const insertar = db.prepare(`
    INSERT INTO practicantes
      (nombre, correo, carrera, semestre, hoja_vida_archivo, hoja_vida_nombre, estado, creado_en, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `);

  let creados = 0;
  // Se insertan del más antiguo al más reciente, para que el orden del panel sea natural.
  for (const ejemplo of [...EJEMPLOS].reverse()) {
    const [nombre, correo, carrera, semestre, estado, diasAtras] = ejemplo;
    if (existe.get(correo)) continue;

    const archivo = `${crypto.randomUUID()}.pdf`;
    fs.writeFileSync(path.join(config.uploadDir, archivo), pdfHojaDeVida(ejemplo));
    const hace = `-${diasAtras * 24 + creados} hours`;
    insertar.run(nombre, correo, carrera, semestre, archivo, `Hoja de vida ${nombre}.pdf`, estado, hace, hace);
    creados += 1;
  }

  db.close();
  console.log(`Practicantes de ejemplo creados: ${creados} (base de datos: ${config.dbPath})`);
  console.log(`Ingresa al panel con el usuario "${config.adminUser}".`);
}

main().catch((error) => {
  console.error('No se pudieron cargar los datos de ejemplo:', error);
  process.exit(1);
});
