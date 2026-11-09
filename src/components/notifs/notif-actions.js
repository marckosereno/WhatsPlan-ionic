// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — notifs/notif-actions.js
// Lo que se puede hacer con los avisos de la campanita (notif-panel.js):
//  · Deslizar un aviso a la izquierda → aparece "Borrar" (rojo: borra).
//    Deslizar hasta el fondo → se borra de una.
//  · Mantener presionado → menú: Marcar como leída / no leída · Borrar.
//  · ⋯ de arriba → Solo no leídas · Marcar todas como leídas · Borrar
//    las leídas · Borrar todas (con confirmación).
// En la base: RPC notif_delete / notif_set_read (supabase/34).
//
// Uso: wireNotifActions(panel)  → después de abrir la hoja
//      moreButton()             → HTML del ⋯ para la barra de arriba
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';

const OPEN_PX = 76, KILL_PX = 180, HOLD_MS = 450;

// El mismo ⋯ de la ficha: círculo gris suave con los tres puntos
export const moreButton = () => `<button type="button" class="wp-nf-more" data-nf-more aria-label="Opciones">
  <span class="wp-nf-more-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></span></button>`;

// ── En la base ──────────────────────────────────────────────────────
async function rpcDelete(ids, onlyRead = false) {
  const { error } = await getSupabase().rpc('notif_delete', { p_ids: ids ? ids.map(String) : null, p_only_read: onlyRead });
  if (error) throw error;
}
async function rpcRead(id, read) {
  const { error } = await getSupabase().rpc('notif_set_read', { p_id: String(id), p_read: read });
  if (error) throw error;
}

