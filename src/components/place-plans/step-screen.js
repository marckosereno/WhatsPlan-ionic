// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/step-screen.js
// Pantalla completa "por pasos": una pregunta grande por pantalla,
// "2 de 4" arriba, "Omitir" en los pasos opcionales y un botón redondo
// con anillo de progreso abajo (en el último paso se abre en píldora
// con el texto final). La usan "Planear visita" y "Nueva parada".
//
// Uso:
//   const s = openStepScreen({
//     steps: [{ title, sub, mount(el), valid?(), optional?, onEnter?() }],
//     doneLabel: 'Crear plan',
//     onDone: async () => true,   // true = cerrar
//     onClose: () => {},
//   });
//   s.refresh()   → vuelve a revisar si el paso actual se puede pasar
//   s.root, s.go(i), s.close(), s.showDone(html)
// Estilos: /styles/plan-steps.css (#wp-st, .wp-st-*)
// ════════════════════════════════════════════════════════════════════

// Mismo ícono que el "Volver" de la ficha (círculo negro con flecha)
import { addElastic } from '/src/components/place-plans/elastic.js';
import { attachFocusZoom } from '/src/components/place-plans/focus-zoom.js';

const ICON_BACK = '<svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" style="transform:scaleX(-1)"><path d="M464 256c0-114.87-93.13-208-208-208S48 141.13 48 256s93.13 208 208 208 208-93.13 208-208Zm-228.5 91.36a16 16 0 0 1-.09-22.63L303.58 272H170a16 16 0 0 1 0-32h133.58l-52.32-52.73A16 16 0 1 1 274 164.73l79.39 80a16 16 0 0 1 0 22.54l-79.39 80A16 16 0 0 1 235.5 347.36Z"/></svg>';
const ICON_NEXT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const RING_R = 36;
const RING_C = 2 * Math.PI * RING_R;

