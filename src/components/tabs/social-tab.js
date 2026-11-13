// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — tabs/social-tab.js
// Pestaña "Social" de la barra de abajo: los chats de tus planes.
//  · Arriba "Mensajes" y los chips Todos · Sin leer.
//  · Secciones: En curso (fijos arriba, punto verde) · Próximos · Ya
//    pasaron (los de los últimos 30 días).
//  · Cada chat: las caras redondas de los que van (una si es una persona,
//    racimo de dos + "+3" si es grupo), nombre del plan, último mensaje
//    ("Ana: ya llegué"), la hora y cuántos sin leer.
//  · Tocar abre la conversación (chat/plan-chat.js); al cerrar se
//    actualiza la lista y el numerito de la barra.
//  · Mientras está abierta, los mensajes nuevos la refrescan solos.
//  · Mensajes directos (chat/dm-chat.js): en "Todos" su propia sección
//    "Directos"; las solicitudes que te llegan van aparte en la pestaña
//    "Solicitudes" (con su numerito) y no suman al numerito de la barra.
//  · Sin internet: la lista de la última vez (tab-cache.js) con un aviso,
//    o "Sin conexión" si nunca se cargó; al volver la red se recarga.
//
// Uso: const t = new SocialTab({ getPM, getPlaces, onGoPlans, onUnread }); t.open(); t.close()
//      t.refreshUnread() → total sin leer (para el numerito de la barra)
// Estilos: /styles/tabs.css (.wp-pt-*) + /styles/chat.css (.wp-so-*)
// ════════════════════════════════════════════════════════════════════
import { openTabScreen } from '/src/components/tabs/tab-screen.js';
import { myChats, myDmChats, onMessages } from '/src/components/chat/chat-service.js';
import { dmShape, openDmChat, rememberPerson } from '/src/components/chat/dm-chat.js';
import { openPlanChat, ensureChatCss } from '/src/components/chat/plan-chat.js';
import { previewText, shortWhen, groupAvatar } from '/src/components/chat/chat-render.js';
import { getSupabase } from '/src/services/SupabaseService.js';
import { wave } from '/src/components/place-plans/wave.js';
import { liveWatch, showBanner } from '/src/components/live/live.js';
import { wireSocialHold } from '/src/components/tabs/social-actions.js';
import { inviteFriends, INVITE_ICON } from '/src/services/InviteFriends.js';
import { cacheGet, cacheSet, withTimeout, netError, peopleOf, restorePeople, offlineNote, whenOnline } from '/src/components/tabs/tab-cache.js';

const PIN = '<i class="wp-so-pin" aria-label="Fijado"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.8V5h6v5.8l2.5 3.2H6.5Z"/><path d="M8 5h8"/></svg></i>';
const MUTED = '<i class="wp-so-muted" aria-label="Silenciado"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M18.6 13A17 17 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.3-5"/><path d="m2 2 20 20"/></svg></i>';

export class SocialTab {
  constructor({ getPM, getPlaces, onGoPlans, onUnread }) {
    Object.assign(this, { getPM, getPlaces, onGoPlans, onUnread });
    this.scr = null; this.chats = []; this.filter = 'all'; this.openId = null; this.stop = null; this.t = 0;
  }

  open() {
    ensureChatCss();
    if (this.scr?.root.isConnected) return;
    this.scr = openTabScreen('social', `
      <header class="wp-pt-head"><h1>Mensajes</h1><span>Tus planes y tus amigos</span><button type="button" class="wp-pt-inv" data-invite aria-label="Invitar amigos">${INVITE_ICON}<b>Invitar</b></button></header>
      <div class="wp-pt-tabs"><button type="button" data-f="all" class="on">Todos</button><button type="button" data-f="unread">Sin leer</button><button type="button" data-f="req">Solicitudes<b class="wp-so-reqn" hidden></b></button></div>
      <div class="wp-so-list"><div class="wp-so-sk"></div><div class="wp-so-sk"></div><div class="wp-so-sk"></div></div>`);
    this.scr.root.addEventListener('click', (e) => this._click(e));
    wireSocialHold(this);   // mantener presionado un chat: fijar, silenciar, ocultar…
    wave(this.scr.body);
    this._load();
  }

