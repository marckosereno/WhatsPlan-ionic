// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/plan-chat.js
// La conversación de un plan, en la hoja grande (openSheetPage):
//  · Arriba: nombre del plan y "3 van · Hoy 7 pm".
//  · Mensajes (chat-render.js) que llegan en tiempo real; abre hasta abajo
//    y si estás leyendo más arriba no te mueve, solo aparece "Nuevos ↓".
//  · Arriba a la derecha, las caras del grupo.
//  · Abajo: respuestas rápidas cuando el plan está por empezar o en curso
//    (de 2 h antes a 1 h después de que termina; se esconden mientras
//    escribes) y la barra para escribir con la pill "Enviar" (gris
//    apagada; con texto se enciende con el degradado).
//  · Solo el mensaje que llega entra con animación (no se re-anima todo).
//  · Mensaje fijado (chats de plan): franja arriba; tocarla lleva al
//    mensaje. Editar tu mensaje: la barra se vuelve "Editando…".
//  · Reacciones, responder, fotos, @menciones, silenciar y "¿Repetimos?":
//    chat-actions.js, chat-gestures.js, chat-react.js, chat-compose.js.
//  · Lo que envías sale al instante ("Enviando…") y se confirma al
//    llegar; si falla, se quita y te avisa.
//  · Marca leído al abrir, al llegar mensajes y al cerrar.
//  · Con el teclado abierto, la hoja cabe entre la barra de estado y el
//    teclado (fitKeyboard).
//
//  · Mensajes directos (a.id = "dm:<uuid>", ver dm-chat.js): arriba la
//    persona y su @; sin respuestas rápidas ni "¿Repetimos?"; si es una
//    solicitud que te llegó, abajo Aceptar / Rechazar en vez de la barra.
//
// Uso: openPlanChat(pm, a, { onBack, onClose })   (pm = PlaceModal2)
// Estilos: /styles/chat.css (.wp-ch-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { loadMessages, sendMessage, markRead, onMessages, isDm, respondDm, editMessage, loadPin, onPin } from '/src/components/chat/chat-service.js';
import { wireChatActions, fillPhotos, repeatPlan, goTo } from '/src/components/chat/chat-actions.js';
import { paintReply, paintMentions } from '/src/components/chat/chat-compose.js';
import { getSupabase } from '/src/services/SupabaseService.js';
import { messagesHtml, groupAvatar } from '/src/components/chat/chat-render.js';

const PIN = '<i class="wp-ch-pin-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.8V5h6v5.8l2.5 3.2H6.5Z"/><path d="M8 5h8"/></svg></i>';
const PLUS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const QUICK = ['🚗 Voy en camino', '👋 Ya llegué', '⏰ Llego tarde', '🙋 ¿Dónde están?'];

export function ensureChatCss() {
  if (document.getElementById('wp-chat-css')) return;
  const l = document.createElement('link');
  l.id = 'wp-chat-css'; l.rel = 'stylesheet'; l.href = '/styles/chat.css';
  document.head.appendChild(l);
}

function quickOn(pm, a) {
  if (isDm(a.id)) return false;
  const now = Date.now(), t0 = new Date(a.scheduled_at).getTime();
  const end = pm._mpEndAt(a)?.getTime() || t0 + 3 * 3600e3;
  return a.status !== 'cancelled' && now >= t0 - 2 * 3600e3 && now <= end + 3600e3;
}

