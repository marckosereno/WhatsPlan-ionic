// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — tabs/tab-screen.js
// Pantalla completa de una sección de la barra de abajo (Planes, Social).
// Tapa el mapa y sus botones; la barra de abajo queda encima (clase
// body.wp-tab-open). Fondo con el degradado azul suave de arriba, el
// contenido se desliza con nuestro scroll (drag-scroll.js, con rebote).
// Una sola sección abierta a la vez: abrir otra cierra la anterior.
//
// Uso: openTabScreen(id, html) → { root, body, vp, close }
// Estilos: /styles/tabs.css (.wp-tab)
// ════════════════════════════════════════════════════════════════════
import { addDragScroll } from '/src/components/place-plans/drag-scroll.js';
import { attachPulse } from '/src/components/place-plans/pulse.js';

let current = null;

export function ensureCss(id, href) {
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id; l.rel = 'stylesheet'; l.href = href;
  document.head.appendChild(l);
}

export function closeTabScreens() {
  current?.close();
}

export function openTabScreen(id, html) {
  ensureCss('wp-tabs-css', '/styles/tabs.css');
  if (current?.id === id) return current;
  const prev = current;
  const root = document.createElement('section');
  root.className = 'wp-tab';
  root.id = `wp-tab-${id}`;
  root.innerHTML = `<div class="wp-tab-vp"><div class="wp-tab-page">${html}</div></div>`;
  document.body.appendChild(root);
  document.body.classList.add('wp-tab-open');
  const vp = root.querySelector('.wp-tab-vp');
  addDragScroll(vp);
  attachPulse(root);
  void root.offsetWidth;   // fijar el estilo inicial antes de animar
  root.classList.add('in');
  let closed = false;
  const scr = {
    id, root, vp, body: root.querySelector('.wp-tab-page'),
    close() {
      if (closed) return;
      closed = true;
      root.classList.remove('in');
      setTimeout(() => root.remove(), 300);
      if (current === scr) { current = null; document.body.classList.remove('wp-tab-open'); }
    },
  };
  current = scr;
  if (prev) setTimeout(() => prev.close(), 240);   // la nueva entra encima y luego se va la vieja
  return scr;
}
