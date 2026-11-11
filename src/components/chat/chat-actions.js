// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-actions.js
// Lo que se puede hacer en la conversación de un plan (plan-chat.js):
//  · Reaccionar: doble toque = ❤️; mantener presionado = barra de 6
//    reacciones + menú (Responder, Copiar, Fijar, Editar, Borrar:
//    chat-msg-actions.js); tocar una reacción debajo de la
//    burbuja la pone o la quita. Se ve al instante y se confirma después.
//  · Responder: deslizar a la derecha o "Responder" del menú; tocar la
//    cita lleva al mensaje original (y lo ilumina).
//  · Fotos: "+" de la barra → elegir, achicar, subir y enviar. Tocar una
//    foto la abre en grande.
//  · Menú de arriba (las caras del grupo): Silenciar / Activar avisos ·
//    Ver el plan.
//  · "¿Repetimos?" cuando el plan ya pasó: arma otro plan en el mismo
//    lugar con los mismos invitados.
// ════════════════════════════════════════════════════════════════════
import { reactMessage, setMuted, uploadPhoto, photoUrls, photoUrl } from '/src/components/chat/chat-service.js';
import { attachChatGestures, heartBurst } from '/src/components/chat/chat-gestures.js';
import { holdMenu } from '/src/components/chat/chat-msg-actions.js';
import { pickPhoto, shrinkPhoto, openPhoto } from '/src/components/chat/chat-compose.js';

// ctx: { pm, a, id, me, st, page, box, paintAll, setReply, sendPhoto }
export function wireChatActions(ctx) {
  const { pm, box, st, me } = ctx;
  const find = (id) => st.list.find(m => m.id === id);

  const react = async (id, emoji) => {
    const m = find(id); if (!m || String(id).startsWith('tmp-')) return;
    const before = { ...(m.reactions || {}) };
    const r = { ...before };
    if (r[me] === emoji) delete r[me]; else r[me] = emoji;
    m.reactions = r; ctx.paintAll();
    pm._haptic?.(r[me] ? 'medium' : 'light');
    try { m.reactions = await reactMessage(id, emoji, ctx.id); ctx.paintAll(); }
    catch (_) { m.reactions = before; ctx.paintAll(); pm._showToast?.('No se pudo reaccionar'); }
  };

  attachChatGestures(box, {
    haptic: (k) => pm._haptic?.(k),
    onReply: (id) => { const m = find(id); if (m && !m.deleted_at) ctx.setReply(m); },
    onDouble: (id, el) => { if (find(id)?.deleted_at) return; heartBurst(el); react(id, '❤️'); },
    onHold: (id, el) => { const m = find(id); if (m) holdMenu(ctx, m, el, react); },
  });

  box.addEventListener('click', (e) => {
    const r = e.target.closest('[data-react]');
    if (r) { react(r.closest('.wp-ch-msg').dataset.id, r.dataset.react); return; }
    const q = e.target.closest('[data-goto]');
    if (q) { goTo(box, q.dataset.goto); return; }
    const ph = e.target.closest('[data-photo]');
    if (ph) setTimeout(() => openPhoto(photoUrl(ph.dataset.photo)), 280);   // espera por si es doble toque
  });

  ctx.page.foot.querySelector('.wp-ch-plus')?.addEventListener('click', () => sendPhoto(ctx));
  ctx.page.root.querySelector('.wp-ch-head-av')?.addEventListener('click', (e) => ctx.dm ? headMenu(ctx, e.currentTarget) : openPlanMenu(ctx, e.currentTarget, headMenu));
}

// Pintar las fotos que ya tienen liga (las ligas se piden en grupo)
export async function fillPhotos(box, list) {
  const paths = list.map(m => m.image_path).filter(Boolean);
  if (!paths.length) return;
  await photoUrls(paths);
  box.querySelectorAll('[data-photo]').forEach(el => { const u = photoUrl(el.dataset.photo); if (u) el.style.backgroundImage = `url('${u}')`; });
}

export function goTo(box, id) {
  const el = box.querySelector(`.wp-ch-msg[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

async function sendPhoto(ctx) {
  const file = await pickPhoto(); if (!file) return;
  try {
    const blob = await shrinkPhoto(file);
    ctx.pm._showToast?.('Enviando foto…');
    const path = await uploadPhoto(ctx.id, blob);
    await ctx.sendPhoto(path);
  } catch (e) { ctx.pm._showToast?.(e.message || 'No se pudo enviar la foto'); }
}

import { openPlanMenu } from '/src/components/chat/plan-group.js';

function headMenu(ctx, anchor) {
  const { pm, a, st } = ctx;
  pm._openPopMenu?.(anchor, [
    { label: st.muted ? 'Activar avisos' : 'Silenciar chat', icon: st.muted ? 'bell' : 'mute', onClick: async () => {
      try { await setMuted(ctx.id, !st.muted); st.muted = !st.muted; pm._showToast?.(st.muted ? 'Chat silenciado' : 'Avisos activados'); }
      catch (_) { pm._showToast?.('No se pudo cambiar'); }
    } },
    // directo → "Ver perfil"; de plan → "Ver el plan"
    ctx.dm ? { label: 'Ver perfil', icon: 'edit', onClick: () => ctx.openPlan?.() }
      : { label: 'Ver el plan', icon: 'calendar', onClick: () => ctx.openPlan?.() },
  ]);
  const pop = document.querySelector('.wp-pm2-pop');   // encima de la hoja del chat
  if (pop) pop.style.zIndex = '1500700';
}

// "¿Repetimos?": otro plan en el mismo lugar con los mismos
export function repeatPlan(pm, a, me) {
  const p = (window.wpApp?.mapView?.allPlaces || []).find(x => String(x.place_id || x.id) === String(a.place_id));
  pm._place = p || { place_id: a.place_id, id: a.place_id, name: a.place_name, lat: a.lat, lng: a.lng };
  const invite = [...new Set([a.creator_id, ...(a.participants || [])])].filter(x => x && x !== me);
  pm._openPlanSheet({ invite, people: invite.map(id => pm._profCache?.get(id)).filter(Boolean), title: a.title });
}
