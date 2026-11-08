// Formulario de registro: valida en el navegador para dar retroalimentación
// inmediata y envía los datos al servidor, que vuelve a validar todo.

const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const REGEX_NOMBRE = /^[\p{L}][\p{L}\s'.-]*$/u;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const form = document.getElementById('registro-form');
const alerta = document.getElementById('form-alert');
const dropzone = document.getElementById('dropzone');
const inputArchivo = document.getElementById('hojaVida');
const fileInfo = document.getElementById('file-info');
const botonQuitar = document.getElementById('file-remove');
const submitBtn = document.getElementById('submit-btn');
const exito = document.getElementById('registro-exito');

const limpiar = (valor) => valor.trim().replace(/\s+/g, ' ');

// ---------- Reglas de validación (las mismas que usa el servidor) ----------
const reglas = {
  nombre(valor) {
    const v = limpiar(valor);
    if (!v) return 'El nombre completo es obligatorio.';
    if (v.length < 3 || v.length > 100) return 'El nombre debe tener entre 3 y 100 caracteres.';
    if (!REGEX_NOMBRE.test(v)) return 'El nombre solo puede contener letras y espacios.';
    return '';
  },
  correo(valor) {
    const v = valor.trim();
    if (!v) return 'El correo electrónico es obligatorio.';
    if (v.length > 254 || !REGEX_CORREO.test(v)) return 'Ingresa un correo válido, por ejemplo nombre@correo.com.';
    return '';
  },
  carrera(valor) {
    const v = limpiar(valor);
    if (!v) return 'La carrera universitaria es obligatoria.';
    if (v.length < 3 || v.length > 100) return 'La carrera debe tener entre 3 y 100 caracteres.';
    return '';
  },
  semestre(valor) {
    const n = Number(valor);
    if (!valor) return 'Selecciona tu semestre actual.';
    if (!Number.isInteger(n) || n < 1 || n > 12) return 'El semestre debe estar entre 1 y 12.';
    return '';
  },
  async hojaVida() {
    const archivo = inputArchivo.files[0];
    if (!archivo) return 'Adjunta tu hoja de vida en PDF.';
    if (!archivo.name.toLowerCase().endsWith('.pdf')) return 'La hoja de vida debe ser un archivo PDF.';
    if (archivo.size > MAX_BYTES) return `El archivo pesa ${formatearTamano(archivo.size)}. El máximo es ${MAX_MB} MB.`;
    // Un PDF real siempre empieza con "%PDF-", aunque le cambien la extensión.
    const cabecera = await archivo.slice(0, 5).text();
    if (cabecera !== '%PDF-') return 'El archivo no parece ser un PDF válido.';
    return '';
  },
};

// ---------- Mostrar y limpiar errores ----------
function marcarCampo(campo, mensaje) {
  const error = document.getElementById(`${campo}-error`);
  error.textContent = mensaje;

  if (campo === 'hojaVida') {
    dropzone.classList.toggle('is-invalid', Boolean(mensaje));
    fileInfo.classList.toggle('is-invalid', Boolean(mensaje));
    inputArchivo.setAttribute('aria-invalid', String(Boolean(mensaje)));
  } else {
    form.elements[campo].setAttribute('aria-invalid', String(Boolean(mensaje)));
  }
}

async function validarCampo(campo) {
  const mensaje = await reglas[campo](form.elements[campo]?.value ?? '');
  marcarCampo(campo, mensaje);
  // Cuando el usuario corrige todo, el aviso general ya no tiene sentido.
  if (!alerta.hidden && !form.querySelector('[aria-invalid="true"]')) ocultarAlerta();
  return mensaje;
}

async function validarTodo() {
  const campos = Object.keys(reglas);
  const mensajes = await Promise.all(campos.map(validarCampo));
  return campos.filter((_, i) => mensajes[i]);
}

function mostrarAlerta(mensaje) {
  alerta.textContent = mensaje;
  alerta.hidden = false;
}

function ocultarAlerta() {
  alerta.hidden = true;
  alerta.textContent = '';
}

function enfocarCampo(campo) {
  if (campo === 'hojaVida') {
    // Si ya hay un archivo elegido, la zona de carga está oculta: se enfoca "Quitar".
    (dropzone.hidden ? botonQuitar : inputArchivo).focus();
    return;
  }
  form.elements[campo]?.focus();
}

// Valida al salir del campo, y mientras escribe solo si ya tenía un error.
for (const campo of ['nombre', 'correo', 'carrera', 'semestre']) {
  const input = form.elements[campo];
  input.addEventListener('blur', () => validarCampo(campo));
  input.addEventListener(campo === 'semestre' ? 'change' : 'input', () => {
    if (input.getAttribute('aria-invalid') === 'true') validarCampo(campo);
  });
}

// ---------- Archivo: selección, arrastrar y soltar, quitar ----------
function formatearTamano(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function actualizarVistaArchivo() {
  const archivo = inputArchivo.files[0];
  fileInfo.hidden = !archivo;
  dropzone.hidden = Boolean(archivo);
  if (archivo) {
    document.getElementById('file-name').textContent = archivo.name;
    document.getElementById('file-size').textContent = formatearTamano(archivo.size);
  }
}

inputArchivo.addEventListener('change', () => {
  actualizarVistaArchivo();
  validarCampo('hojaVida');
});

['dragenter', 'dragover'].forEach((evento) =>
  dropzone.addEventListener(evento, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  }),
);

['dragleave', 'drop'].forEach((evento) =>
  dropzone.addEventListener(evento, () => dropzone.classList.remove('is-dragover')),
);

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  const archivo = e.dataTransfer.files[0];
  if (!archivo) return;
  const transferencia = new DataTransfer();
  transferencia.items.add(archivo);
  inputArchivo.files = transferencia.files;
  inputArchivo.dispatchEvent(new Event('change'));
});

