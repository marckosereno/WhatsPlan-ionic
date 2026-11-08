// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/plan-chat.js
// La conversación de un plan, en la hoja grande (openSheetPage):
//  · Arriba: nombre del plan y "3 van · Hoy 7 pm".
//  · Mensajes (chat-render.js) que llegan en tiempo real; abre hasta abajo
//    y si estás leyendo más arriba no te mueve, solo aparece "Nuevos ↓".
//  · Abajo: respuestas rápidas cuando el plan está por empezar o en curso
//    (de 2 h antes a 1 h después de que termina) y la barra para
//    escribir con el botón de enviar.
//  · Lo que envías sale al instante ("Enviando…") y se confirma al
//    llegar; si falla, se quita y te avisa.
//  · Marca leído al abrir, al llegar mensajes y al cerrar.
//
// Uso: openPlanChat(pm, a, { onBack, onClose })   (pm = PlaceModal2)
// Estilos: /styles/chat.css (.wp-ch-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { loadMessages, sendMessage, markRead, onMessages } from '/src/components/chat/chat-service.js';
import { messagesHtml } from '/src/components/chat/chat-render.js';

const SEND = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6l.01 6.53L15 12l-11.59 1.87z"/></svg>';
const QUICK = ['🚗 Voy en camino', '👋 Ya llegué', '⏰ Llego tarde', '🙋 ¿Dónde están?'];

export function ensureChatCss() {
  if (document.getElementById('wp-chat-css')) return;
  const l = document.createElement('link');
  l.id = 'wp-chat-css'; l.rel = 'stylesheet'; l.href = '/styles/chat.css';
  document.head.appendChild(l);
}

function quickOn(pm, a) {
  const now = Date.now(), t0 = new Date(a.scheduled_at).getTime();
  const end = pm._mpEndAt(a)?.getTime() || t0 + 3 * 3600e3;
  return a.status !== 'cancelled' && now >= t0 - 2 * 3600e3 && now <= end + 3600e3;
}

export function openPlanChat(pm, a, opts = {}) {
  ensureChatCss();
  const me = window.wpApp?.currentUser?.id, id = a.id || a.activity_id;
  const n = (a.participants || []).length;
  const st = { list: [], stop: null, closed: false };
  let page = null;
  const onBack = opts.onBack ? () => { page.close(); setTimeout(opts.onBack, 360); return true; } : undefined;
  page = openSheetPage({
    title: `<span class="wp-ch-t"><b>${pm._esc(a.title || 'Plan')}</b><small>${n} ${n === 1 ? 'va' : 'van'} · ${pm._phDayLabel(new Date(a.scheduled_at))} ${pm._hhmm(new Date(a.scheduled_at))}</small></span>`,
    theme: 'explore', onBack,
    onClose: () => { st.closed = true; st.stop?.(); markRead(id); opts.onClose?.(); },
    html: '<div class="wp-ch-list"><p class="wp-ch-load">Cargando…</p></div><button type="button" class="wp-ch-new" hidden>Nuevos mensajes ↓</button>',
    foot: `${quickOn(pm, a) ? `<div class="wp-ch-quick">${QUICK.map(q => `<button type="button" data-q="${q}">${q}</button>`).join('')}</div>` : ''}
      <form class="wp-ch-bar"><textarea rows="1" maxlength="1000" placeholder="Escribe al grupo…" enterkeyhint="send"></textarea>
        <button type="submit" class="wp-ch-send" aria-label="Enviar" disabled>${SEND}</button></form>`,
  });
  page.root.classList.add('wp-ch-sheet');
  const vp = page.root.querySelector('.wp-st-vp'), box = page.body.querySelector('.wp-ch-list');
  const input = page.foot.querySelector('textarea'), send = page.foot.querySelector('.wp-ch-send'), fresh = page.body.querySelector('.wp-ch-new');
  const atBottom = () => vp.scrollHeight - vp.scrollTop - vp.clientHeight < 80;
  const toBottom = (smooth) => vp.scrollTo({ top: vp.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  const paintAll = () => {
    box.innerHTML = st.list.length ? messagesHtml(pm, st.list, me)
      : '<div class="wp-ch-empty"><b>Aquí platican los que van</b><span>Saluda al grupo o pónganse de acuerdo para llegar.</span></div>';
  };
  // Agrega uno (repinta la racha anterior para mover carita y hora)
  const add = (m) => {
    if (st.list.some(x => x.id === m.id)) return;
    const stick = atBottom();
    st.list.push(m);
    paintAll();
    if (stick || m.user_id === me) toBottom(true);
    else fresh.hidden = false;
  };

  (async () => {
    await loadPeople(pm, a);
    try { st.list = await loadMessages(id); } catch (e) { console.warn('[CHAT]', e.message || e); }
    if (st.closed) return;
    paintAll(); toBottom(false);
    markRead(id);
    st.stop = onMessages(id, (m) => { if (!st.closed) { add(m); if (m.user_id !== me) markRead(id); } });
  })();

  const doSend = async (body, kind = 'text') => {
    body = body.trim(); if (!body) return;
    const tmp = { id: `tmp-${Date.now()}`, activity_id: id, user_id: me, kind, body, created_at: new Date().toISOString(), _pending: true };
    add(tmp);
    pm._haptic?.('light');
    try {
      const m = await sendMessage(id, body, kind);
      const i = st.list.indexOf(tmp);
      if (i >= 0) { st.list.splice(i, 1); if (!st.list.some(x => x.id === m.id)) st.list.splice(i, 0, m); }
      paintAll();
    } catch (e) {
      st.list = st.list.filter(x => x !== tmp); paintAll();
      pm._showToast?.(/row-level|permission/i.test(e.message || '') ? 'Solo los que van pueden escribir aquí' : 'No se pudo enviar');
    }
  };

  const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(110, input.scrollHeight)}px`; send.disabled = !input.value.trim(); page.relayout(); };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); page.foot.querySelector('form').requestSubmit(); } });
  page.foot.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value; input.value = ''; grow(); doSend(v);
  });
  page.foot.addEventListener('click', (e) => { const q = e.target.closest('[data-q]'); if (q) doSend(q.dataset.q, 'quick'); });
  fresh.addEventListener('click', () => { fresh.hidden = true; toBottom(true); });
  vp.addEventListener('scroll', () => { if (!fresh.hidden && atBottom()) fresh.hidden = true; }, { passive: true });
  return page;
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