export function openPlanChat(pm, a, opts = {}) {
  ensureChatCss();
  const me = window.wpApp?.currentUser?.id, id = a.id || a.activity_id, dm = isDm(id);
  const n = (a.participants || []).length;
  const st = { list: [], stop: null, closed: false, reply: null, muted: !!a.muted };
  const ended = !dm && Date.now() > (pm._mpEndAt(a)?.getTime() || new Date(a.scheduled_at).getTime() + 3 * 3600e3);
  const head = dm
    ? `<span class="wp-ch-t"><b>${pm._esc(a.title || 'Mensaje')}</b>${a.other_username ? `<small>@${pm._esc(a.other_username)}</small>` : ''}</span>`
    : `<span class="wp-ch-t"><b>${pm._esc(a.title || 'Plan')}</b><small>${n} ${n === 1 ? 'va' : 'van'} · ${pm._phDayLabel(new Date(a.scheduled_at))} ${pm._hhmm(new Date(a.scheduled_at))}</small></span>`;
  // Solicitud: la que te llegó (decides tú) o la que mandaste (esperando)
  const reqIn = dm && a.status === 'request' && a.requested_by !== me;
  const reqOut = dm && a.status === 'request' && a.requested_by === me;
  let page = null;
  const onBack = opts.onBack ? () => { page.close(); setTimeout(opts.onBack, 360); return true; } : undefined;
  page = openSheetPage({
    title: head,
    right: dm ? `<span class="wp-ch-head-av" aria-hidden="true">${groupAvatar(pm, a, me)}</span>`
      : `<button type="button" class="wp-ch-head-av" data-group aria-label="Ver quién va">${groupAvatar(pm, a, me)}</button>`,
    theme: 'explore', onBack,
    onClose: () => { st.closed = true; st.stop?.(); st.stopPin?.(); markRead(id); opts.onClose?.(); },
    html: '<div class="wp-ch-list"><p class="wp-ch-load">Cargando…</p></div><button type="button" class="wp-ch-new" hidden>Nuevos mensajes ↓</button>',
    foot: `${quickOn(pm, a) ? `<div class="wp-ch-quick">${QUICK.map(q => `<button type="button" data-q="${q}">${q}</button>`).join('')}</div>` : ''}
      ${reqIn ? `<div class="wp-ch-req"><span><b>${pm._esc(a.title || 'Alguien')} quiere enviarte un mensaje</b><small>Si aceptas, podrán platicar. Si rechazas, no se entera.</small></span>
        <div><button type="button" data-req="no">Rechazar</button><button type="button" data-req="yes">Aceptar</button></div></div>` : ''}
      <form class="wp-ch-bar"${reqIn ? ' hidden' : ''}><button type="button" class="wp-ch-plus" aria-label="Enviar foto">${PLUS}</button><textarea rows="1" maxlength="1000" placeholder="Mensaje" enterkeyhint="send"></textarea>
        <button type="submit" class="wp-ch-send" disabled>Enviar</button></form>`,
  });
  page.root.classList.add('wp-ch-sheet');
  page.relayout();   // el pie cambia de forma con la clase (respuestas rápidas + barra)
  const vp = page.root.querySelector('.wp-st-vp'), box = page.body.querySelector('.wp-ch-list');
  const input = page.foot.querySelector('textarea'), send = page.foot.querySelector('.wp-ch-send'), fresh = page.body.querySelector('.wp-ch-new');
  const atBottom = () => vp.scrollHeight - vp.scrollTop - vp.clientHeight < 80;
  const toBottom = (smooth) => vp.scrollTo({ top: vp.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  const members = () => dm ? [] : [...new Set([a.creator_id, ...(a.participants || [])])].filter(x => x && x !== me)
    .map(x => ({ id: x, name: pm._phName(x, false) })).filter(x => x.name && x.name !== 'Alguien');
  const again = ended ? `<div class="wp-ch-again"><b>¿Repetimos?</b><span>Arma otro plan en el mismo lugar con los mismos</span>
      <button type="button" data-again>Repetir el plan</button></div>` : '';
  const paintAll = () => {
    box.innerHTML = (st.list.length ? messagesHtml(pm, st.list, me, members().map(x => x.name))
      : dm ? `<div class="wp-ch-empty"><b>Saluda a ${pm._esc((a.title || '').split(' ')[0] || 'tu amigo')}</b><span>${reqOut ? 'Le llegará como solicitud hasta que la acepte.' : 'Aquí empieza su conversación.'}</span></div>`
        : '<div class="wp-ch-empty"><b>Aquí platican los que van</b><span>Saluda al grupo o pónganse de acuerdo para llegar.</span></div>') + again;
    fillPhotos(box, st.list);
    paintPin();
  };
  // Franja del mensaje fijado
  // (va en la hoja, justo debajo del encabezado: no se mueve con el scroll)
  const pinEl = document.createElement('button');
  pinEl.type = 'button'; pinEl.className = 'wp-ch-pin'; pinEl.hidden = true;
  page.root.appendChild(pinEl);
  const paintPin = () => {
    const m = st.pin && st.list.find(x => x.id === st.pin);
    pinEl.hidden = !st.pin || !!m?.deleted_at;
    page.root.classList.toggle('has-pin', !pinEl.hidden);   // la lista deja espacio arriba
    if (pinEl.hidden) return;
    const who = !m ? '' : m.user_id === me ? 'Tú: ' : `${pm._phName(m.user_id, false)}: `;
    pinEl.innerHTML = `${PIN}<span><b>Mensaje fijado</b><small>${pm._esc(m ? who + (m.body || (m.image_path ? '📷 Foto' : '')) : 'Toca para verlo')}</small></span>`;
  };
  const setPin = (mid) => { st.pin = mid; paintPin(); page.relayout(); };
  pinEl.addEventListener('click', () => { if (st.pin) goTo(box, st.pin); });
  // Editar uno tuyo: la barra de escribir se vuelve "Editando…"
  const setEdit = (m) => {
    if (m) setReply(null);
    st.edit = m;
    send.textContent = m ? 'Guardar' : 'Enviar';
    page.foot.querySelector('.wp-ch-edit')?.remove();
    if (m) {
      const bar = document.createElement('div');
      bar.className = 'wp-ch-reply wp-ch-edit';
      bar.innerHTML = '<span><b>Editando mensaje</b><small></small></span><button type="button" aria-label="Cancelar edición">×</button>';
      bar.querySelector('small').textContent = m.body;
      bar.querySelector('button').addEventListener('click', () => { input.value = ''; grow(); setEdit(null); });
      page.foot.querySelector('.wp-ch-bar').before(bar);
      input.value = m.body; grow(); input.focus();
    }
    page.relayout();
  };
  const setReply = (m) => {
    if (m && st.edit) setEdit(null);
    st.reply = m;
    paintReply(pm, page.foot, m, me, () => setReply(null));
    page.relayout();
    if (m) input.focus();
  };
  // Agrega uno (repinta la racha anterior para mover carita y hora)
  const add = (m) => {
    if (st.list.some(x => x.id === m.id)) return;
    const stick = atBottom();
    m._new = true;   // solo el nuevo entra con animación
    st.list.push(m);
    paintAll();
    delete m._new;
    if (stick || m.user_id === me) toBottom(true);
    else fresh.hidden = false;
  };

  (async () => {
    await loadPeople(pm, a);
    try { st.list = await loadMessages(id, 80, a.cleared_at || null); } catch (e) { console.warn('[CHAT]', e.message || e); }
    try { st.pin = await loadPin(id); } catch (_) {}
    if (st.closed) return;
    paintAll(); toBottom(false);
    st.stopPin = onPin(id, (mid) => { if (!st.closed) setPin(mid); });
    markRead(id);
    st.stop = onMessages(id, (m) => { if (!st.closed) { add(m); if (m.user_id !== me) markRead(id); } },
      (m) => { const x = st.list.find(y => y.id === m.id); if (x && !st.closed) { Object.assign(x, m); paintAll(); } });
  })();

  const doSend = async (body, kind = 'text', extra = {}) => {
    body = body.trim(); if (!body && !extra.image_path) return;
    if (st.reply) { extra.reply_to = st.reply.id; setReply(null); }
    const tmp = { id: `tmp-${Date.now()}`, activity_id: id, user_id: me, kind, body, created_at: new Date().toISOString(), _pending: true, ...extra };
    add(tmp);
    pm._haptic?.('light');
    try {
      const m = await sendMessage(id, body, kind, extra);
      const i = st.list.indexOf(tmp);
      if (i >= 0) { st.list.splice(i, 1); if (!st.list.some(x => x.id === m.id)) st.list.splice(i, 0, m); }
      paintAll();
      const el = box.querySelector(`[data-id="${m.id}"] .wp-ch-time`);
      if (el) el.classList.add('sent');
    } catch (e) {
      st.list = st.list.filter(x => x !== tmp); paintAll();
      pm._showToast?.(/row-level|permission/i.test(e.message || '') ? (dm ? 'No puedes escribir en este chat' : 'Solo los que van pueden escribir aquí') : 'No se pudo enviar');
    }
  };

  const quick = page.foot.querySelector('.wp-ch-quick');
  const grow = () => {
    input.style.height = 'auto'; input.style.height = `${Math.min(110, input.scrollHeight)}px`;
    const has = !!input.value.trim();
    if (send.disabled === has) { send.disabled = !has; page.foot.classList.toggle('typing', has); }
    if (quick) quick.hidden = has;   // escribiendo: se esconden las respuestas rápidas
    page.relayout();
  };
  input.addEventListener('input', () => { grow(); paintMentions(pm, page.foot, input, members()); page.relayout(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); page.foot.querySelector('form').requestSubmit(); } });
  const doEdit = async (m, body) => {
    body = body.trim(); setEdit(null);
    if (!body || body === m.body) return;
    const keep = { body: m.body, edited_at: m.edited_at };
    m.body = body; m.edited_at = new Date().toISOString(); paintAll();
    try { await editMessage(m.id, body, id); pm._haptic?.('light'); }
    catch (e) { Object.assign(m, keep); paintAll(); pm._showToast?.(/15 minutos/.test(e.message || '') ? 'Ya pasaron 15 minutos' : 'No se pudo editar'); }
  };
  page.foot.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value; input.value = ''; grow();
    if (st.edit) doEdit(st.edit, v); else doSend(v);
    send.classList.remove('pop'); void send.offsetWidth; send.classList.add('pop');
  });
  page.foot.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-q]'); if (q) { doSend(q.dataset.q, 'quick'); return; }
    const r = e.target.closest('[data-req]'); if (!r) return;
    const yes = r.dataset.req === 'yes';
    try {
      await respondDm(id, yes);
      pm._haptic?.(yes ? 'medium' : 'light');
      a.status = yes ? 'active' : 'declined';
      if (!yes) { pm._showToast?.('Solicitud rechazada'); page.close(); return; }
      page.foot.querySelector('.wp-ch-req')?.remove();
      page.foot.querySelector('form').hidden = false;
      page.relayout();
      input.focus();
    } catch (_) { pm._showToast?.('No se pudo'); }
  });
  fitKeyboard(page, input, () => { if (st.list.length) toBottom(false); });
  fresh.addEventListener('click', () => { fresh.hidden = true; toBottom(true); });
  wireChatActions({
    pm, a, id, me, st, page, box, paintAll, setReply, setEdit, setPin, dm,
    sendPhoto: (path) => doSend('', 'text', { image_path: path }),
    openPlan: dm ? () => pm._mpPerson?.(a.other_id) : () => { page.close(); setTimeout(() => openFullPlan(pm, id), 360); },
  });
  box.addEventListener('click', (e) => { if (e.target.closest('[data-again]')) { page.close(); setTimeout(() => repeatPlan(pm, a, me), 360); } });
  vp.addEventListener('scroll', () => { if (!fresh.hidden && atBottom()) fresh.hidden = true; }, { passive: true });
  return page;
}

