// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — live/live.js
// Que lo "en vivo" llegue de verdad, estés donde estés de la app:
//
//  · liveWatch: cuida una suscripción de Supabase Realtime.
//    - Si el canal no queda conectado (error, se cortó, el teléfono la
//      durmió), se vuelve a conectar y mientras tanto revisa cada 30 s.
//    - Al regresar a la app (pantalla prendida, de otra app, vuelve el
//      internet) siempre refresca: lo que llegó mientras estaba dormida
//      no se pierde.
//  · showBanner: aviso arriba (como las notificaciones del teléfono)
//    cuando llega un mensaje o una notificación y no estás viendo ese
//    chat / la campanita. Tocarlo te lleva; deslizarlo arriba lo quita;
//    se va solo a los 4.5 s.
//
// Uso: const stop = liveWatch({ subscribe: (onStatus) => unsub, refresh })
//      showBanner({ icon, title, body, onTap })
// Estilos: /styles/notifs.css (.wp-live-*)
// ════════════════════════════════════════════════════════════════════

export function liveWatch({ subscribe, refresh, pollMs = 30000 }) {
  let unsub = null, ok = false, timer = 0, dead = false, last = 0;
  const connect = () => {
    try { unsub?.(); } catch (_) {}
    ok = false;
    unsub = subscribe((status) => { ok = status === 'SUBSCRIBED'; if (!ok && /ERROR|TIMED_OUT|CLOSED/.test(status || '')) later(); });
  };
  let retry = 0;
  const later = () => { clearTimeout(retry); retry = setTimeout(() => { if (!dead && !ok) connect(); }, 4000); };
  const doRefresh = () => {
    const now = Date.now();
    if (now - last < 1500) return;   // varios avisos juntos (focus + visible): una vez
    last = now;
    try { refresh(); } catch (_) {}
  };
  const poll = () => {
    if (dead) return;
    if (!ok) { doRefresh(); connect(); }
    timer = setTimeout(poll, pollMs);
  };
  const wake = () => {
    if (dead || document.visibilityState === 'hidden') return;
    doRefresh();
    if (!ok) connect();
  };
  connect();
  timer = setTimeout(poll, pollMs);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  window.addEventListener('focus', wake);
  return () => {
    dead = true; clearTimeout(timer); clearTimeout(retry);
    try { unsub?.(); } catch (_) {}
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake);
    window.removeEventListener('focus', wake);
  };
}

// ── Aviso arriba ────────────────────────────────────────────────────
let cur = null;

export function showBanner({ icon = '', title = '', body = '', onTap }) {
  if (document.visibilityState === 'hidden') return;
  cur?.dismiss(true);
  const el = document.createElement('div');
  el.className = 'wp-live';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="wp-live-in"><span class="wp-live-ic">${icon}</span>
    <span class="wp-live-txt"><b></b><small></small></span></div>`;
  el.querySelector('b').textContent = title;
  el.querySelector('small').textContent = body;
  el.querySelector('small').hidden = !body;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  window.wpApp?.placeModal?._haptic?.('light');

  let t = setTimeout(() => api.dismiss(), 4500), y0 = null, dy = 0, moved = false;
  const api = {
    dismiss(now) {
      clearTimeout(t);
      if (cur === api) cur = null;
      if (now) { el.remove(); return; }
      el.classList.remove('in'); el.classList.add('out');
      el.style.transform = '';
      setTimeout(() => el.remove(), 380);
    },
  };
  cur = api;
  el.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; dy = 0; moved = false; clearTimeout(t); el.style.transition = 'none'; }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (Math.abs(dy) > 6) moved = true;
    el.style.transform = `translate3d(-50%, ${dy < 0 ? dy : dy * 0.25}px, 0)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    el.style.transition = '';
    y0 = null;
    if (dy < -28) { api.dismiss(); return; }
    el.style.transform = '';
    t = setTimeout(() => api.dismiss(), 3000);
  }, { passive: true });
  el.addEventListener('click', () => {
    if (moved) return;
    api.dismiss();
    onTap?.();
  });
  return api;
}
