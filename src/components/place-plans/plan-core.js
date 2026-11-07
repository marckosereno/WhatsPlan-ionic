// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-core.js
// Planes en la ficha del lugar: estado (_loadPlanState), el botón que
// cambia según tus planes y las RPCs. Las hojas viven aparte:
// "Tu plan" en my-plan.js / my-plan-actions.js y "Planes aquí" en
// plans-here.js (+ -open, -days).
// Se mezcla en PlaceModal2.prototype (usa this._el, this._openSheet,
// this._showToast, etc. de la ficha). Estilos: /styles/place-plans.css
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { getAvatarUrl } from '/src/services/AvatarService.js';

export class PlanCore {
  // ── Botón "Planear visita" según los planes del lugar ───────────────
  //  · Tienes plan (lo organizas o vas) → "Tu plan · Hoy 9 pm" + caritas
  //    asomando por la esquina + chip "en 2 h" / punto verde si es ahora
  //  · Te invitaron → "Te invitaron · Responder" + caritas
  //  · Hay planes de otros que puedes ver → "Planear visita" + caritas +
  //    badge "2 planes"
  //  · Nada → "Planear visita" de siempre
  async _loadPlanState(place) {
    this._plans = [];
    this._profCache = this._profCache || new Map();
    this._paintPlanBtn();
    const pid = String(place?.place_id || place?.id || '');
    if (!pid) return;
    try {
      const sb = getSupabase();
      const since = new Date(Date.now() - 2 * 3600e3).toISOString();
      const { data, error } = await sb.from('activities').select('*')
        .eq('place_id', pid).eq('status', 'active').gt('scheduled_at', since)
        .order('scheduled_at', { ascending: true }).limit(20);
      if (error) throw error;
      if (this._place !== place) return;
      // + planes que pasan por aquí como parada (si ya existe la columna)
      try {
        const { data: viaStop } = await sb.from('activities').select('*')
          .contains('stops', JSON.stringify([{ place_id: pid }])).eq('status', 'active').gt('scheduled_at', since).limit(10);
        (viaStop || []).forEach(a => { if (!data.some(b => b.id === a.id)) data.push(a); });
      } catch (_) {}
      const ids = [...new Set((data || []).flatMap(a => [a.creator_id, ...(a.participants || []), ...(a.invited || [])]))]
        .filter(id => id && !this._profCache.has(id)).slice(0, 80);
      if (ids.length) {
        const { data: ps } = await sb.from('profiles').select('id, name, username, avatar_url').in('id', ids);
        (ps || []).forEach(p => this._profCache.set(p.id, p));
      }
      if (this._place !== place) return;
      this._plans = data || [];
      this._paintPlanBtn(true);
    } catch (e) { console.warn('[DIAG-PLAN] planes del lugar:', e?.message || e); }
  }

  _planGroups() {
    const me = window.wpApp?.currentUser?.id;
    const plans = this._plans || [];
    const mine = plans.find(a => a.creator_id === me) || plans.find(a => (a.participants || []).includes(me)) || null;
    const pending = plans.filter(a => a !== mine && a.creator_id !== me && (a.invited || []).includes(me)
      && !(a.participants || []).includes(me) && !(a.declined || []).includes(me));
    const others = plans.filter(a => a !== mine);
    return { me, mine, pending, others };
  }

  // Reglas del plan (chips). [clave, emoji, texto, excluye]
  _planRules() {
    return [
      ['split', '💵', 'Cada quien paga', 'treat'], ['treat', '🤝', 'Yo invito', 'split'], ['cash', '💳', 'Llevar efectivo'],
      ['punctual', '⏰', 'Puntual, no esperamos'], ['ride', '🚗', 'Hay raite'], ['parking', '🅿️', 'Hay estacionamiento'],
      ['adults', '🔞', 'Solo mayores de 18', 'kids'], ['kids', '👶', 'Niños bienvenidos', 'adults'], ['pets', '🐶', 'Mascotas OK'],
    ];
  }

  _planRulesHtml(a, cls = '') {
    const R = this._planRules(), on = (a?.rules || []).map(k => R.find(r => r[0] === k)).filter(Boolean);
    return on.length ? `<div class="wp-pv-rules-ro ${cls}">${on.map(([, e, t]) => `<span>${e} ${this._esc(t)}</span>`).join('')}</div>` : '';
  }

  _planEmoji(t) {
    const G = { food: '🍔', drinks: '☕', hangout: '🎉', explore: '🚀', shop: '🛍️', music: '🎵', sport: '🏃', photo: '📸', spa: '💆' };
    return G[t] || (this._actTypes || []).find(x => x.key === t)?.emoji || '🎉';
  }

