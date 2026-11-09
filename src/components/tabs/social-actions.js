// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — tabs/social-actions.js
// Mantener presionado un chat en la lista de Social (37_chat_actions):
//  · Fijar arriba / Desfijar (hasta 3; salen en "Fijados")
//  · Silenciar / Activar avisos
//  · Marcar como no leído / leído
//  · Ocultar (vuelve a salir si llega un mensaje nuevo)
//  · Borrar chat (solo directos; se borra para ti, con confirmación)
// Todo se ve al instante; si la base dice que no, regresa.
//
// Uso: wireSocialHold(socialTab)   (después de abrir la pantalla)
// ════════════════════════════════════════════════════════════════════
import { chatPref, setMuted, markRead } from '/src/components/chat/chat-service.js';

const HOLD_MS = 450;

export function wireSocialHold(tab) {
  const root = tab.scr.root;
  let g = null;
  root.addEventListener('touchstart', (e) => {
    const row = e.target.closest('.wp-so-row'); if (!row) return;
    const t = e.touches[0];
    g = { row, x: t.clientX, y: t.clientY };
    g.timer = setTimeout(() => { if (g) { g.held = true; menu(tab, row); } }, HOLD_MS);
  }, { passive: true });
  root.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - g.x, t.clientY - g.y) > 8) { clearTimeout(g.timer); g = null; }
  }, { passive: true });
  const end = () => {
    if (!g) return;
    clearTimeout(g.timer);
    if (g.held) { tab._swallow = true; setTimeout(() => { tab._swallow = false; }, 450); }
    g = null;
  };
  root.addEventListener('touchend', end, { passive: true });
  root.addEventListener('touchcancel', end, { passive: true });
  root.addEventListener('contextmenu', (e) => { if (e.target.closest('.wp-so-row')) { e.preventDefault(); menu(tab, e.target.closest('.wp-so-row')); } });
}

function menu(tab, row) {
  const pm = tab.getPM(), c = tab.chats[+row.dataset.i]; if (!pm || !c) return;
  pm._haptic?.('medium');
  row.classList.add('held');
  const dm = c.kind === 'dm', id = c.activity_id;
  const pinned = tab.chats.filter(x => x.pinned_at).length;
  const items = [
    { label: c.pinned_at ? 'Desfijar' : 'Fijar arriba', icon: 'pin', onClick: () => {
      if (!c.pinned_at && pinned >= 3) { pm._showToast?.('Solo puedes fijar 3 chats'); return; }
      change(tab, c, { pinned_at: c.pinned_at ? null : new Date().toISOString() }, () => chatPref(id, { pin: !c.pinned_at }),
        c.pinned_at ? 'Chat desfijado' : 'Chat fijado');
    } },
    { label: c.muted ? 'Activar avisos' : 'Silenciar', icon: c.muted ? 'bell' : 'mute', onClick: () =>
      change(tab, c, { muted: !c.muted }, () => setMuted(id, !c.muted), c.muted ? 'Avisos activados' : 'Chat silenciado') },
    (c.unread || c.unread_mark)
      ? { label: 'Marcar como leído', icon: 'check', onClick: () => change(tab, c, { unread: 0, unread_mark: false }, () => markRead(id)) }
      : { label: 'Marcar como no leído', icon: 'dot', onClick: () => change(tab, c, { unread_mark: true }, () => chatPref(id, { unread: true })) },
    { sep: true },
    { label: 'Ocultar', icon: 'hide', onClick: () => change(tab, c, { _gone: true }, () => chatPref(id, { hide: true }), 'Chat oculto · vuelve si llega un mensaje') },
  ];
  if (dm) items.push({ label: 'Borrar chat', icon: 'trash', danger: true, onClick: async () => {
    const ok = await pm._confirmSheet?.('Borrar chat', `Se borra la conversación con ${c.title} solo para ti.`, 'Borrar');
    if (ok) change(tab, c, { _gone: true }, () => chatPref(id, { clear: true }), 'Chat borrado');
  } });
  pm._openPopMenu?.(row, items);
  setTimeout(() => row.classList.remove('held'), 300);
}

// Cambia el chat en la lista al instante y luego en la base
async function change(tab, c, patch, save, ok) {
  const pm = tab.getPM(), keep = {};
  Object.keys(patch).forEach(k => { keep[k] = c[k]; });
  Object.assign(c, patch);
  if (c._gone) tab.chats = tab.chats.filter(x => x !== c);
  tab._paint(); tab._count();
  try { await save(); if (ok) pm?._showToast?.(ok); }
  catch (e) {
    if (c._gone) tab.chats.push(c);
    Object.assign(c, keep); delete c._gone;
    tab._paint(); tab._count();
    pm?._showToast?.(/3 chats/.test(e.message || '') ? 'Solo puedes fijar 3 chats' : 'No se pudo');
  }
}
