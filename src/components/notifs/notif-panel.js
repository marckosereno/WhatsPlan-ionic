// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — notifs/notif-panel.js
// La campanita de arriba: avisos de la app (no los mensajes del chat,
// salvo cuando te mencionan con @).
//  · Numerito en la campana con los no leídos; llega uno nuevo en vivo
//    (realtime de Supabase) → sube el número y la campana se mueve.
//  · Tocarla abre una hoja grande (la misma de "Volver" de siempre) con
//    los avisos en grupos: Hoy · Esta semana · Antes. Cada uno con su
//    ícono de color según el tipo, el texto y cuándo fue. Los nuevos
//    llevan un puntito azul; al abrir se marcan como leídos.
//  · Tocar un aviso de plan abre ese plan; una mención abre el chat.
//  · Deslizar para borrar, mantener presionado y el ⋯ de arriba
//    (notif-actions.js). El numerito se apaga al abrir; el puntito de
//    cada aviso se queda hasta tocarlo o cerrar la hoja (así se ve
//    cuáles eran nuevos).
//  · Jalar hacia abajo (arriba de la lista) → busca avisos nuevos.
//  · Sin internet: lo último que se vio (tab-cache.js) con aviso.
//
// Uso: const n = new NotifPanel({ getPM }); n.start(user) / n.stop()
// Estilos: /styles/notifs.css
// ════════════════════════════════════════════════════════════════════
import { SupabaseNotifService as Notif, getSupabase } from '/src/services/SupabaseService.js';
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { wave } from '/src/components/place-plans/wave.js';
import { openPlanChat } from '/src/components/chat/plan-chat.js';
import { cacheGet, cacheSet, withTimeout, netError, offlineNote } from '/src/components/tabs/tab-cache.js';
import { wireNotifActions, moreButton } from '/src/components/notifs/notif-actions.js';
import { SocialService } from '/src/services/SocialService.js';
import { liveWatch, showBanner } from '/src/components/live/live.js';