export function openStepScreen({ steps, doneLabel = 'Listo', onDone, onClose, haptic = () => {} }) {
  let i = 0, busy = false;
  const root = document.createElement('div');
  root.id = 'wp-st';
  root.innerHTML = `
    <header class="wp-st-top">
      <button type="button" class="wp-st-back" data-a="back" aria-label="Volver">${ICON_BACK}</button>
      <span class="wp-st-count"></span>
      <button type="button" class="wp-st-skip" data-a="skip">Omitir</button>
    </header>
    <div class="wp-st-vp"><div class="wp-st-track">
      ${steps.map((s, k) => `<section class="wp-st-step" data-k="${k}">
        <h1>${s.title}</h1>${s.sub ? `<p class="wp-st-sub">${s.sub}</p>` : ''}<div class="wp-st-body"></div>
      </section>`).join('')}
    </div></div>
    <footer class="wp-st-foot">
      <button type="button" class="wp-st-next" data-a="next" aria-label="Siguiente">
        <svg class="wp-st-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="${RING_R}" class="bg"/><circle cx="40" cy="40" r="${RING_R}" class="fg" stroke-dasharray="${RING_C}"/></svg>
        <span class="wp-st-next-in">${ICON_NEXT}<b>${doneLabel}</b></span>
      </button>
    </footer>`;
  document.body.appendChild(root);
  const $ = (q) => root.querySelector(q);
  const secs = [...root.querySelectorAll('.wp-st-step')];
  // El contenido va centrado en el espacio libre entre la barra de arriba
  // y el botón de abajo (los dos flotan encima y el contenido pasa por debajo)
  const layout = () => {
    if (!root.isConnected) { window.visualViewport?.removeEventListener('resize', layout); window.removeEventListener('resize', layout); return; }
    const top = $('.wp-st-top')?.offsetHeight || 0, foot = $('.wp-st-foot')?.offsetHeight || 0;
    const vp = $('.wp-st-vp');
    root.style.setProperty('--st-top', `${top}px`);
    root.style.setProperty('--st-foot', `${foot}px`);
    root.style.setProperty('--st-area', `${Math.max(0, vp.clientHeight - top - foot)}px`);
  };
  window.visualViewport?.addEventListener('resize', layout);
  window.addEventListener('resize', layout);
  // El contenedor solo se desliza en vertical: si algo lo corre de lado
  // (un foco, un elemento más ancho), se regresa al instante
  $('.wp-st-vp').addEventListener('scroll', (e) => { if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0; }, { passive: true });
  // Rebote elástico en todos los scrolls (vertical y horizontales)
  addElastic($('.wp-st-vp'), 'y');
  root.querySelectorAll('.wp-st-days, .wp-st-chips:not(.wrap)').forEach(el => addElastic(el, 'x'));
  root.querySelectorAll('.wp-seats-people, .wp-st-list').forEach(el => addElastic(el, 'y'));
  // Campos de texto: zoom al centro con lo de atrás borroso
  attachFocusZoom(root);
  secs.forEach((sec, k) => steps[k].mount?.(sec.querySelector('.wp-st-body'), sec));

  const refresh = () => {
    const s = steps[i], last = i === steps.length - 1;
    $('.wp-st-count').textContent = `${i + 1} de ${steps.length}`;
    const opt = typeof s.optional === 'function' ? s.optional() : s.optional;
    $('[data-a="skip"]').hidden = !opt || last;
    const next = $('.wp-st-next');
    next.classList.toggle('last', last);
    const was = next.disabled;
    next.disabled = busy || (s.valid ? !s.valid() : false);
    // se puede seguir → "gota" que late una vez para invitar a tocar
    if (was && !next.disabled) { next.classList.remove('ready'); void next.offsetWidth; next.classList.add('ready'); }
    next.setAttribute('aria-label', last ? doneLabel : 'Siguiente');
    $('.wp-st-ring .fg').style.strokeDashoffset = String(RING_C * (1 - (i + 1) / steps.length));
  };
  const go = (k) => {
    i = Math.max(0, Math.min(steps.length - 1, k));
    $('.wp-st-track').style.transform = `translateX(${-i * 100}%)`;
    secs.forEach((sec, n) => { sec.inert = n !== i; sec.classList.toggle('on', n === i); });
    // entrada: título y contenido suben en cascada con rebote
    secs[i].classList.remove('enter'); void secs[i].offsetWidth; secs[i].classList.add('enter');
    root.querySelector('.wp-st-vp').scrollTop = 0;
    steps[i].onEnter?.();
    refresh();
    layout();
  };
  const close = () => {
    root.classList.remove('in');
    setTimeout(() => root.remove(), 340);
    onClose?.();
  };
  const finish = async () => {
    busy = true; refresh(); $('.wp-st-next').classList.add('busy');
    let ok = false;
    try { ok = await onDone?.(); } catch (_) { ok = false; }
    busy = false; $('.wp-st-next').classList.remove('busy');
    if (ok === true) close(); else refresh();
  };
  // Efecto "agua": onda que sale de donde tocas cualquier botón
  const unpress = (e) => { const b = e.target.closest?.('button.press'); root.querySelectorAll('button.press').forEach(x => x.classList.remove('press')); };
  root.addEventListener('pointerup', unpress);
  root.addEventListener('pointercancel', unpress);
  root.addEventListener('pointerleave', unpress);
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (!b.classList.contains('wp-dial-it')) b.classList.add('press');
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    const w = document.createElement('i');
    w.className = 'wp-st-ripple';
    w.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = b.classList.contains('wp-st-next') ? '' : 'hidden';
    (b.querySelector('.wp-st-next-in') || b).appendChild(w);
    setTimeout(() => w.remove(), 650);
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'back') { haptic('light'); i ? go(i - 1) : close(); }
    else if (a === 'skip') { haptic('light'); go(i + 1); }
    else if (a === 'next') { haptic('light'); i < steps.length - 1 ? go(i + 1) : finish(); }
  });

  go(0);
  requestAnimationFrame(() => root.classList.add('in'));
  return {
    root, refresh, go, close,
    get index() { return i; },
    // Reemplaza todo por una pantalla final (ej. "¡Plan creado!")
    showDone(html) {
      i = 0;
      root.classList.add('done');
      $('.wp-st-vp').innerHTML = `<div class="wp-st-done">${html}</div>`;
      $('.wp-st-foot').remove();
      layout();
      $('.wp-st-count').textContent = '';
      $('[data-a="skip"]').hidden = true;
      return $('.wp-st-done');
    },
  };
}
