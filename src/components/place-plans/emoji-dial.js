// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/emoji-dial.js
// Selector de emoji en una curva suave: el elegido grande al centro,
// los vecinos más chicos bajando un poco por los lados y su nombre en
// una pastilla. Se desliza con el dedo (con imán al soltar) o tocando
// un emoji de los lados.
//
// Uso:
//   const dial = createEmojiDial(el, { items: [{ key, emoji, label, img }], value, onChange });
//   dial.set(key)
// Estilos: /styles/plan-steps.css (.wp-dial-*)
// ════════════════════════════════════════════════════════════════════

const STEP_DEG = 17;     // separación entre íconos sobre el arco
const RADIUS = 300;      // radio del arco (px)
const VISIBLE = 3;       // íconos visibles a cada lado
const DRAG_PX = 70;      // px de arrastre = 1 ícono

export function createEmojiDial(el, { items, value, onChange, haptic = () => {} }) {
  let pos = Math.max(0, items.findIndex(x => x.key === value));   // posición (puede ser fraccionaria al arrastrar)
  let drag = null, raf = 0;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  el.classList.add('wp-dial');
  el.innerHTML = `
    <div class="wp-dial-stage">${items.map((x, k) => `<button type="button" class="wp-dial-it" data-k="${k}" aria-label="${esc(x.label)}">${x.img
      ? `<img src="${esc(x.img)}" alt="" draggable="false" onerror="this.replaceWith(document.createTextNode('${x.emoji}'))">` : x.emoji}</button>`).join('')}</div>
    <span class="wp-dial-label"></span>`;
  const its = [...el.querySelectorAll('.wp-dial-it')];
  const label = el.querySelector('.wp-dial-label');

  const paint = () => {
    its.forEach((it, k) => {
      const d = k - pos, ad = Math.abs(d);
      const a = (d * STEP_DEG) * Math.PI / 180;
      const x = RADIUS * Math.sin(a), y = RADIUS * (1 - Math.cos(a));
      const s = Math.max(0.45, 1 - ad * 0.3);
      it.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
      it.style.opacity = ad > VISIBLE + 0.5 ? '0' : String(Math.max(0.25, 1 - ad * 0.22));
      it.style.zIndex = String(20 - Math.round(ad));
      it.style.pointerEvents = ad > VISIBLE ? 'none' : '';
      it.classList.toggle('on', ad < 0.5);
    });
    const cur = items[Math.round(Math.max(0, Math.min(items.length - 1, pos)))];
    label.textContent = cur?.label || '';
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
