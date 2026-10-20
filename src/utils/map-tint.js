// ====================================================================
// WHATSPLAN — map-tint.js
// Color de las sombras de arriba y abajo del mapa (ion-app::before/after
// en app.css) según lo que estás haciendo:
//   búsqueda activa → azul · GPS en vivo → verde · si no, la categoría
//   abierta (restaurantes durazno, salud azul…) · sin nada → blanco.
// Solo pone body[data-wp-tint]; el CSS hace el fundido del color y un
// pequeño "respiro" al cambiar.
// ====================================================================
const state = { cat: null, gps: false, search: false };
let breathT = 0;

export function setMapTint(partial = {}) {
  Object.assign(state, partial);
  const key = state.search ? 'search' : state.gps ? 'gps' : (state.cat || '');
  const body = document.body;
  if (!body || (body.dataset.wpTint || '') === key) return;
  body.dataset.wpTint = key;
  // Respiro: la sombra se estira un poco y regresa
  body.classList.remove('wp-tint-breath');
  void body.offsetWidth;
  body.classList.add('wp-tint-breath');
  clearTimeout(breathT);
  breathT = setTimeout(() => body.classList.remove('wp-tint-breath'), 800);
}