const I = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  cal:   I('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  // "se unió": destellos (en vez de los dos monitos)
  ppl:   I('<path d="M10 3.5 11.6 8a2 2 0 0 0 1.2 1.2l4.5 1.6-4.5 1.6a2 2 0 0 0-1.2 1.2L10 18.1l-1.6-4.5a2 2 0 0 0-1.2-1.2L2.7 10.8l4.5-1.6A2 2 0 0 0 8.4 8Z"/><path d="M18.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/><path d="M18 3l.5 1.3 1.3.5-1.3.5L18 6.6l-.5-1.3-1.3-.5 1.3-.5Z"/>'),
  party: I('<path d="M4 20 9 7l8 8-13 5Z"/><path d="M14 4v2M19 9h2M17.5 5.5 19 4"/>'),
  ticket:I('<path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3v4Z"/><path d="M13 4v12" stroke-dasharray="2 2"/>'),
  edit:  I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  route: I('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>'),
  x:     I('<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>'),
  at:    I('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>'),
  msg:   I('<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.4A8.5 8.5 0 1 1 21 12Z"/>'),
  trash: I('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  heart: I('<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.6 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.3 3.4 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>'),
  bell:  I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
};
// tipo → [ícono, color del cuadrito]
function kindOf(n) {
  const t = n.type || '', ti = n.title || '';
  if (t === 'plan_invite') return ['cal', 'blue'];
  if (t === 'plan_join' || t === 'join') return ['ppl', 'green'];
  if (t === 'plan_full') return ['party', 'green'];
  if (t === 'plan_reminder') return ['clock', 'blue'];
  if (t === 'plan_spot') return ['ticket', 'amber'];
  if (t === 'plan_decline' || t === 'plan_cancelled') return ['x', 'gray'];
  if (t === 'chat_mention') return ['at', 'violet'];
  if (t === 'dm_request') return ['msg', 'violet'];
  if (t === 'follow') return ['heart', 'pink'];
  if (t === 'plan_update') return [/hora/i.test(ti) ? 'clock' : /ruta|parada|quit/i.test(ti) ? 'route' : 'edit', 'blue'];
  return ['bell', 'gray'];
}
// Los títulos guardados traen emoji al inicio ("📅 Te invitaron…"): el
// ícono ya lo dice, así que se quita
const clean = (s) => String(s || '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();

export class NotifPanel {
  constructor({ getPM }) {
    this.getPM = getPM;
    this.btn = document.getElementById('topbar-notif-btn');
    this.list = []; this.unread = 0; this.sub = null; this.page = null;
    this.btn?.addEventListener('click', () => this.open());
  }

  async start(user) {
    if (user && this.sub && this.user?.id === user.id) return;   // misma sesión (p. ej. token renovado)
    this.stop();
    this.user = user;
    if (!user) return this._badge(0);
    await this.refreshCount();
    // En vivo (con reconexión y refresco al volver a la app: live.js)
    this.sub = liveWatch({
      refresh: () => this.refreshCount(),
      subscribe: (onStatus) => {
        const sb = getSupabase();
        const ch = sb.channel(`notifs-${user.id}-${Math.random().toString(36).slice(2, 7)}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p) => this._arrived(p?.new))
          .subscribe((st) => onStatus(st));
        return () => { try { sb.removeChannel(ch); } catch (_) {} };
      },
    });
  }

  stop() {
    try { this.sub?.(); } catch (_) {}
    this.sub = null; this.user = null; this._badge(0);
  }

  // Numerito desde la base (al arrancar, al volver a la app, sin canal)
  async refreshCount() {
    if (!this.user) return;
    try {
      const n = await withTimeout(Notif.getUnreadCount(this.user.id));
      if (n > this.unread && this.unread >= 0 && this._counted) this._ring();
      this._counted = true;
      if (!this.page) this._badge(n);
    } catch (_) {}
  }

  _ring() {
    this.btn?.classList.remove('ring'); void this.btn?.offsetWidth; this.btn?.classList.add('ring');
  }

  // Llegó un aviso en vivo: numerito, campana que se mueve y aviso arriba
  _arrived(n) {
    if (!n || n.type === 'chat_msg' || this.list.some(x => String(x.id) === String(n.id))) return;   // chat_msg es solo para el push
    this.list.unshift(n);
    if (this.page) { this.seen?.push(String(n.id)); this._paint(false); this.getPM()?._haptic?.('light'); return; }
    this._badge(this.unread + 1);
    this._ring();
    const [ic, col] = kindOf(n);
    showBanner({
      icon: `<i class="wp-nf-ic ${col}">${ICONS[ic]}</i>`, title: clean(n.title), body: n.body || '',
      onTap: () => this.openItem(n),
    });
  }

  _badge(n) {
    this.unread = Math.max(0, n | 0);
    if (!this.btn) return;
    let b = this.btn.querySelector('.wp-bell-n');
    if (!this.unread) { b?.remove(); return; }
    if (!b) { b = document.createElement('b'); b.className = 'wp-bell-n'; this.btn.appendChild(b); }
    b.textContent = this.unread > 99 ? '99+' : String(this.unread);
  }

  async open() {
    if (!this.user) { window.wpApp?.authModal?.show?.(); return; }
    if (this.page) return;
    this.getPM()?._haptic?.('light');
    this.onlyNew = false; this.keepUnread = new Set();
    this.page = openSheetPage({ title: 'Notificaciones', right: moreButton(),
      html: '<div class="wp-nf"><div class="wp-nf-sk"></div><div class="wp-nf-sk"></div><div class="wp-nf-sk"></div></div>',
      onClose: () => { this.page = null; document.body.classList.remove('wp-nf-open'); this.markSeen().catch(() => {}); } });
    this.page.root.classList.add('wp-nf-sheet');
    document.body.classList.add('wp-nf-open');   // menús y confirmación por encima de la hoja
    this.page.body.addEventListener('click', (e) => this._click(e));
    wireNotifActions(this);
    this._wirePull();
    this._badge(0);                               // ya los viste: se apaga el numerito
    try {
      this.list = await withTimeout(Notif.getNotificationsRich(this.user.id));
      this.offline = false;
      cacheSet('notifs', this.list.slice(0, 30));
    } catch (e) {
      this.offline = netError(e);
      this.list = this.offline ? (cacheGet('notifs')?.data || []) : [];
    }
    if (!this.page) return;
    this.seen = this.list.filter(n => !n.read).map(n => String(n.id));   // los que eran nuevos al abrir
    this._paint(true);
  }

  // ── Jalar para actualizar ──────────────────────────────────────────
  _wirePull() {
    const root = this.page.root, vp = root.querySelector('.wp-st-vp');
    // Burbuja como la del pull-up de la ficha: el anillo se dibuja con el
    // jalón; al llegar se pinta azul y dice "Suelta para buscar"; al
    // soltar el anillo gira mientras busca
    const ptr = document.createElement('div');
    ptr.className = 'wp-nf-ptr';
    ptr.innerHTML = `<span class="wp-nf-ptr-ic">
        <svg class="wp-nf-ptr-ring" viewBox="0 0 36 36"><circle class="trk" cx="18" cy="18" r="16"/><circle class="arc" cx="18" cy="18" r="16" stroke-dasharray="100.5" stroke-dashoffset="100.5"/></svg>
        <svg class="wp-nf-ptr-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
      </span><span class="wp-nf-ptr-txt">Suelta para buscar</span>`;
    root.appendChild(ptr);
    const arc = ptr.querySelector('.arc');
    const PULL = 110;
    let y0 = null, p = 0;
    const show = (v) => {
      p = v;
      const t = Math.min(1, v);
      ptr.style.setProperty('--p', t.toFixed(3));
      arc.setAttribute('stroke-dashoffset', (100.5 * (1 - t)).toFixed(1));
      ptr.classList.toggle('ready', v >= 1);
    };
    vp.addEventListener('touchstart', (e) => { y0 = vp.scrollTop <= 0 && !this.loading ? e.touches[0].clientY : null; }, { passive: true });
    vp.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy <= 0) { show(0); return; }
      const was = p >= 1;
      show(dy / PULL);
      if (!was && p >= 1) this.getPM()?._haptic?.('light');
    }, { passive: true });
    const end = () => {
      if (y0 == null) return;
      y0 = null;
      if (p >= 1) this.refresh(ptr); else show(0);
    };
    vp.addEventListener('touchend', end, { passive: true });
    vp.addEventListener('touchcancel', end, { passive: true });
    this._ptrShow = show;
  }

  async refresh(ptr) {
    if (this.loading || !this.page) return;
    this.loading = true;
    ptr?.classList.add('loading');
    const before = new Set(this.list.map(n => String(n.id)));
    try {
      const list = await withTimeout(Notif.getNotificationsRich(this.user.id));
      this.offline = false;
      cacheSet('notifs', list.slice(0, 30));
      const fresh = list.filter(n => !before.has(String(n.id)));
      fresh.forEach(n => { if (!n.read) this.seen.push(String(n.id)); });
      this.list = list;
      if (this.page) this._paint(!!fresh.length);
      this.getPM()?._showToast?.(fresh.length ? (fresh.length > 1 ? `${fresh.length} nuevas` : '1 nueva') : 'Estás al día');
    } catch (e) {
      this.getPM()?._showToast?.(netError(e) ? 'Sin conexión' : 'No se pudo actualizar');
    }
    setTimeout(() => { ptr?.classList.remove('loading'); this._ptrShow?.(0); this.loading = false; }, 350);
  }

  // Al cerrar (o "Marcar todas"): los que estaban nuevos quedan leídos,
  // menos los que marcaste como no leídos a propósito
  async markSeen(all = false) {
    if (!this.user || this.offline) return;
    if (all) { await Notif.markAllRead(this.user.id); this.seen = []; return; }
    const ids = (this.seen || []).filter(id => !this.keepUnread?.has(id));
    this.seen = [];
    if (!ids.length) return;
    await getSupabase().from('notifications').update({ read: true }).in('id', ids);
    this.list.forEach(n => { if (ids.includes(String(n.id))) n.read = true; });
  }

  _paint(animate) {
    const box = this.page.body.querySelector('.wp-nf');
    if (this.offline && !this.list.length) { box.innerHTML = offlineNote(false); return; }
    if (this.onlyNew && this.list.length && !this.list.some(n => !n.read)) {
      box.innerHTML = `<div class="wp-nf-empty"><i>${ICONS.bell}</i><b>Estás al día</b><span>No tienes avisos sin leer.</span></div>`;
      if (animate) wave(box, '.wp-nf-empty');
      return;
    }
    if (!this.list.length) {
      box.innerHTML = `<div class="wp-nf-empty"><i>${ICONS.bell}</i><b>Todo tranquilo</b><span>Aquí te avisamos cuando te inviten a un plan, alguien se una o te mencionen en un chat.</span></div>`;
      if (animate) wave(box, '.wp-nf-empty');
      return;
    }
    const pm = this.getPM(), now = new Date();
    const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const groups = [['Hoy', []], ['Esta semana', []], ['Antes', []]];
    this.list.forEach((n, i) => {
      if (this.onlyNew && n.read) return;
      const t = new Date(n.created_at).getTime();
      groups[t >= day0 ? 0 : t >= day0 - 6 * 864e5 ? 1 : 2][1].push([n, i]);
    });
    box.innerHTML = (this.offline ? offlineNote(true) : '') + groups.filter(g => g[1].length).map(([h, items]) => `<section class="wp-nf-sec"><h3>${h}</h3>
      ${items.map(([n, i]) => {
        const [ic, col] = kindOf(n);
        return `<div class="wp-nf-item${n.plan_state === 'past' || n.plan_state === 'gone' ? ' past' : ''}"><button type="button" class="wp-nf-del" aria-label="Borrar"><i>${ICONS.trash}</i><span>Borrar</span></button>
          <button type="button" class="wp-nf-row${n.read ? '' : ' new'}" data-i="${i}">
          <i class="wp-nf-ic ${col}">${ICONS[ic]}</i>
          <span class="wp-nf-txt"><b>${pm?._esc ? pm._esc(clean(n.title)) : clean(n.title)}</b>${n.body ? `<small>${pm?._esc ? pm._esc(n.body) : n.body}</small>` : ''}${this._extra(n)}</span>
          <span class="wp-nf-when">${this._when(n.created_at)}</span>
        </button></div>`;
      }).join('')}</section>`).join('');
    if (animate) wave(box, '.wp-off-bar, .wp-nf-sec > h3, .wp-nf-item', { max: 10 });
  }

  // Debajo del texto: cómo va el plan, o "Seguir también" si te siguieron
  _extra(n) {
    const st = { past: 'Ya pasó', gone: 'Ya no está disponible', declined: 'No vas', full: 'Lleno', going: 'Vas', open: '' }[n.plan_state] || '';
    if (st && /^plan_/.test(n.type || '')) return `<em class="wp-nf-st ${n.plan_state}">${st}</em>`;
    if (n.type === 'follow' && n.actor_id) {
      return n.i_follow ? '<em class="wp-nf-st going">Ya lo sigues</em>'
        : `<span class="wp-nf-act" data-follow="${n.actor_id}">Seguir también</span>`;
    }
    return '';
  }

  async _follow(btn) {
    const uid = btn.dataset.follow, me = this.user?.id; if (!me || btn.classList.contains('busy')) return;
    btn.classList.add('busy'); btn.textContent = 'Siguiendo…';
    try {
      await SocialService.follow(me, uid);
      this.list.forEach(x => { if (x.actor_id === uid) x.i_follow = true; });
      btn.outerHTML = '<em class="wp-nf-st going">Ya lo sigues</em>';
      this.getPM()?._haptic?.('medium');
    } catch (_) { btn.classList.remove('busy'); btn.textContent = 'Seguir también'; this.getPM()?._showToast?.('No se pudo seguir'); }
  }

  _when(iso) {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `${m} min`;
    if (m < 24 * 60) return `${Math.round(m / 60)} h`;
    const d = Math.round(m / 1440);
    if (d < 7) return `${d} d`;
    const dt = new Date(iso);
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  }

  async _click(e) {
    if (e.target.closest('[data-retry]')) { this.page?.close(); setTimeout(() => this.open(), 360); return; }
    const fb = e.target.closest('[data-follow]');
    if (fb) { e.stopPropagation(); this._follow(fb); return; }
    const row = e.target.closest('.wp-nf-row'); if (!row) return;
    const n = this.list[+row.dataset.i]; if (!n) return;
    row.classList.remove('new');
    this.openItem(n);
  }

  // Ir a lo que dice el aviso (desde la hoja o desde el aviso de arriba)
  async openItem(n) {
    if (!n.read) {                                   // tocarlo = leído
      n.read = true;
      if (!this.page) this._badge(this.unread - 1);
      getSupabase().rpc('notif_set_read', { p_id: String(n.id), p_read: true }).then(() => {}, () => {});
    }
    if (n.type === 'dm_request') {                   // solicitud de mensaje → Social › Solicitudes
      this.page?.close();
      setTimeout(() => { window.wpApp?.footer?.go?.('social'); setTimeout(() => window.wpApp?.socialTab?.showFilter?.('req'), 120); }, 320);
      return;
    }
    if (n.type === 'follow' && n.actor_id) {          // te siguieron → su perfil
      const pm0 = this.getPM(); this.page?.close();
      setTimeout(() => pm0?._openMiniProfile?.(n.actor_id, 'saved', n.actor_name || '', n.actor_avatar || ''), 320);
      return;
    }
    if (!n.activity_id) return;
    const pm = this.getPM(); if (!pm) return;
    if (n.plan_state === 'gone') { pm._showToast?.('Ese plan ya no está disponible'); return; }
    let a = null;
    try {
      const { data } = await withTimeout(getSupabase().from('activities').select('*').eq('id', n.activity_id).maybeSingle());
      a = data;
    } catch (_) {}
    if (!a) { pm._showToast?.(this.offline ? 'Sin conexión' : 'Ese plan ya no está disponible'); return; }
    this.page?.close();
    setTimeout(() => {
      if (n.type === 'chat_mention') openPlanChat(pm, a, {});
      else window.wpApp?.plansTab?._openPlan?.(a);
    }, 320);
  }
}
