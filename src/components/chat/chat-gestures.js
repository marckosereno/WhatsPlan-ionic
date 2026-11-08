// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-gestures.js
// Gestos sobre los mensajes del chat (plan-chat.js):
//  · Deslizar un mensaje a la derecha → responder (sale la flechita y
//    al pasar de 48 px vibra; al soltar, queda como respuesta).
//  · Doble toque en la burbuja → ❤️ (otra vez lo quita).
//  · Mantener presionado → barra de reacciones y opciones.
// El deslizar de lado no pelea con el scroll de la hoja: la hoja solo
// toma los gestos verticales (drag-scroll.js).
//
// Uso: attachChatGestures(box, { onReply(id), onDouble(id, el), onHold(id, el), haptic(k) })
// Estilos: /styles/chat.css (.wp-ch-msg.swiping, --sw)
// ════════════════════════════════════════════════════════════════════
const HOLD_MS = 420, REPLY_PX = 48, MAX_PX = 72, TAP2_MS = 300;

export function attachChatGestures(box, h) {
  let g = null, lastTap = { id: null, t: 0 };

  box.addEventListener('touchstart', (e) => {
    const msg = e.target.closest('.wp-ch-msg');
    if (!msg || e.touches.length > 1) return;
    const t = e.touches[0];
    g = { msg, id: msg.dataset.id, x: t.clientX, y: t.clientY, dx: 0, lock: null, held: false, armed: false };
    g.timer = setTimeout(() => {
      if (!g || g.lock) return;
      g.held = true;
      h.onHold?.(g.id, msg.querySelector('.wp-ch-b'));
    }, HOLD_MS);
  }, { passive: true });

  box.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.lock) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimeout(g.timer);
      g.lock = Math.abs(dx) > Math.abs(dy) && dx > 0 ? 'x' : 'y';
    }
    if (g.lock !== 'x') return;
    g.dx = Math.min(MAX_PX, Math.max(0, dx * 0.6));
    g.msg.classList.add('swiping');
    g.msg.style.setProperty('--sw', `${g.dx.toFixed(1)}px`);
    const armed = g.dx >= REPLY_PX;
    if (armed !== g.armed) { g.armed = armed; g.msg.classList.toggle('armed', armed); if (armed) h.haptic?.('light'); }
  }, { passive: true });

  const end = () => {
    if (!g) return;
    clearTimeout(g.timer);
    const { msg, armed, id, lock } = g;
    if (lock === 'x') {
      msg.classList.remove('swiping', 'armed');
      msg.style.setProperty('--sw', '0px');
      if (armed) h.onReply?.(id);
    }
    box._wpHeld = g.held;
    g = null;
  };
  box.addEventListener('touchend', end, { passive: true });
  box.addEventListener('touchcancel', end, { passive: true });

  // Doble toque (en la burbuja, no en la cita, foto ni reacciones)
  box.addEventListener('click', (e) => {
    if (box._wpHeld) { box._wpHeld = false; e.stopPropagation(); return; }   // fue mantener presionado
    const b = e.target.closest('.wp-ch-b');
    if (!b || e.target.closest('[data-goto], [data-react]')) return;
    const id = b.closest('.wp-ch-msg')?.dataset.id, now = Date.now();
    if (lastTap.id === id && now - lastTap.t < TAP2_MS) {
      lastTap = { id: null, t: 0 };
      e.stopPropagation();
      h.onDouble?.(id, b);
      return;
    }
    lastTap = { id, t: now };
  }, true);
}

// Corazón que sale de la burbuja al dar doble toque
export function heartBurst(el, emoji = '❤️') {
  const r = el.getBoundingClientRect(), s = document.createElement('i');
  s.className = 'wp-ch-burst';
  s.textContent = emoji;
  s.style.left = `${r.left + r.width / 2}px`;
  s.style.top = `${r.top + r.height / 2}px`;
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 760);
}
