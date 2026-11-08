// Tema claro / oscuro. Se carga en el <head> sin "defer" para aplicar el tema
// antes de pintar la página y evitar un parpadeo. Por defecto abre en claro.
// La preferencia se guarda en el navegador; si no hay almacenamiento disponible,
// el cambio vale solo para esta visita.
(function () {
  const CLAVE = 'tema';
  const raiz = document.documentElement;

  function leerTema() {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      if (guardado === 'light' || guardado === 'dark') return guardado;
    } catch {
      // Almacenamiento bloqueado: se usa el tema por defecto.
    }
    return 'light';
  }

  function aplicarTema(tema) {
    raiz.setAttribute('data-theme', tema);
    try {
      window.localStorage.setItem(CLAVE, tema);
    } catch {
      // Sin almacenamiento: el tema se aplica solo en esta visita.
    }
    document.querySelectorAll('[data-theme-toggle]').forEach(actualizarBoton);
  }

  function actualizarBoton(boton) {
    const oscuro = raiz.getAttribute('data-theme') === 'dark';
    const texto = oscuro ? 'Modo claro' : 'Modo oscuro';
    const etiqueta = boton.querySelector('[data-theme-label]');
    if (etiqueta) etiqueta.textContent = texto;
    boton.setAttribute('aria-label', `Cambiar a ${texto.toLowerCase()}`);
  }

  raiz.setAttribute('data-theme', leerTema());

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach((boton) => {
      actualizarBoton(boton);
      boton.addEventListener('click', () => {
        aplicarTema(raiz.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      });
    });
  });
})();
