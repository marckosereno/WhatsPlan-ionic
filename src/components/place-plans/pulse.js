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
// Estilos: /styles/plan-steps.css (.wp-pulse, .press, .wp-rip-clip, .wp-st-ripple)
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
  const host = b.querySelector('.wp-st-next-in') || b;
  const r = host.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
  const w = document.createElement('i');
  w.className = 'wp-st-ripple';
  w.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  // La onda va en una capa con la misma forma del botón (border-radius
  // heredado + máscara), así en botones redondos sale redonda y no
  // cuadrada, y el botón conserva su sombra
  let clip = host.querySelector(':scope > .wp-rip-clip');
  if (!clip) { clip = document.createElement('span'); clip.className = 'wp-rip-clip'; host.appendChild(clip); }
  b.classList.add('wp-rippled');
  clip.appendChild(w);
  setTimeout(() => w.remove(), 650);
}

// Encoger al tocar, pero sin pelear con el scroll: el botón se encoge
// solo si el dedo se queda quieto un instante (o al soltar, en un toque
// rápido). Si el dedo empieza a deslizar, se suelta suave, sin resorte
// (si no, el regreso se ve como un brinco en el scroll).
// Scroll lento: el dedo apenas se mueve al principio, así que cualquier
// movimiento (aunque sea poquito) antes del instante cancela el encogido.
const HOLD_MS = 130, MOVE_PX = 8, STILL_PX = 3;

export function attachPulse(root) {
  let cur = null;   // { b, x, y, e, t, on }
  const press = () => {
    if (!cur || cur.on) return;
    cur.on = true;
    cur.b.classList.toggle('wide', cur.b.offsetWidth > 220);
    cur.b.classList.add('press'); ripple(cur.b, cur.e);
  };
  const quiet = (b) => { b.classList.add('wp-quiet'); b.classList.remove('press'); setTimeout(() => b.classList.remove('wp-quiet'), 240); };
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || b.matches(SKIP)) return;
    cur = { b, x: e.clientX, y: e.clientY, e, on: false };
    cur.t = setTimeout(press, HOLD_MS);
  });
  root.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const d = Math.hypot(e.clientX - cur.x, e.clientY - cur.y);
    if (d < (cur.on ? MOVE_PX : STILL_PX)) return;
    clearTimeout(cur.t);
    if (cur.on) quiet(cur.b);
    cur = null;
  }, { passive: true });
  const up = (e) => {
    if (!cur) return;
    clearTimeout(cur.t);
    if (e.type === 'pointerup') press();   // toque rápido: también hay onda
    const b = cur.b; cur = null;
    if (e.type === 'pointerup') setTimeout(() => b.classList.remove('press'), 60); else quiet(b);
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  // Va después de los clics de cada paso (que pueden volver a dibujar)
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.matches(SKIP)) return;
    const scope = e.target.closest?.('.wp-st-step, .wp-fz-card') || root;
    pulse(successor(b, scope.isConnected ? scope : root));
  });
}
