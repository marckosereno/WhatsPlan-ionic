// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/pulse.js
// Sensación "pulse" para todos los botones de una pantalla (como el
// buscador global): al tocar se encoge, y al soltar crece un poquito y
// regresa con resorte. Pasa igual al elegir que al quitar algo.
// También deja la onda de "agua" que sale de donde tocas.
//
// Si el clic hace que la pantalla se vuelva a dibujar (el botón tocado
// ya no existe), se busca su reemplazo por el mismo data-* y late ese.
//
// Uso:
//   attachPulse(root)        → todos los <button> dentro de root
//   pulse(el)                → hacer latir un elemento a mano
// Se salta los botones con [data-nopulse] y los del dial de emojis.
// Estilos: /styles/plan-steps.css (.wp-pulse, .press, .wp-st-ripple)
// ════════════════════════════════════════════════════════════════════

const KEYS = ['id', 'k', 'day', 't', 'r', 'c', 'g', 'n', 'd', 'vis', 'type', 'i', 'h', 'm', 'ap', 'a', 'x'];
const SKIP = '[data-nopulse], .wp-dial-it';

export function pulse(el, cls = 'wp-pulse') {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const off = () => { el.classList.remove(cls); el.removeEventListener('animationend', off); };
  el.addEventListener('animationend', off);
}

// El botón tocado, o el que lo reemplazó al volver a dibujar
function successor(b, scope) {
  if (b.isConnected) return b;
  const k = KEYS.find(x => b.dataset[x] != null);
  if (!k) return null;
  const attr = 'data-' + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  return scope.querySelector(`button[${attr}="${CSS.escape(b.dataset[k])}"]`);
}

function ripple(b, e) {
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
  const w = document.createElement('i');
  w.className = 'wp-st-ripple';
  w.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.classList.add('wp-rippled');
  (b.querySelector('.wp-st-next-in') || b).appendChild(w);
  setTimeout(() => w.remove(), 650);
}

export function attachPulse(root) {
  const unpress = () => root.querySelectorAll('button.press').forEach(x => x.classList.remove('press'));
  root.addEventListener('pointerup', unpress);
  root.addEventListener('pointercancel', unpress);
  root.addEventListener('pointerleave', unpress);
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || b.matches(SKIP)) return;
    b.classList.add('press');
    ripple(b, e);
  });
  // Va después de los clics de cada paso (que pueden volver a dibujar)
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.matches(SKIP)) return;
    const scope = e.target.closest?.('.wp-st-step, .wp-fz-card') || root;
    pulse(successor(b, scope.isConnected ? scope : root));
  });
}