// Con el teclado abierto, la hoja va de abajo de la barra de estado hasta
// el teclado (si no, el teléfono recorre todo hacia arriba y se pierde la
// barra de arriba). El espacio sale de visualViewport.
function fitKeyboard(page, input, after) {
  const root = page.root, vv = window.visualViewport;
  const gapTop = () => parseFloat(getComputedStyle(root).top) || 0;
  let base = 0, focused = false;
  const fit = () => {
    if (!root.isConnected) { vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); return; }
    const h = vv ? vv.height : window.innerHeight, off = vv ? vv.offsetTop : 0;
    const kb = Math.max(0, Math.round(window.innerHeight - h - off));
    if (focused && (kb > 80 || off > 0 || h < window.innerHeight - 80)) {
      base = base || gapTop();
      root.style.top = `${Math.round(off + base)}px`;
      root.style.bottom = 'auto';
      root.style.height = `${Math.round(h - base)}px`;
    } else {
      root.style.top = ''; root.style.bottom = ''; root.style.height = '';
    }
    page.relayout();
    after?.();
  };
  input.addEventListener('focus', () => { focused = true; fit(); setTimeout(fit, 150); setTimeout(fit, 400); });
  input.addEventListener('blur', () => { focused = false; setTimeout(fit, 80); });
  vv?.addEventListener('resize', fit);
  vv?.addEventListener('scroll', fit);
}

// "Ver el plan" desde el chat: el plan completo (con la ficha prestada)
async function openFullPlan(pm, id) {
  const { data: a } = await getSupabase().from('activities').select('*').eq('id', id).maybeSingle();
  if (!a) return;
  const p = (window.wpApp?.mapView?.allPlaces || []).find(x => String(x.place_id || x.id) === String(a.place_id));
  pm._place = p || { place_id: a.place_id, id: a.place_id, name: a.place_name, lat: a.lat, lng: a.lng };
  pm._plans = [a];
  pm._openMyPlanSheet(a);
}

// Nombres y caras de los del plan (cache de la ficha)
async function loadPeople(pm, a) {
  pm._profCache = pm._profCache || new Map();
  const ids = [...new Set([a.creator_id, ...(a.participants || [])])].filter(x => x && !pm._profCache.has(x));
  if (!ids.length) return;
  try {
    const { getSupabase } = await import('/src/services/SupabaseService.js');
    const { data } = await getSupabase().from('profiles').select('id, name, username, avatar_url').in('id', ids);
    (data || []).forEach(p => pm._profCache.set(p.id, p));
  } catch (_) {}
}
