// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-msg-actions.js
// El menú de un mensaje al mantenerlo presionado (chat-react.js) y lo que
// hace cada opción (37_chat_actions.sql):
//  · Responder · Copiar
//  · Fijar / Desfijar (solo chats de plan; uno por chat, lo ven todos)
//  · Editar (tuyo, hasta 15 min; queda "editado")
//  · Borrar → Borrar para mí (cualquiera) / Borrar para todos (tuyo,
//    hasta 1 h; queda "Se eliminó este mensaje")
// Todo se ve al instante y se confirma con la base; si falla, regresa.
//
// Uso: holdMenu(ctx, mensaje, burbuja)   (ctx de chat-actions.js)
// ════════════════════════════════════════════════════════════════════
import { openReactBar } from '/src/components/chat/chat-react.js';
import { deleteMessage, pinMessage } from '/src/components/chat/chat-service.js';

const EDIT_MIN = 15, DELETE_MIN = 60;
const ago = (m) => (Date.now() - new Date(m.created_at).getTime()) / 60000;

export function holdMenu(ctx, m, el, react) {
  const { pm, me, st } = ctx;
  const mine = m.user_id === me, gone = !!m.deleted_at, tmp = String(m.id).startsWith('tmp-');
  if (tmp) return;
  const items = [];
  if (!gone) items.push({ id: 'reply', label: 'Responder', icon: 'reply' });
  if (!gone && m.body) items.push({ id: 'copy', label: 'Copiar', icon: 'copy' });
  if (!gone && !ctx.dm) items.push({ id: 'pin', label: st.pin === m.id ? 'Desfijar' : 'Fijar', icon: 'pin' });
  if (!gone && mine && m.body && ago(m) < EDIT_MIN) items.push({ id: 'edit', label: 'Editar', icon: 'edit' });
  const forAll = !gone && mine && ago(m) < DELETE_MIN;
  items.push(forAll
    ? { id: 'del', label: 'Borrar', icon: 'trash', danger: true, sub: [
        { id: 'del-me', label: 'Borrar para mí', icon: 'trash' },
        { id: 'del-all', label: 'Borrar para todos', icon: 'trash', danger: true },
      ] }
    : { id: 'del-me', label: 'Borrar para mí', icon: 'trash', danger: true });

  pm._haptic?.('medium');
  openReactBar(el, {
    mine: m.reactions?.[me], reactions: !gone, items,
    onPick: (e) => react(m.id, e),
    onReply: () => ctx.setReply(m),
    onCopy: () => { navigator.clipboard?.writeText(m.body).then(() => pm._showToast?.('Copiado')).catch(() => {}); },
    onItem: (id) => {
      if (id === 'pin') pin(ctx, m);
      else if (id === 'edit') ctx.setEdit(m);
      else if (id === 'del-me') del(ctx, m, false);
      else if (id === 'del-all') del(ctx, m, true);
    },
  });
}

async function pin(ctx, m) {
  const { pm, st } = ctx;
  const before = st.pin, next = st.pin === m.id ? null : m.id;
  ctx.setPin(next);
  pm._haptic?.('light');
  try { await pinMessage(ctx.id, next); pm._showToast?.(next ? 'Mensaje fijado' : 'Mensaje desfijado'); }
  catch (_) { ctx.setPin(before); pm._showToast?.('No se pudo fijar'); }
}

async function del(ctx, m, everyone) {
  const { pm, me, st } = ctx;
  const keep = { body: m.body, image_path: m.image_path, deleted_at: m.deleted_at, hidden_for: m.hidden_for, reactions: m.reactions };
  if (everyone) Object.assign(m, { deleted_at: new Date().toISOString(), body: '', image_path: null, reactions: {} });
  else m.hidden_for = [...(m.hidden_for || []), me];
  if (everyone && st.pin === m.id) ctx.setPin(null);
  ctx.paintAll();
  pm._haptic?.('medium');
  try {
    await deleteMessage(m.id, everyone, ctx.id);
    pm._showToast?.(everyone ? 'Borrado para todos' : 'Borrado para ti');
  } catch (e) {
    Object.assign(m, keep); ctx.paintAll();
    pm._showToast?.(/1 hora/.test(e.message || '') ? 'Ya pasó más de 1 hora' : 'No se pudo borrar');
  }
}
