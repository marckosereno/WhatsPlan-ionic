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

const ICON_BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
const ICON_NEXT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const RING_R = 36;
const RING_C = 2 * Math.PI * RING_R;

export function openStepScreen({ steps, doneLabel = 'Listo', onDone, onClose, haptic = () => {} }) {
  let i = 0, busy = false;
  const root = document.createElement('div');
  root.id = 'wp-st';
  root.innerHTML = `
    <header class="wp-st-top">
      <button type="button" class="wp-st-round" data-a="back" aria-label="Atrás">${ICON_BACK}</button>
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
  secs.forEach((sec, k) => steps[k].mount?.(sec.querySelector('.wp-st-body'), sec));

  const refresh = () => {
    const s = steps[i], last = i === steps.length - 1;
    $('.wp-st-count').textContent = `${i + 1} de ${steps.length}`;
    const opt = typeof s.optional === 'function' ? s.optional() : s.optional;
    $('[data-a="skip"]').hidden = !opt || last;
    const next = $('.wp-st-next');
    next.classList.toggle('last', last);
    next.disabled = busy || (s.valid ? !s.valid() : false);
    next.setAttribute('aria-label', last ? doneLabel : 'Siguiente');
    $('.wp-st-ring .fg').style.strokeDashoffset = String(RING_C * (1 - (i + 1) / steps.length));
  };
  const go = (k) => {
    i = Math.max(0, Math.min(steps.length - 1, k));
    $('.wp-st-track').style.transform = `translateX(${-i * 100}%)`;
    secs.forEach((sec, n) => { sec.inert = n !== i; sec.classList.toggle('on', n === i); });
    root.querySelector('.wp-st-vp').scrollTop = 0;
    steps[i].onEnter?.();
    refresh();
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
      $('.wp-st-count').textContent = '';
      $('[data-a="skip"]').hidden = true;
      return $('.wp-st-done');
    },
  };
}
