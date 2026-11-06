// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/emoji-dial.js
// Selector de ícono en "media luna": el elegido grande al centro, los
// vecinos más chicos bajando por los lados, su nombre en una pastilla y
// un medidor en arco con una aguja. Se desliza con el dedo (con imán al
// soltar) o tocando un ícono de los lados.
//
// Uso:
//   const dial = createEmojiDial(el, { items: [{ key, emoji, label, img }], value, onChange });
//   dial.set(key)
// Estilos: /styles/plan-steps.css (.wp-dial-*)
// ════════════════════════════════════════════════════════════════════

const STEP_DEG = 34;     // separación entre íconos sobre el arco
const RADIUS = 165;      // radio del arco (px)
const VISIBLE = 2;       // íconos visibles a cada lado
const DRAG_PX = 70;      // px de arrastre = 1 ícono
const TICKS = 31;        // rayitas del medidor

export function createEmojiDial(el, { items, value, onChange, haptic = () => {} }) {
  let pos = Math.max(0, items.findIndex(x => x.key === value));   // posición (puede ser fraccionaria al arrastrar)
  let drag = null, raf = 0;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  el.classList.add('wp-dial');
  el.innerHTML = `
    <div class="wp-dial-stage">${items.map((x, k) => `<button type="button" class="wp-dial-it" data-k="${k}" aria-label="${esc(x.label)}">${x.img
      ? `<img src="${esc(x.img)}" alt="" draggable="false" onerror="this.replaceWith(document.createTextNode('${x.emoji}'))">` : x.emoji}</button>`).join('')}</div>
    <span class="wp-dial-label"></span>
    <svg class="wp-dial-gauge" viewBox="0 -30 240 100" aria-hidden="true">
      <defs><linearGradient id="wpDialG" x1="0" x2="1"><stop offset="0" stop-color="#ffb04a"/><stop offset="1" stop-color="#ff5fa2"/></linearGradient></defs>
      <path class="trk" d="M20 66 A100 100 0 0 1 220 66"/><path class="val" d="M20 66 A100 100 0 0 1 220 66"/>
      ${Array.from({ length: TICKS }, (_, t) => { const a = Math.PI * (1 - t / (TICKS - 1)); const r1 = t % 5 ? 84 : 80; return `<line x1="${120 + r1 * Math.cos(a)}" y1="${66 - r1 * Math.sin(a)}" x2="${120 + 88 * Math.cos(a)}" y2="${66 - 88 * Math.sin(a)}"/>`; }).join('')}
      <line class="needle" x1="120" y1="66" x2="120" y2="30"/><circle class="hub" cx="120" cy="66" r="5"/>
    </svg>`;
  const its = [...el.querySelectorAll('.wp-dial-it')];
  const label = el.querySelector('.wp-dial-label');
  const val = el.querySelector('.val'), needle = el.querySelector('.needle');
  const arcLen = Math.PI * 100;
  val.style.strokeDasharray = `${arcLen}`;

  const paint = () => {
    its.forEach((it, k) => {
      const d = k - pos, ad = Math.abs(d);
      const a = (d * STEP_DEG) * Math.PI / 180;
      const x = RADIUS * Math.sin(a), y = RADIUS * (1 - Math.cos(a));
      const s = Math.max(0.3, 1 - ad * 0.38);
      it.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
      it.style.opacity = ad > VISIBLE + 0.5 ? '0' : String(Math.max(0.25, 1 - ad * 0.22));
      it.style.zIndex = String(20 - Math.round(ad));
      it.style.pointerEvents = ad > VISIBLE ? 'none' : '';
      it.classList.toggle('on', ad < 0.5);
    });
    const cur = items[Math.round(Math.max(0, Math.min(items.length - 1, pos)))];
    label.textContent = cur?.label || '';
    const f = items.length > 1 ? pos / (items.length - 1) : 0.5;
    val.style.strokeDashoffset = String(arcLen * (1 - f));
    needle.style.transform = `rotate(${(-90 + f * 180).toFixed(1)}deg)`;
  };
  const settle = (k, notify = true) => {
    const next = Math.max(0, Math.min(items.length - 1, k));
    const changed = items[next].key !== items[Math.round(pos)]?.key || pos !== next;
    el.classList.add('anim');
    pos = next; paint();
    label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
    if (notify && changed) { haptic('light'); onChange?.(items[next].key); }
    clearTimeout(raf); raf = setTimeout(() => el.classList.remove('anim'), 420);
  };

  // Arrastrar
  el.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, start: pos, moved: false, id: e.pointerId };
    el.classList.remove('anim');
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6 && !drag.moved) { drag.moved = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} }
    if (!drag.moved) return;
    const before = Math.round(pos);
    pos = Math.max(-0.4, Math.min(items.length - 0.6, drag.start - dx / DRAG_PX));
    if (Math.round(pos) !== before) haptic('light');
    paint();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved; drag = null;
    if (moved) { settle(Math.round(pos)); return; }
    const it = e.target.closest?.('.wp-dial-it');
    if (it) settle(+it.dataset.k);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  paint();
  return { set(key) { const k = items.findIndex(x => x.key === key); if (k >= 0) settle(k, false); } };
}
