// Panel del analista: lista los practicantes, permite filtrarlos y buscarlos,
// ver el detalle de cada uno y marcarlo como viable o no viable.
// Todo el contenido se inserta con textContent, nunca con innerHTML, para que
// los datos que escriben los practicantes no se puedan ejecutar como código (XSS).

const ETIQUETAS = { pendiente: 'Pendiente', viable: 'Viable', no_viable: 'No viable' };
const ESTADOS = Object.keys(ETIQUETAS);

const estado = {
  practicantes: [],
  filtro: 'todos',
  busqueda: '',
  abiertoId: null,
  ultimoFoco: null,
};

const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------
function el(tag, props = {}, hijos = []) {
  const nodo = document.createElement(tag);
  for (const [clave, valor] of Object.entries(props)) {
    if (clave === 'class') nodo.className = valor;
    else if (clave === 'text') nodo.textContent = valor;
    else if (clave.startsWith('data-') || clave.startsWith('aria-')) nodo.setAttribute(clave, valor);
    else nodo[clave] = valor;
  }
  for (const hijo of [].concat(hijos)) if (hijo) nodo.append(hijo);
  return nodo;
}

function icono(tipo) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', tipo === 'ok' ? 'M20 6 9 17l-5-5' : 'M18 6 6 18M6 6l12 12');
  svg.append(path);
  return svg;
}

// SQLite guarda las fechas en UTC con el formato "AAAA-MM-DD HH:MM:SS".
const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const formatoFechaHora = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' });
const aFecha = (texto) => new Date(`${texto.replace(' ', 'T')}Z`);

// Quita tildes y mayúsculas para que "jose" encuentre a "José".
const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function etiquetaEstado(valor) {
  return el('span', { class: `st st-${valor}`, text: ETIQUETAS[valor] });
}

// ---------- API ----------
async function api(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers ?? {}) },
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error ?? `Error ${respuesta.status}`);
  return datos;
}

async function cargar() {
  $('cargando').hidden = false;
  $('error').hidden = true;
  $('tabla').hidden = true;
  try {
    estado.practicantes = await api('/api/practicantes');
    $('tabla').hidden = false;
    pintar();
  } catch (error) {
    $('error-msg').textContent = `${error.message} Revisa que el servidor esté encendido.`;
    $('error').hidden = false;
  } finally {
    $('cargando').hidden = true;
  }
}

