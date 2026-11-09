// Inicio de sesión del analista. Si ya hay una sesión activa, va directo al panel.

const form = document.getElementById('login-form');
const alerta = document.getElementById('login-alert');
const boton = document.getElementById('login-btn');
const inputPassword = document.getElementById('password');
const verPassword = document.getElementById('ver-password');

const MENSAJES = {
  usuario: 'Ingresa tu usuario.',
  password: 'Ingresa tu contraseña.',
};

function marcar(campo, mensaje) {
  document.getElementById(`${campo}-error`).textContent = mensaje;
  form.elements[campo].setAttribute('aria-invalid', String(Boolean(mensaje)));
}

function mostrarAlerta(mensaje) {
  alerta.textContent = mensaje;
  alerta.hidden = !mensaje;
}

function setCargando(cargando) {
  boton.disabled = cargando;
  document.getElementById('login-spinner').hidden = !cargando;
  document.getElementById('login-text').textContent = cargando ? 'Ingresando…' : 'Ingresar';
}

if (new URLSearchParams(window.location.search).get('sesion') === 'expirada') {
  mostrarAlerta('Tu sesión expiró. Ingresa de nuevo para continuar.');
}

// Si la sesión sigue activa, no tiene sentido volver a pedir la contraseña.
fetch('/api/auth/sesion')
  .then((r) => r.json())
  .then((sesion) => {
    if (sesion.autenticado) window.location.replace('/panel.html');
  })
  .catch(() => {});

for (const campo of Object.keys(MENSAJES)) {
  form.elements[campo].addEventListener('input', () => {
    if (form.elements[campo].getAttribute('aria-invalid') === 'true') marcar(campo, '');
  });
}

verPassword.addEventListener('click', () => {
  const visible = inputPassword.type === 'text';
  inputPassword.type = visible ? 'password' : 'text';
  verPassword.textContent = visible ? 'Mostrar' : 'Ocultar';
  verPassword.setAttribute('aria-pressed', String(!visible));
  inputPassword.focus();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarAlerta('');

  const datos = {
    usuario: form.elements.usuario.value.trim(),
    password: form.elements.password.value,
  };

  let primerError = null;
  for (const campo of Object.keys(MENSAJES)) {
    const mensaje = datos[campo] ? '' : MENSAJES[campo];
    marcar(campo, mensaje);
    if (mensaje && !primerError) primerError = campo;
  }
  if (primerError) {
    form.elements[primerError].focus();
    return;
  }

  setCargando(true);
  try {
    const respuesta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    if (respuesta.ok) {
      window.location.replace('/panel.html');
      return;
    }
    const cuerpo = await respuesta.json().catch(() => ({}));
    mostrarAlerta(cuerpo.error ?? 'No fue posible iniciar sesión. Intenta de nuevo.');
    // Por seguridad se borra la contraseña tras un intento fallido.
    form.elements.password.value = '';
    form.elements.password.focus();
  } catch {
    mostrarAlerta('No se pudo conectar con el servidor. Revisa que esté encendido.');
  } finally {
    setCargando(false);
  }
});
