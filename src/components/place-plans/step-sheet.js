// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/step-sheet.js
// Modo "hoja" de la pantalla por pasos (step-screen.js con sheet: true):
// los mismos pasos, pero dentro de una hoja que sube desde abajo, con
// fondo oscurecido y jaladera arriba. Alto fijo: llega hasta justo
// debajo de la barra de estado (no cambia de alto entre pasos, así no
// brinca). Se cierra tocando lo oscuro o jalando la hoja hacia abajo.
//
// Uso:
//   attachSheet(root, close, '.barra-de-arriba') → { remove() }   (step-screen.js)
//   openSheetPage({ title, right, html, foot, onClose, onBack })    (my-plan.js, plans-here.js)
//     → la misma hoja de "Planear visita" con cualquier contenido:
//       barra arriba (botón redondo atrás · título · algo a la derecha),
//       contenido que se desliza y un pie fijo. Devuelve
//       { root, body, foot, close, relayout }. onBack() → true = ya lo manejé
//       (p. ej. regresar del detalle a la lista) y la hoja no se cierra.
// Estilos: /styles/plan-steps.css (#wp-st.sheet, .wp-st-scrim, .wp-st-grab)
// ════════════════════════════════════════════════════════════════════

import { addElastic } from '/src/components/place-plans/elastic.js';
import { attachPulse } from '/src/components/place-plans/pulse.js';

const CLOSE_PX = 110;   // jalar más de esto hacia abajo = cerrar
// Mismo ícono que el "Volver" de la ficha (círculo negro con flecha)
export const ICON_BACK = '<svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" style="transform:scaleX(-1)"><path d="M464 256c0-114.87-93.13-208-208-208S48 141.13 48 256s93.13 208 208 208 208-93.13 208-208Zm-228.5 91.36a16 16 0 0 1-.09-22.63L303.58 272H170a16 16 0 0 1 0-32h133.58l-52.32-52.73A16 16 0 1 1 274 164.73l79.39 80a16 16 0 0 1 0 22.54l-79.39 80A16 16 0 0 1 235.5 347.36Z"/></svg>';

export function attachSheet(root, close, handleSel = '.wp-st-top') {
  root.classList.add('sheet');
  const scrim = document.createElement('div');
  scrim.className = 'wp-st-scrim';
  document.body.insertBefore(scrim, root);
  void scrim.offsetWidth;   // que arranque transparente antes de oscurecer
  scrim.classList.add('in');
  scrim.addEventListener('click', () => close());
  const top = root.querySelector(handleSel);
  top.insertAdjacentHTML('afterbegin', '<i class="wp-st-grab" aria-hidden="true"></i>');
  dragToClose(root, top, close);

  return {
    remove() { scrim.classList.remove('in'); setTimeout(() => scrim.remove(), 340); },
  };
}

export function openSheetPage({ title = '', right = '', html = '', foot = '', onClose, onBack }) {
  const root = document.createElement('div');
  root.id = 'wp-st';
  root.innerHTML = `
    <header class="wp-st-top">
      <button type="button" class="wp-st-back" data-a="close" aria-label="Cerrar">${ICON_BACK}</button>
      <span class="wp-st-count wp-st-title">${title}</span>
      ${right || '<span></span>'}
    </header>
    <div class="wp-st-vp"><div class="wp-st-page">${html}</div></div>
    <footer class="wp-st-foot"${foot ? '' : ' hidden'}>${foot}</footer>`;
  document.body.appendChild(root);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.classList.remove('in');
    sh.remove();
    setTimeout(() => root.remove(), 340);
    onClose?.();
  };
  const sh = attachSheet(root, close);
  const ft = root.querySelector('.wp-st-foot');
  const relayout = () => {
    ft.hidden = !ft.innerHTML.trim();
    root.style.setProperty('--st-top', `${root.querySelector('.wp-st-top').offsetHeight}px`);
    root.style.setProperty('--st-foot', `${ft.hidden ? 24 : ft.offsetHeight}px`);
  };
  relayout();
  addElastic(root.querySelector('.wp-st-vp'), 'y');
  attachPulse(root);
  root.querySelector('[data-a="close"]').addEventListener('click', () => { if (!onBack?.()) close(); });
  void root.offsetHeight;   // fijar el estilo inicial antes de animar (que no brinque)
  root.classList.add('in');
  return { root, body: root.querySelector('.wp-st-page'), foot: ft, close, relayout };
}

// Jalar la barra de arriba hacia abajo: la hoja sigue al dedo y si pasa
// del límite se cierra; si no, regresa con resorte
function dragToClose(root, handle, close) {
  let y0 = null, dy = 0;
  handle.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    y0 = e.touches[0].clientY; dy = 0;
    root.style.transition = 'none';
  }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    root.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  const end = () => {
    if (y0 == null) return;
    y0 = null;
    root.style.transition = '';
    root.style.transform = '';
    if (dy > CLOSE_PX) close();
  };
  handle.addEventListener('touchend', end, { passive: true });
  handle.addEventListener('touchcancel', end, { passive: true });
}
