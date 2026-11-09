// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/dm-chat.js
// Mensajes directos entre personas (35_direct_messages.sql), con la
// misma conversación del chat de planes (plan-chat.js).
//  · startDm(pm, persona): desde su perfil, "Enviar mensaje". Abre el
//    chat (o lo crea): directo si se siguen los dos, o como solicitud si
//    solo tú le sigues. Avisa si no se puede ("Sigue a esta persona…").
//  · dmShape(fila, me): una fila de my_dm_chats con la forma de un chat
//    de plan (id "dm:<uuid>", título = la persona, caras = la persona),
//    para que la lista de Social y la conversación la usen igual.
// ════════════════════════════════════════════════════════════════════
import { openDm } from '/src/components/chat/chat-service.js';
import { openPlanChat } from '/src/components/chat/plan-chat.js';

export function dmShape(r, me) {
  return {
    kind: 'dm', id: `dm:${r.thread_id}`, activity_id: `dm:${r.thread_id}`, thread_id: r.thread_id,
    title: r.other_name || (r.other_username ? `@${r.other_username}` : 'Alguien'),
    other_id: r.other_id, other_username: r.other_username, other_avatar: r.other_avatar,
    participants: [me, r.other_id], creator_id: r.other_id,
    status: r.status, requested_by: r.requested_by, muted: !!r.muted, unread: r.unread || 0,
    last_body: r.last_body, last_kind: r.last_kind, last_user: r.last_user, last_at: r.last_at, last_image: r.last_image,
    scheduled_at: r.last_at,
    pinned_at: r.pinned_at || null, unread_mark: !!r.unread_mark, last_deleted: !!r.last_deleted, cleared_at: r.cleared_at || null,
  };
}

// Deja la cara/nombre de la persona en el cache de la ficha
export function rememberPerson(pm, p) {
  if (!pm || !p?.id) return;
  pm._profCache = pm._profCache || new Map();
  if (!pm._profCache.has(p.id)) pm._profCache.set(p.id, { id: p.id, name: p.name, username: p.username, avatar_url: p.avatar_url });
}

export function openDmChat(pm, a, opts = {}) {
  rememberPerson(pm, { id: a.other_id, name: a.title, username: a.other_username, avatar_url: a.other_avatar });
  return openPlanChat(pm, a, opts);
}

// "Enviar mensaje" desde un perfil. p = { id, name, username, avatar_url }
export async function startDm(pm, p, opts = {}) {
  const me = window.wpApp?.currentUser?.id;
  if (!me) { window.wpApp?.authModal?.show?.(); return null; }
  let t;
  try { t = await openDm(p.id); }
  catch (e) {
    const msg = String(e?.message || '');
    pm?._showToast?.(/Sigue/.test(msg) ? 'Síguele para poder escribirle'
      : /No recibe tus/.test(msg) ? 'No recibe tus mensajes'
      : /No recibe/.test(msg) ? 'No está recibiendo mensajes'
      : /fetch|network/i.test(msg) ? 'Sin conexión' : 'No se pudo abrir el chat');
    return null;
  }
  pm?._haptic?.('light');
  const a = dmShape({ thread_id: t.id, other_id: p.id, other_name: p.name, other_username: p.username, other_avatar: p.avatar_url,
    status: t.status, requested_by: t.requested_by, last_at: new Date().toISOString() }, me);
  window.wpApp?.socialTab?.watchOpen?.(a.id);
  return openDmChat(pm, a, { onClose: () => { window.wpApp?.socialTab?.watchOpen?.(null); opts.onClose?.(); } });
}