  close() { this.scr?.close(); this.scr = null; this.waved = false; this._unOnline?.(); this._unOnline = null; }

  // Con sesión: numerito de sin leer + escuchar mensajes nuevos
  startChats() { this.refreshUnread(); this.listen(); }

  // Escuchar mensajes de todos tus planes y directos (numerito y lista)
  listen() {
    if (this.stop || !window.wpApp?.currentUser) return;
    const got = (m) => {
      const chatId = m.thread_id ? `dm:${m.thread_id}` : m.activity_id;
      if (m.user_id === window.wpApp?.currentUser?.id || chatId === this.openId) return;
      if (m.kind !== 'system') this._banner = { m, chatId };
      clearTimeout(this.t);
      this.t = setTimeout(async () => {
        await (this.scr ? this._load() : this.refreshUnread());
        this._showBanner();
      }, 400);
    };
    // Dos canales (planes + directos) cuidados por liveWatch: si se caen
    // o el teléfono duerme la app, se reconectan y se refresca al volver
    this.stop = liveWatch({
      refresh: () => (this.scr ? this._load() : this.refreshUnread()),
      subscribe: (onStatus) => {
        const st = {};
        const tell = (k) => (s) => { st[k] = s; onStatus(st.plan === 'SUBSCRIBED' && st.dm === 'SUBSCRIBED' ? 'SUBSCRIBED' : (s === 'SUBSCRIBED' ? 'JOINING' : s)); };
        const s1 = onMessages(null, got, null, tell('plan')), s2 = onMessages('dm:', got, null, tell('dm'));
        return () => { s1(); s2(); };
      },
    });
  }

  // Aviso arriba con el mensaje que llegó (si no estás en Social ni en
  // ese chat, y el chat no está silenciado). Tocarlo abre el chat.
  _showBanner() {
    const b = this._banner; this._banner = null;
    if (!b || this.scr || b.chatId === this.openId) return;
    const c = this.chats.find(x => String(x.activity_id) === String(b.chatId));
    if (!c || c.muted || this._isReq(c)) return;   // las solicitudes ya avisan en la campanita
    const pm = this.getPM(); if (!pm) return;
    const me = window.wpApp?.currentUser?.id, m = b.m;
    const who = c.kind === 'dm' ? c.title : `${pm._phName(m.user_id, false)} · ${c.title}`;
    showBanner({
      icon: groupAvatar(pm, c.kind === 'dm' ? c : { participants: [m.user_id], creator_id: m.user_id }, me),
      title: who, body: m.body || (m.image_path ? '📷 Foto' : ''),
      onTap: () => this._openChat(c),
    });
  }

  // Chat abierto por fuera (p. ej. "Enviar mensaje" de un perfil): sus
  // mensajes no cuentan como sin leer mientras está abierto
  watchOpen(id) { this.openId = id; if (!id) this.refreshUnread(); }