async function cambiarEstado(id, nuevoEstado, { deshacer = true } = {}) {
  const practicante = estado.practicantes.find((p) => p.id === id);
  if (!practicante || practicante.estado === nuevoEstado) return;
  const anterior = practicante.estado;

  const foco = recordarFoco();
  bloquearDecisiones(id, true);
  try {
    const actualizado = await api(`/api/practicantes/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    Object.assign(practicante, actualizado);
    pintar();
    const mensaje =
      nuevoEstado === 'pendiente'
        ? `${practicante.nombre} volvió a pendiente.`
        : `${practicante.nombre} quedó como ${ETIQUETAS[nuevoEstado].toLowerCase()}.`;
    mostrarAviso(mensaje, deshacer ? () => cambiarEstado(id, anterior, { deshacer: false }) : null);
  } catch (error) {
    mostrarAviso(`No se pudo actualizar el estado. ${error.message}`, null, true);
  } finally {
    bloquearDecisiones(id, false);
    devolverFoco(foco);
  }
}

// ---------- Pintar la vista ----------
function filtrados() {
  const termino = normalizar(estado.busqueda.trim());
  return estado.practicantes.filter((p) => {
    if (estado.filtro !== 'todos' && p.estado !== estado.filtro) return false;
    if (!termino) return true;
    return normalizar(`${p.nombre} ${p.correo} ${p.carrera}`).includes(termino);
  });
}

function pintarCifras() {
  const total = estado.practicantes.length;
  const conteo = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  estado.practicantes.forEach((p) => (conteo[p.estado] += 1));

  $('fig-total').textContent = total;
  $('nav-count').textContent = total;
  $('n-todos').textContent = total;
  for (const e of ESTADOS) {
    $(`fig-${e}`).textContent = conteo[e];
    $(`n-${e}`).textContent = conteo[e];
    $(`pct-${e}`).textContent = total ? `${Math.round((conteo[e] / total) * 100)} % del total` : ' ';
  }
}

function botonDecision(p, valor) {
  const tipo = valor === 'viable' ? 'ok' : 'bad';
  const activo = p.estado === valor;
  const boton = el(
    'button',
    {
      type: 'button',
      class: `btn btn-decide btn-${tipo}`,
      'aria-pressed': String(activo),
      'data-decision': valor,
      title: activo ? 'Clic para volver a pendiente' : `Marcar como ${ETIQUETAS[valor].toLowerCase()}`,
    },
    [icono(tipo), el('span', { text: ETIQUETAS[valor] })],
  );
  boton.addEventListener('click', (evento) => {
    evento.stopPropagation(); // que no abra el detalle
    cambiarEstado(p.id, activo ? 'pendiente' : valor);
  });
  return boton;
}

function fila(p) {
  const tr = el('tr', { class: 'click', tabIndex: 0, 'data-id': p.id, 'aria-label': `Ver detalle de ${p.nombre}` }, [
    el('td', {}, [el('div', { class: 'name', text: p.nombre }), el('div', { class: 'sub', text: p.correo })]),
    el('td', { text: p.carrera }),
    el('td', { class: 'c num', text: p.semestre }),
    el('td', { class: 'nowrap', text: formatoFecha.format(aFecha(p.creadoEn)) }),
    el('td', {}, etiquetaEstado(p.estado)),
    el('td', { class: 'r' }, el('div', { class: 'actions' }, [botonDecision(p, 'viable'), botonDecision(p, 'no_viable')])),
  ]);
  if (p.id === estado.abiertoId) tr.classList.add('sel');
  tr.addEventListener('click', () => abrirDetalle(p.id));
  tr.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && evento.target === tr) abrirDetalle(p.id);
  });
  return tr;
}

function pintarVacio(lista) {
  const vacio = $('vacio');
  const accion = $('vacio-accion');
  vacio.hidden = lista.length > 0;
  if (lista.length > 0) return;

  if (estado.practicantes.length === 0) {
    $('vacio-titulo').textContent = 'Aún no hay postulaciones';
    $('vacio-texto').textContent = 'Cuando un practicante se registre, aparecerá aquí.';
    accion.textContent = 'Abrir formulario de registro';
    accion.href = '/';
    accion.onclick = null;
  } else {
    $('vacio-titulo').textContent = 'Ningún practicante coincide';
    $('vacio-texto').textContent = 'Prueba con otra búsqueda o cambia el filtro de estado.';
    accion.textContent = 'Limpiar filtros';
    accion.href = '#';
    accion.onclick = (evento) => {
      evento.preventDefault();
      $('buscar').value = '';
      estado.busqueda = '';
      elegirFiltro('todos');
    };
  }
}

// Al redibujar la tabla los botones se reemplazan y el foco se pierde. Estas dos
// funciones lo recuerdan y lo devuelven al mismo control, para quien usa teclado.
function recordarFoco() {
  const activo = document.activeElement;
  if (!activo || activo === document.body) return null;
  const filaActiva = activo.closest('#filas tr');
  if (filaActiva) return { fila: filaActiva.dataset.id, decision: activo.dataset.decision };
  return activo.id ? { id: activo.id } : null;
}

function devolverFoco(foco) {
  if (!foco) return;
  let destino;
  if (foco.id) destino = $(foco.id);
  else {
    const filaNueva = document.querySelector(`#filas tr[data-id="${foco.fila}"]`);
    destino = foco.decision ? filaNueva?.querySelector(`[data-decision="${foco.decision}"]`) : filaNueva;
  }
  if (destino && !destino.hidden && !destino.disabled) destino.focus();
}

function pintar() {
  const foco = recordarFoco();

  pintarCifras();
  const lista = filtrados();
  $('filas').replaceChildren(...lista.map(fila));

  devolverFoco(foco);
  pintarVacio(lista);
  $('resultado').textContent = estado.practicantes.length
    ? `Mostrando ${lista.length} de ${estado.practicantes.length}`
    : '';
  if (estado.abiertoId) pintarDetalle();
}

function bloquearDecisiones(id, bloqueado) {
  document.querySelectorAll(`tr[data-id="${id}"] [data-decision]`).forEach((b) => (b.disabled = bloqueado));
  if (estado.abiertoId === id) {
    ESTADOS.forEach((e) => ($(`d-${e}`).disabled = bloqueado));
  }
}

// ---------- Filtros y búsqueda ----------
function elegirFiltro(valor) {
  estado.filtro = valor;
  document.querySelectorAll('[data-filtro]').forEach((boton) => {
    const activo = boton.dataset.filtro === valor;
    boton.classList.toggle('on', activo);
    boton.setAttribute('aria-pressed', String(activo));
  });
  pintar();
}

document.querySelectorAll('[data-filtro]').forEach((boton) =>
  boton.addEventListener('click', () => elegirFiltro(boton.dataset.filtro)),
);

$('buscar').addEventListener('input', (evento) => {
  estado.busqueda = evento.target.value;
  pintar();
});

$('reintentar').addEventListener('click', cargar);

// ---------- Detalle (drawer) ----------
function pintarDetalle() {
  const p = estado.practicantes.find((x) => x.id === estado.abiertoId);
  if (!p) return cerrarDetalle();

  $('d-id').textContent = p.id;
  $('d-nombre').textContent = p.nombre;
  $('d-correo').textContent = p.correo;
  $('d-estado').className = `st st-${p.estado}`;
  $('d-estado').textContent = ETIQUETAS[p.estado];
  $('d-nombre-dd').textContent = p.nombre;
  $('d-correo-dd').textContent = p.correo;
  $('d-carrera').textContent = p.carrera;
  $('d-semestre').textContent = `${p.semestre}.º semestre`;
  $('d-creado').textContent = formatoFechaHora.format(aFecha(p.creadoEn));
  $('d-actualizado').textContent = formatoFechaHora.format(aFecha(p.actualizadoEn));
  $('d-archivo').textContent = p.hojaVidaNombre;

  $('d-pendiente').hidden = p.estado === 'pendiente';
  $('d-viable').setAttribute('aria-pressed', String(p.estado === 'viable'));
  $('d-no_viable').setAttribute('aria-pressed', String(p.estado === 'no_viable'));
}

function abrirDetalle(id) {
  estado.ultimoFoco = id;
  estado.abiertoId = id;
  pintar();
  $('scrim').hidden = false;
  $('drawer').hidden = false;
  document.body.classList.add('con-detalle');
  $('drawer').focus();
}

function cerrarDetalle() {
  estado.abiertoId = null;
  $('scrim').hidden = true;
  $('drawer').hidden = true;
  document.body.classList.remove('con-detalle');
  document.querySelectorAll('tr.sel').forEach((tr) => tr.classList.remove('sel'));
  // Devuelve el foco a la fila desde la que se abrió, para quien navega con teclado.
  // Se busca por id porque la fila pudo redibujarse mientras el detalle estaba abierto.
  document.querySelector(`#filas tr[data-id="${estado.ultimoFoco}"]`)?.focus();
}

$('d-cerrar').addEventListener('click', cerrarDetalle);
$('scrim').addEventListener('click', cerrarDetalle);
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && !$('drawer').hidden) cerrarDetalle();
});

ESTADOS.forEach((valor) =>
  $(`d-${valor}`).addEventListener('click', () => {
    const p = estado.practicantes.find((x) => x.id === estado.abiertoId);
    if (!p) return;
    // En el detalle, "Viable" y "No viable" funcionan igual que en la tabla.
    const destino = valor !== 'pendiente' && p.estado === valor ? 'pendiente' : valor;
    cambiarEstado(p.id, destino);
  }),
);

// ---------- Aviso con "Deshacer" ----------
let temporizadorAviso;

function mostrarAviso(mensaje, alDeshacer, esError = false) {
  const aviso = $('toast');
  const botonDeshacer = $('toast-deshacer');
  $('toast-msg').textContent = mensaje;
  aviso.classList.toggle('bad', esError);
  botonDeshacer.hidden = !alDeshacer;
  botonDeshacer.onclick = alDeshacer
    ? () => {
        ocultarAviso();
        alDeshacer();
      }
    : null;
  aviso.classList.add('on');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(ocultarAviso, 6000);
}

function ocultarAviso() {
  $('toast').classList.remove('on');
}

cargar();
