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
//
// Uso: const t = new SocialTab({ getPM, getPlaces, onGoPlans, onUnread }); t.open(); t.close()
//      t.refreshUnread() → total sin leer (para el numerito de la barra)
// Estilos: /styles/tabs.css (.wp-pt-*) + /styles/chat.css (.wp-so-*)
// ════════════════════════════════════════════════════════════════════
import { openTabScreen } from '/src/components/tabs/tab-screen.js';
import { myChats, onMessages } from '/src/components/chat/chat-service.js';
import { openPlanChat, ensureChatCss } from '/src/components/chat/plan-chat.js';
import { previewText, shortWhen, groupAvatar } from '/src/components/chat/chat-render.js';
import { getSupabase } from '/src/services/SupabaseService.js';

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
      <header class="wp-pt-head"><h1>Mensajes</h1><span>Con los que van a tus planes</span></header>
      <div class="wp-pt-tabs"><button type="button" data-f="all" class="on">Todos</button><button type="button" data-f="unread">Sin leer</button></div>
      <div class="wp-so-list"><div class="wp-so-sk"></div><div class="wp-so-sk"></div><div class="wp-so-sk"></div></div>`);
    this.scr.root.addEventListener('click', (e) => this._click(e));
    this._load();
  }

  close() { this.scr?.close(); this.scr = null; }

  // Con sesión: numerito de sin leer + escuchar mensajes nuevos
  startChats() { this.refreshUnread(); this.listen(); }

  // Escuchar mensajes de todos tus planes (para el numerito y la lista)
  listen() {
    if (this.stop || !window.wpApp?.currentUser) return;
    this.stop = onMessages(null, (m) => {
      if (m.user_id === window.wpApp?.currentUser?.id || m.activity_id === this.openId) return;
      clearTimeout(this.t);
      this.t = setTimeout(() => (this.scr ? this._load() : this.refreshUnread()), 400);
    });
  }

  async refreshUnread() {
    try { this.chats = await myChats(); } catch (_) { return 0; }
    const n = this.chats.reduce((s, c) => s + (c.muted ? 0 : c.unread || 0), 0);   // los silenciados no suman
    this.onUnread?.(n);
    return n;
  }

  async _load() {
    await this.refreshUnread();
    if (!this.scr) return;
    await this._loadPeople();
    this._paint();
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
  }

  _state(c) {
    const now = Date.now(), t0 = new Date(c.scheduled_at).getTime();
    const end = c.ends_at ? new Date(c.ends_at).getTime() : t0 + 3 * 3600e3;
    return c.status === 'cancelled' || now > end ? 'past' : now >= t0 ? 'live' : 'next';
  }

  _paint() {
    const pm = this.getPM(), me = window.wpApp?.currentUser?.id, box = this.scr.body.querySelector('.wp-so-list');
    const shown = this.chats.filter(c => this.filter === 'all' || c.unread > 0);
    if (!shown.length) {
      box.innerHTML = this.chats.length ? '<div class="wp-pt-empty"><b>Estás al día</b><span>No tienes mensajes sin leer</span></div>'
        : `<div class="wp-pt-empty"><b>Aún no tienes chats</b><span>Cuando organices o te unas a un plan, aquí platicas con los que van.</span>
            <button type="button" class="wp-pt-cta" data-go-plans style="margin-top:12px">Ver planes</button></div>`;
      return;
    }
    const sec = { live: [], next: [], past: [] };
    shown.forEach(c => sec[this._state(c)].push(c));
    sec.next.sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
    const title = { live: 'En curso', next: 'Próximos', past: 'Ya pasaron' };
    box.innerHTML = ['live', 'next', 'past'].filter(k => sec[k].length).map(k => `<section class="wp-so-sec ${k}"><h3>${title[k]}</h3>
      ${sec[k].map(c => this._row(pm, c, me, k)).join('')}</section>`).join('');
  }

  _row(pm, c, me, k) {
    const i = this.chats.indexOf(c);
    return `<button type="button" class="wp-so-row${c.unread ? ' unread' : ''}" data-i="${i}">
        <span class="wp-so-pic">${groupAvatar(pm, c, me)}${k === 'live' ? '<em class="wp-so-live"></em>' : ''}</span>
        <span class="wp-so-txt"><b>${pm._esc(c.title || 'Plan')}</b><small>${pm._esc(previewText(pm, c, me))}</small></span>
        <span class="wp-so-side"><small>${shortWhen(pm, c.last_at || c.scheduled_at)}</small>${c.unread ? `<b class="wp-so-n${c.muted ? ' muted' : ''}">${c.unread > 99 ? '99+' : c.unread}</b>` : c.muted ? MUTED : ''}</span>
      </button>`;
  }

  _click(e) {
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
    openPlanChat(pm, a, { onClose: () => { this.openId = null; this._load(); } });
  }
}