  // Abrir directo en una pestaña (la campanita → Solicitudes)
  showFilter(f) {
    this.filter = f;
    this.scr?.body.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === f));
    if (this.scr) this._paint();
  }

  async refreshUnread() {
    try {
      const me = window.wpApp?.currentUser?.id;
      const [plans, dms] = await withTimeout(Promise.all([myChats(), myDmChats().catch(() => [])]));
      const pm = this.getPM();
      dms.forEach(r => rememberPerson(pm, { id: r.other_id, name: r.other_name, username: r.other_username, avatar_url: r.other_avatar }));
      this.chats = [...plans, ...dms.map(r => dmShape(r, me))];
      this.offline = false;
      cacheSet('chats', this.chats.slice(0, 120));
    } catch (e) {
      this.offline = netError(e);
      if (!this.offline) return 0;
      if (!this.chats.length) this.chats = cacheGet('chats')?.data || [];   // lo último que se vio
      this._waitOnline();
    }
    return this._count();
  }

  // Numerito de la barra: los silenciados y las solicitudes no suman;
  // "marcado como no leído" cuenta 1
  _count() {
    const n = this.chats.reduce((s, c) => s + (c.muted || this._isReq(c) ? 0 : (c.unread || (c.unread_mark ? 1 : 0))), 0);
    this.onUnread?.(n);
    return n;
  }

  async _load() {
    await this.refreshUnread();
    if (!this.scr) return;
    if (this.offline) restorePeople(this.getPM(), cacheGet('chats:people')?.data);
    else await this._loadPeople();
    this._paint();
  }

  _waitOnline() {
    if (this._unOnline) return;
    this._unOnline = whenOnline(() => { this._unOnline = null; this.scr ? this._load() : this.refreshUnread(); });
  }

  async _loadPeople() {
    const pm = this.getPM(); if (!pm) return;
    pm._profCache = pm._profCache || new Map();
    const ids = [...new Set(this.chats.flatMap(c => [c.last_user, c.creator_id, ...(c.participants || []).slice(0, 4)]))].filter(x => x && !pm._profCache.has(x));
    if (!ids.length) return;
    try {
      const { data } = await getSupabase().from('profiles').select('id, name, username, avatar_url').in('id', ids);
      (data || []).forEach(p => pm._profCache.set(p.id, p));
    } catch (_) {}
    cacheSet('chats:people', peopleOf(pm, this.chats.flatMap(c => [c.last_user, c.creator_id, ...(c.participants || []).slice(0, 4)])));
  }

  // Solicitud que te llegó (decides tú)
  _isReq(c) { return c.kind === 'dm' && c.status === 'request' && c.requested_by !== window.wpApp?.currentUser?.id; }

  _state(c) {
    const now = Date.now(), t0 = new Date(c.scheduled_at).getTime();
    const end = c.ends_at ? new Date(c.ends_at).getTime() : t0 + 3 * 3600e3;
    return c.status === 'cancelled' || now > end ? 'past' : now >= t0 ? 'live' : 'next';
  }

  _paint() {
    const pm = this.getPM(), me = window.wpApp?.currentUser?.id, box = this.scr.body.querySelector('.wp-so-list');
    const reqs = this.chats.filter(c => this._isReq(c));
    const rn = this.scr.body.querySelector('.wp-so-reqn');
    if (rn) { rn.hidden = !reqs.length; rn.textContent = reqs.length > 99 ? '99+' : reqs.length; }
    if (this.offline && !this.chats.length) { box.innerHTML = offlineNote(false); wave(box, '.wp-off-box'); return; }
    if (this.filter === 'req') { this._paintReqs(pm, me, box, reqs); return; }
    const shown = this.chats.filter(c => !this._isReq(c) && (this.filter === 'all' || c.unread > 0 || c.unread_mark));
    if (!shown.length) {
      box.innerHTML = this.chats.length ? '<div class="wp-pt-empty"><b>Estás al día</b><span>No tienes mensajes sin leer</span></div>'
        : `<div class="wp-pt-empty"><b>Aún no tienes chats</b><span>Cuando organices o te unas a un plan, aquí platicas con los que van.</span>
            <button type="button" class="wp-pt-cta" data-go-plans style="margin-top:12px">Ver planes</button>
            <button type="button" class="wp-pt-cta soft" data-invite style="margin-top:8px">${INVITE_ICON}&nbsp;Invitar amigos</button></div>`;
      return;
    }
    const sec = { pin: [], live: [], dm: [], next: [], past: [] };
    shown.forEach(c => sec[c.pinned_at ? 'pin' : c.kind === 'dm' ? 'dm' : this._state(c)].push(c));
    sec.pin.sort((x, y) => new Date(x.pinned_at) - new Date(y.pinned_at));
    sec.next.sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
    sec.dm.sort((x, y) => new Date(y.last_at) - new Date(x.last_at));
    const title = { pin: 'Fijados', live: 'En curso', dm: 'Directos', next: 'Próximos', past: 'Ya pasaron' };
    box.innerHTML = ['pin', 'live', 'dm', 'next', 'past'].filter(k => sec[k].length).map(k => `<section class="wp-so-sec ${k}"><h3>${title[k]}</h3>
      ${sec[k].map(c => this._row(pm, c, me, k)).join('')}</section>`).join('');
    if (this.offline) box.insertAdjacentHTML('afterbegin', offlineNote(true));
    if (!this.waved) { this.waved = true; wave(box, '.wp-off-bar, h3, .wp-so-row'); }   // la primera vez, en ola
  }

  // Pestaña Solicitudes: quién te quiere escribir y su primer mensaje
  _paintReqs(pm, me, box, reqs) {
    if (!reqs.length) {
      box.innerHTML = '<div class="wp-pt-empty"><b>Sin solicitudes</b><span>Cuando alguien que te sigue (y tú no a esa persona) te escriba, su mensaje llega aquí primero.</span></div>';
      wave(box, '.wp-pt-empty');
      return;
    }
    box.innerHTML = `<p class="wp-so-reqhint">Si aceptas, podrán platicar. Si rechazas, no se entera.</p>${reqs.map(c => this._row(pm, c, me, 'req')).join('')}`;
    wave(box, '.wp-so-reqhint, .wp-so-row');
  }

  _row(pm, c, me, k) {
    const i = this.chats.indexOf(c);
    const tag = c.kind === 'dm' && c.status === 'request' && c.requested_by === me ? '<em class="wp-so-tag">Pendiente</em>' : '';
    const unread = c.unread || c.unread_mark;
    return `<button type="button" class="wp-so-row${unread ? ' unread' : ''}" data-i="${i}">
        <span class="wp-so-pic">${groupAvatar(pm, c, me)}${k === 'live' ? '<em class="wp-so-live"></em>' : ''}</span>
        <span class="wp-so-txt"><b>${pm._esc(c.title || 'Plan')}${tag}</b><small>${pm._esc(previewText(pm, c, me))}</small></span>
        <span class="wp-so-side"><small>${shortWhen(pm, c.last_at || c.scheduled_at)}</small>${c.unread ? `<b class="wp-so-n${c.muted ? ' muted' : ''}">${c.unread > 99 ? '99+' : c.unread}</b>` : c.unread_mark ? `<b class="wp-so-n dot${c.muted ? ' muted' : ''}"></b>` : c.muted ? MUTED : ''}${c.pinned_at ? PIN : ''}</span>
      </button>`;
  }

  _click(e) {
    if (this._swallow) { this._swallow = false; return; }   // fue mantener presionado
    if (e.target.closest('[data-retry]')) { this._load(); return; }
    if (e.target.closest('[data-invite]')) { inviteFriends(); return; }
    if (e.target.closest('[data-go-plans]')) { this.onGoPlans?.(); return; }
    const f = e.target.closest('[data-f]');
    if (f) { this.filter = f.dataset.f; this.scr.body.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b === f)); this._paint(); return; }
    const row = e.target.closest('.wp-so-row');
    if (row) this._openChat(this.chats[+row.dataset.i]);
  }

  _openChat(c) {
    const pm = this.getPM(); if (!c || !pm) return;
    const a = { ...c, id: c.activity_id };
    this.openId = a.id;
    const opts = { onClose: () => { this.openId = null; this._load(); } };
    if (c.kind === 'dm') openDmChat(pm, a, opts); else openPlanChat(pm, a, opts);
  }
}