export function wireNotifActions(panel) {
  const root = panel.page.root, pm = panel.getPM();
  let g = null, opened = null;

  const rowOf = (el) => el?.closest('.wp-nf-item');
  // El clic que el navegador manda justo después de soltar no cuenta (si
  // no llega, la marca se borra sola y no se come el siguiente toque)
  const swallow = () => { root._nfHeld = true; clearTimeout(root._nfHeldT); root._nfHeldT = setTimeout(() => { root._nfHeld = false; }, 450); };
  const setX = (item, x, anim) => {
    const r = item.querySelector('.wp-nf-row');
    r.style.transition = anim ? 'transform 0.38s cubic-bezier(0.34, 1.3, 0.64, 1)' : 'none';
    r.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    item.classList.toggle('swiping', !!x);
    // el botón de borrar crece con el deslizar (0 → 1)
    item.style.setProperty('--p', Math.min(1, Math.abs(x) / OPEN_PX).toFixed(3));
    item.querySelector('.wp-nf-del').style.transition = anim ? 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s' : 'none';
  };
  const closeOpened = () => { if (opened) { setX(opened, 0, true); opened = null; } };

  // ── Deslizar para borrar ──────────────────────────────────────────
  root.addEventListener('touchstart', (e) => {
    const item = rowOf(e.target);
    if (opened && opened !== item) closeOpened();
    if (!item) return;
    const t = e.touches[0];
    // "Borrar" visible: se resuelve al soltar (el clic a veces cae en la
    // tarjeta de atrás porque el dedo empezó y terminó en piezas distintas)
    if (e.target.closest('.wp-nf-del')) { g = { del: item, x: t.clientX, y: t.clientY }; return; }
    g = { item, x: t.clientX, y: t.clientY, dx: 0, lock: null, base: item === opened ? -OPEN_PX : 0 };
    g.timer = setTimeout(() => { if (g && !g.lock) { g.held = true; pm?._haptic?.('medium'); hold(g.item); } }, HOLD_MS);
  }, { passive: true });

  root.addEventListener('touchmove', (e) => {
    if (!g) return;
    if (g.del) { const t = e.touches[0]; if (Math.hypot(t.clientX - g.x, t.clientY - g.y) > 10) g = null; return; }
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.lock) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimeout(g.timer);
      g.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (g.lock !== 'x') return;
    e._wpElastic = true;                       // el scroll de la hoja no lo toma
    g.dx = Math.min(0, g.base + dx);
    if (g.dx < -KILL_PX && !g.kill) { g.kill = true; pm?._haptic?.('light'); }
    if (g.dx > -KILL_PX) g.kill = false;
    setX(g.item, g.dx < -KILL_PX ? -KILL_PX - (-(g.dx) - KILL_PX) * 0.35 : g.dx, false);
  }, { passive: true });

  const end = () => {
    if (!g) return;
    if (g.del) { const it = g.del; g = null; swallow(); remove([it]); return; }
    clearTimeout(g.timer);
    const { item, lock, dx, kill, held } = g;
    g = null;
    if (held) { swallow(); return; }
    if (lock !== 'x') return;
    if (kill) { remove([item]); return; }
    if (dx < -OPEN_PX / 2) { setX(item, -OPEN_PX, true); opened = item; }
    else { setX(item, 0, true); if (opened === item) opened = null; }
  };
  root.addEventListener('touchend', end, { passive: true });
  root.addEventListener('touchcancel', end, { passive: true });

  // El toque que sigue a un deslizar / mantener no abre el aviso
  root.addEventListener('click', (e) => {
    if (root._nfHeld) { root._nfHeld = false; e.stopPropagation(); e.preventDefault(); return; }
    const del = e.target.closest('.wp-nf-del');                 // con el dedo ya se borró al soltar;
    if (del) { e.stopPropagation(); remove([rowOf(del)]); return; }   // esto es para el mouse
    if (e.target.closest('[data-nf-more]')) { e.stopPropagation(); more(e.target.closest('[data-nf-more]')); return; }
    if (opened) { e.stopPropagation(); closeOpened(); }
  }, true);
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── Borrar (con animación de colapso) ─────────────────────────────
  async function remove(items, { silent = false } = {}) {
    const ns = items.map(it => panel.list[+it.querySelector('.wp-nf-row').dataset.i]).filter(Boolean);
    if (!ns.length) return;
    items.forEach(it => {
      it.style.height = `${it.offsetHeight}px`;
      void it.offsetHeight;
      it.classList.add('gone');
    });
    pm?._haptic?.('medium');
    opened = null;
    try { await rpcDelete(ns.map(n => n.id)); }
    catch (err) { pm?._showToast?.('No se pudo borrar'); items.forEach(it => { it.classList.remove('gone'); it.style.height = ''; setX(it, 0, true); }); return; }
    setTimeout(() => {
      panel.list = panel.list.filter(n => !ns.includes(n));
      panel._paint(false);
      if (!silent) pm?._showToast?.(ns.length > 1 ? `${ns.length} borradas` : 'Notificación borrada');
    }, 300);
  }

  // ── Mantener presionado ───────────────────────────────────────────
  function hold(item) {
    const n = panel.list[+item.querySelector('.wp-nf-row').dataset.i]; if (!n) return;
    pm?._openPopMenu?.(item.querySelector('.wp-nf-row'), [
      { label: n.read ? 'Marcar como no leída' : 'Marcar como leída', icon: n.read ? 'bell' : 'check', onClick: () => setRead(n, !n.read) },
      { label: 'Borrar', icon: 'trash', danger: true, onClick: () => remove([item]) },
    ]);
  }

  async function setRead(n, read) {
    n.read = read;
    panel.keepUnread[read ? 'delete' : 'add'](String(n.id));
    panel._paint(false);
    try { await rpcRead(n.id, read); } catch (_) { pm?._showToast?.('No se pudo'); }
  }

  // ── ⋯ de arriba ───────────────────────────────────────────────────
  function more(btn) {
    pm?._haptic?.('light');
    const read = panel.list.filter(n => n.read).length;
    pm?._openPopMenu?.(btn, [
      { label: 'Solo no leídas', icon: 'bell', active: panel.onlyNew, onClick: () => { panel.onlyNew = !panel.onlyNew; panel._paint(true); } },
      { label: 'Marcar todas como leídas', icon: 'check', onClick: () => markAll() },
      { sep: true },
      { label: 'Borrar las leídas', icon: 'trash', onClick: () => clear(true, read) },
      { label: 'Borrar todas', icon: 'trash', danger: true, onClick: () => clear(false, panel.list.length) },
    ]);
  }

  async function markAll() {
    panel.list.forEach(n => { n.read = true; });
    panel.keepUnread.clear();
    panel._paint(false);
    try { await panel.markSeen(true); } catch (_) {}
  }

  async function clear(onlyRead, count) {
    if (!count) { pm?._showToast?.(onlyRead ? 'No hay leídas para borrar' : 'No hay notificaciones'); return; }
    if (!onlyRead) {
      const ok = await pm?._confirmSheet?.('Borrar notificaciones', `¿Borrar las ${count} notificaciones? No se pueden recuperar.`, 'Borrar todas');
      if (!ok) return;
    }
    const items = [...root.querySelectorAll('.wp-nf-item')].filter(it => !onlyRead || panel.list[+it.querySelector('.wp-nf-row').dataset.i]?.read);
    try { await rpcDelete(null, onlyRead); } catch (_) { pm?._showToast?.('No se pudo borrar'); return; }
    items.forEach((it, k) => setTimeout(() => { it.style.height = `${it.offsetHeight}px`; void it.offsetHeight; it.classList.add('gone'); }, k * 35));
    pm?._haptic?.('medium');
    setTimeout(() => {
      panel.list = onlyRead ? panel.list.filter(n => !n.read) : [];
      panel._paint(false);
      pm?._showToast?.(onlyRead ? 'Leídas borradas' : 'Notificaciones borradas');
    }, 320 + items.length * 35);
  }
}