botonQuitar.addEventListener('click', () => {
  inputArchivo.value = '';
  actualizarVistaArchivo();
  marcarCampo('hojaVida', '');
  inputArchivo.focus();
});

// ---------- Envío ----------
function setCargando(cargando) {
  submitBtn.disabled = cargando;
  document.getElementById('submit-spinner').hidden = !cargando;
  document.getElementById('submit-text').textContent = cargando ? 'Enviando…' : 'Enviar postulación';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarAlerta();

  const invalidos = await validarTodo();
  if (invalidos.length > 0) {
    mostrarAlerta('Revisa los campos marcados antes de enviar.');
    enfocarCampo(invalidos[0]);
    return;
  }

  setCargando(true);
  try {
    const respuesta = await fetch('/api/practicantes', { method: 'POST', body: new FormData(form) });
    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.ok) {
      mostrarExito(datos);
      return;
    }

    // El servidor devuelve los errores por campo: se muestran en el mismo lugar.
    const detalles = datos.detalles ?? {};
    Object.entries(detalles).forEach(([campo, mensaje]) => {
      if (campo in reglas) marcarCampo(campo, mensaje);
    });
    mostrarAlerta(datos.error ?? 'No fue posible enviar tu postulación. Intenta de nuevo.');
    const primero = Object.keys(detalles).find((campo) => campo in reglas);
    if (primero) enfocarCampo(primero);
  } catch {
    mostrarAlerta('No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
  } finally {
    setCargando(false);
  }
});

// ---------- Éxito y nuevo registro ----------
function mostrarExito(practicante) {
  document.getElementById('exito-nombre').textContent = practicante.nombre ?? '';
  form.hidden = true;
  exito.hidden = false;
  exito.focus();
}

document.getElementById('nuevo-registro').addEventListener('click', () => {
  form.reset();
  Object.keys(reglas).forEach((campo) => marcarCampo(campo, ''));
  actualizarVistaArchivo();
  exito.hidden = true;
  form.hidden = false;
  form.elements.nombre.focus();
});
