// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/focus-zoom.js
// Al tocar un campo de texto, el campo "sale" con un zoom hacia el
// centro del espacio libre (entre la barra de estado y el teclado) y lo
// de atrás queda borroso, para escribir sin distracciones.
//
// Cómo: se abre una capa con una copia del campo y el cursor pasa a la
// copia (pasar de un campo a otro no cierra el teclado). Lo que escribes
// se copia al campo original con un evento 'input'. Se cierra con
// "Listo", Enter (en campos de una línea), tocando lo borroso o al
// bajar el teclado.
//
// Uso: attachFocusZoom(root)  → solo campos con [data-zoom]
// Estilos: /styles/plan-steps.css (.wp-fz-*)
// ════════════════════════════════════════════════════════════════════

const GAP = 14;

const safeArea = () => {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
  document.body.appendChild(p);
  const top = parseFloat(getComputedStyle(p).paddingTop) || 0;
  p.remove();
  return top;
};

export function attachFocusZoom(root) {
  root.addEventListener('focusin', (e) => {
    const src = e.target;
    if (!src.matches?.('input[data-zoom], textarea[data-zoom]') || src._wpZoomOpen) return;
    open(src);
  });
}

function open(src) {
  src._wpZoomOpen = true;
  const from = src.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'wp-fz';
  const field = document.createElement(src.tagName.toLowerCase());
  ['type', 'placeholder', 'maxlength', 'rows', 'autocapitalize', 'autocomplete', 'enterkeyhint'].forEach(a => { if (src.hasAttribute(a)) field.setAttribute(a, src.getAttribute(a)); });
  field.className = 'wp-fz-field' + (src.tagName === 'TEXTAREA' ? ' area' : '');
  field.value = src.value;
  const max = +src.getAttribute('maxlength') || 0;
  layer.innerHTML = `<div class="wp-fz-card"><div class="wp-fz-top">${src.dataset.zoom ? `<span>${src.dataset.zoom}</span>` : '<span></span>'}${max ? `<small class="wp-fz-n"></small>` : ''}</div><div class="wp-fz-slot"></div><button type="button" class="wp-fz-done">Listo</button></div>`;
  layer.querySelector('.wp-fz-slot').appendChild(field);
  document.body.appendChild(layer);
  const card = layer.querySelector('.wp-fz-card'), count = layer.querySelector('.wp-fz-n');
  const safeTop = safeArea();
  let kbSeen = false, closed = false;

  const paintCount = () => { if (count) count.textContent = `${field.value.length}/${max}`; };
  // Centrar la tarjeta en el espacio libre (barra de estado ↔ teclado)
  const place = (animate = true) => {
    const vv = window.visualViewport;
    const top = (vv?.offsetTop || 0) + safeTop + GAP;
    const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - GAP;
    const h = card.offsetHeight;
    const y = Math.max(top, top + (bottom - top - h) / 2);
    card.style.transition = animate ? 'top 0.32s cubic-bezier(0.32, 0.72, 0, 1)' : 'none';
    card.style.top = `${y}px`;
    if (vv && window.innerHeight - vv.height > 120) kbSeen = true;
    else if (kbSeen && !closed) close();   // bajó el teclado → listo
  };
  // Zoom desde donde estaba el campo (FLIP)
  place(false);
  const to = card.getBoundingClientRect();
  const sx = Math.min(1, from.width / to.width), dy = from.top - to.top;
  card.animate([
    { transform: `translateY(${dy}px) scale(${sx})`, opacity: 0.6 },
    { transform: 'none', opacity: 1 },
  ], { duration: 380, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
  requestAnimationFrame(() => layer.classList.add('in'));

  // el foco pasa a la copia después del evento de foco del original
  setTimeout(() => {
    try { field.focus({ preventScroll: true }); } catch (_) { field.focus(); }
    try { const n = field.value.length; field.setSelectionRange(n, n); } catch (_) {}
  }, 0);
  paintCount();

  field.addEventListener('input', () => {
    src.value = field.value;
    src.dispatchEvent(new Event('input', { bubbles: true }));
    paintCount();
  });
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter' && field.tagName === 'INPUT') { e.preventDefault(); close(); } });
  layer.addEventListener('pointerdown', (e) => { if (e.target === layer) { e.preventDefault(); close(); } });
  layer.querySelector('.wp-fz-done').addEventListener('click', close);
  const onVv = () => place(true);
  window.visualViewport?.addEventListener('resize', onVv);
  window.addEventListener('resize', onVv);

  function close() {
    if (closed) return;
    closed = true;
    window.visualViewport?.removeEventListener('resize', onVv);
    window.removeEventListener('resize', onVv);
    src.value = field.value;
    src.dispatchEvent(new Event('input', { bubbles: true }));
    field.blur();
    layer.classList.remove('in');
    card.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(0.92)', opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => { layer.remove(); src._wpZoomOpen = false; }, 220);
  }
}