  _planWhen(at, short = false) {
    const d = new Date(at), today = new Date(); today.setHours(0, 0, 0, 0);
    const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const i = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 86400000);
    const dl = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${DOW[d.getDay()]} ${d.getDate()}`;
    const h = d.getHours(), m = d.getMinutes();
    const hh = `${h > 12 ? h - 12 : h || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}`;
    return short ? `${dl} ${hh}` : `${dl} · ${hh}`;
  }

  _planFace(id) {
    const p = this._profCache?.get(id) || {};
    return `<i class="wp-seal" style="background-image:url('${this._esc(p.avatar_url || getAvatarUrl(p.name || p.username || 'user'))}')"></i>`;
  }

  _paintPlanBtn(animate = false) {
    const btn = this._el?.querySelector('#wp-pm2-plan-btn');
    if (!btn) return;
    const { me, mine, pending, others } = this._planGroups();
    const ARROW = '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M464 256c0-114.87-93.13-208-208-208S48 141.13 48 256s93.13 208 208 208 208-93.13 208-208Zm-228.5 91.36a16 16 0 0 1-.09-22.63L303.58 272H170a16 16 0 0 1 0-32h133.58l-52.32-52.73A16 16 0 1 1 274 164.73l79.39 80a16 16 0 0 1 0 22.54l-79.39 80A16 16 0 0 1 235.5 347.36Z"/></svg>';
    const CAL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="m9 15 2 2 4-4"/></svg>';
    let label = 'Planear visita', icon = ARROW, faces = [], badge = '', chip = '', state = 'none';
    if (mine) {
      state = 'mine';
      icon = CAL;
      label = mine.creator_id === me ? 'Ver tu plan' : 'Vas a ir';
      // tú primero (ya estás dentro) + quien organiza + los demás que van
      const others = (mine.participants || []).filter(id => id !== me);
      faces = [me, ...(others.length ? others : (mine.invited || []).filter(id => id !== me))];
      const mins = Math.round((new Date(mine.scheduled_at) - Date.now()) / 60000);
      const n = (mine.participants || []).length;
      if (mins <= 0) badge = { html: '<i class="dot"></i>Ahora', cls: 'live' };
      else if (this._planFull(mine)) badge = { html: `✓ ${n}/${n} Completo`, cls: 'full' };
      else if (mins < 60) badge = { html: `En ${mins} min`, cls: '' };
      else if (mins < 6 * 60) badge = { html: `En ${Math.round(mins / 60)} h`, cls: '' };
      else badge = { html: this._esc(this._planWhen(mine.scheduled_at, true)), cls: '' };
      // te invitaron a OTRO plan aquí: puntito azul con el número junto al texto
      if (pending.length) chip = `<i class="wp-pm2-plan-dot" aria-label="${pending.length} invitación${pending.length > 1 ? 'es' : ''}">${pending.length}</i>`;
    } else if (pending.length) {
      state = 'invited';
      label = 'Te invitaron · Responder';
      faces = pending.map(a => a.creator_id);
      badge = { html: pending.length > 1 ? `${pending.length} invitaciones` : 'Invitación', cls: 'inv' };
    } else if (others.length) {
      state = 'others';
      faces = [...new Set(others.map(a => a.creator_id))];
      badge = `${others.length} plan${others.length > 1 ? 'es' : ''}`;
    }
    btn.dataset.state = state;
    const shown = faces.slice(0, 3);
    const bHtml = badge && typeof badge === 'object' ? `<b class="${badge.cls}">${badge.html}</b>`
      : badge ? `<b>${this._esc(badge)}</b>` : faces.length > 3 ? `<b>+${faces.length - 3}</b>` : '';
    btn.innerHTML = `${icon}<span class="wp-pm2-plan-lbl">${this._esc(label)}</span>${chip}` +
      (shown.length ? `<span class="wp-pm2-plan-faces">${shown.map(id => this._planFace(id)).join('')}${bHtml}</span>` : '');
    if (animate && state !== 'none') {
      const f = btn.querySelector('.wp-pm2-plan-faces');
      if (f) { f.classList.remove('in'); void f.offsetWidth; f.classList.add('in'); }
    }
  }

  // Tocar el botón: a dónde lleva según el estado
  _onPlanBtn() {
    const { mine, pending, others } = this._planGroups();
    if (mine) this._openMyPlanSheet(mine);
    else if (pending.length || others.length) this._openPlansHereSheet();
    else this._openPlanSheet();
  }

  _planShare(a) {
    const info = this._placeInfo();
    const txt = `¿Vamos? ${a.title} · ${this._planWhen(a.scheduled_at)}${info.address ? ' · ' + info.address : ''}${info.url ? '\n' + info.url : ''}`;
    try {
      if (navigator.share) navigator.share({ title: a.title, text: txt }).catch(() => {});
      else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
    } catch (_) {}
  }

  _planFull(a) { return !!a?.max_participants && (a.participants || []).length >= a.max_participants; }

  // opts.onError(error) → true si ya lo manejó (no se muestra el aviso)
  async _planRpc(fn, args, okMsg, opts = {}) {
    const { error } = await getSupabase().rpc(fn, args);
    if (error) {
      try { if (opts.onError?.(error)) return false; } catch (_) {}
      const missing = error.code === 'PGRST202' || new RegExp(fn).test(error.message || '');
      console.warn('[DIAG-PLAN]', fn, error.message || error, missing ? '(falta activities_plans.sql)' : '');
      this._showToast(missing ? 'Esta función aún no está activa' : (error.message || 'No se pudo'));
      return false;
    }
    this._haptic?.('success');
    if (okMsg) this._showToast(okMsg);
    this._loadPlanState(this._place);
    try { window.wpApp?.mapView?._loadActivities?.(); } catch (_) {}
    return true;
  }

  // ── Hoja "Tu plan" / "Vas a ir" → my-plan.js + my-plan-actions.js ──

  // ── Hoja "Planes aquí" → plans-here.js + plans-here-open.js + plans-here-days.js ──
}
