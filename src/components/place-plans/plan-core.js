// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-core.js
// Planes en la ficha del lugar: estado (_loadPlanState), el botón que
// cambia según tus planes, RPCs, y las hojas "Tu plan" y "Planes aquí"
// (cupos, invitar, reglas, ruta, cancelar…).
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
    const G = { food: '🍔', drinks: '☕', hangout: '🎈', explore: '🚀', shop: '🛍️', music: '🎵', sport: '🏃', photo: '📸', spa: '💆' };
    return G[t] || (this._actTypes || []).find(x => x.key === t)?.emoji || '🎈';
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

  // ── Hoja "Tu plan" / "Vas a ir" ────────────────────────────────────
  _openMyPlanSheet(a) {
    const me = window.wpApp?.currentUser?.id;
    const isOwner = a.creator_id === me;
    const info = this._placeInfo();
    const { body, close } = this._openSheet(isOwner ? 'Tu plan' : 'Vas a ir', info.name);
    const EMO = { food: '🍔', drinks: '☕', hangout: '🎈', explore: '🚀', shop: '🛍️', music: '🎵', sport: '🏃', photo: '📸', spa: '💆' };
    const VIS = { public: 'Abierto a cualquiera', followers: 'Para tus seguidores', invited: 'Solo invitados' };
    const name = (id) => { const p = this._profCache?.get(id) || {}; return this._esc(p.name || (p.username ? '@' + p.username : 'Alguien')); };
    const rows = [];
    rows.push([a.creator_id, 'Organiza', 'host']);
    (a.participants || []).filter(id => id !== a.creator_id).forEach(id => rows.push([id, 'Va', 'go']));
    (a.invited || []).filter(id => !(a.participants || []).includes(id) && !(a.declined || []).includes(id)).forEach(id => rows.push([id, 'Pendiente', 'wait']));
    (a.declined || []).filter(id => !(a.participants || []).includes(id)).forEach(id => rows.push([id, 'No puede', 'no']));
    const going = (a.participants || []).length;
    const full = this._planFull(a);
    const SHARE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';
    const ADD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M19 8v6M16 11h6"/></svg>';
    const CLOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
    body.innerHTML = `
      <div class="wp-pv wp-mp-plan">
        <div class="wp-pv-card">
          <div class="wp-pv-card-emo">${this._planEmoji(a.type)}</div>
          <div class="wp-pv-card-txt"><b class="wp-pv-card-t">${this._esc(a.title)}</b>
            <span class="wp-pv-card-w">${this._esc(this._planWhen(a.scheduled_at))}</span>
            <span class="wp-pv-card-v">${VIS[a.visibility] || VIS.public}</span></div>
        </div>
        <div class="wp-pv-spots${full ? ' full' : ''}">
          <div class="wp-pv-spots-row">
            <div class="wp-pv-spots-txt"><span class="wp-pv-spots-k">Cupos</span><b>${going} de ${a.max_participants || '∞'}</b>${full ? '<span class="wp-pv-full-tag">✓ Completo</span>'
              : a.max_participants ? `<span class="wp-pv-spots-left">Queda${a.max_participants - going === 1 ? '' : 'n'} ${a.max_participants - going}</span>` : ''}
              ${(a.waitlist || []).length ? `<span class="wp-pv-wl">${a.waitlist.length} en espera</span>` : ''}</div>
            ${isOwner && a.max_participants ? `<div class="wp-pv-spots-ctl">
              <button type="button" class="wp-pv-spots-minus" aria-label="Un cupo menos"${a.max_participants <= Math.max(1, going) ? ' disabled' : ''}>−</button>
              <button type="button" class="wp-pv-spots-add" aria-label="Un cupo más"${a.max_participants >= 50 ? ' disabled' : ''}>+</button></div>` : ''}
          </div>
          ${isOwner && a.max_participants ? `<button type="button" class="wp-pv-spots-save" hidden></button>
          ${!full && going > 1 ? `<button type="button" class="wp-pv-spots-close">Cerrar el plan con los ${going} que van</button>` : ''}` : ''}
        </div>
        ${this._planRulesHtml(a)}
        ${this._planRouteHtml(a, { owner: isOwner })}
        ${a.note ? `<div class="wp-pv-postit wp-pv-postit-ro"><i class="wp-pv-tape"></i><div class="wp-pv-note-ro">${this._esc(a.note)}</div></div>` : ''}
        <div class="wp-pv-lbl">Quién va <span class="wp-pv-hint">${going} confirmad${going === 1 ? 'o' : 'os'}</span></div>
        <div class="wp-pv-who">
          ${rows.map(([id, st, k]) => `<div class="wp-pv-who-row"><span class="wp-pv-who-av">${this._planFace(id)}</span>
            <span class="wp-pv-who-n">${id === me ? 'Tú' : name(id)}</span><span class="wp-pv-who-st ${k}">${st}</span></div>`).join('')}
        </div>
        <div class="wp-pv-acts">
          <button type="button" data-a="share">${SHARE}<span>Compartir</span></button>
          ${isOwner ? `<button type="button" data-a="invite">${ADD}<span>Invitar</span></button>
          <button type="button" data-a="time">${CLOCK}<span>Cambiar hora</span><input type="datetime-local" class="wp-pv-native" tabindex="-1"></button>` : ''}
        </div>
        <div class="wp-pv-invite" hidden>
          <div class="wp-pv-people"><span class="wp-pv-empty">Cargando…</span></div>
          <div class="wp-pv-ask" hidden>
            <b class="wp-pv-ask-q"></b>
            <div class="wp-pv-ask-btns"><button type="button" class="wp-pv-ask-no">Ahora no</button><button type="button" class="wp-pv-ask-yes">Abrir e invitar</button></div>
          </div>
          <button type="button" class="wp-pv-cta wp-pv-invite-go" disabled><span>Enviar invitaciones</span></button>
        </div>
        <button type="button" class="wp-pv-danger">${isOwner ? 'Cancelar plan' : 'Ya no puedo ir'}</button>
      </div>`;
    // Invitar: el botón "Enviar invitaciones" (y la pregunta de cupos) va
    // FUERA del contenido que se desliza → siempre a la vista abajo
    { const pv = body.querySelector('.wp-pv'), inv = body.querySelector('.wp-pv-invite');
      if (pv && inv) {
        const f = document.createElement('div');
        f.className = 'wp-pv-foot wp-mp-invfoot'; f.hidden = true;
        f.append(inv.querySelector('.wp-pv-ask'), inv.querySelector('.wp-pv-invite-go'));
        body.appendChild(f);
      } }
    // "Cancelar plan" / "Ya no puedo ir" como badge arriba a la derecha de la hoja
    { const hd = body.closest('.wp-pm2-ms-menu')?.querySelector('.wp-pm2-ms-header'), dg = body.querySelector('.wp-pv-danger');
      if (hd && dg) { hd.classList.add('wp-pv-hd'); hd.appendChild(dg); } }
    const $ = (s) => body.querySelector(s);
    body.querySelector('[data-a="share"]').onclick = () => this._planShare(a);
    // Ruta: ver en el mapa · (organiza) quitar / agregar parada
    const rBox = body.querySelector('.wp-pv-route-ro');
    rBox?.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const cur = Array.isArray(a.stops) ? a.stops : [];
      if (b.dataset.a === 'route') { close(); setTimeout(() => this._planShowRoute(a), 200); return; }
      if (b.dataset.rm) {
        const next = cur.filter((_, i) => i !== +b.dataset.rm - 1);
        b.disabled = true;
        if (await this._planRpc('set_plan_stops', { p_activity: a.id, p_stops: next }, 'Parada quitada · ya les avisamos')) close();
        else b.disabled = false;
        return;
      }
      if (b.dataset.a === 'addstop') { close(); setTimeout(() => this._openStopFlow(a), 120); }
    });
    // Cancelar / salirme: segundo toque para confirmar
    const danger = body.closest('.wp-pm2-ms-menu')?.querySelector('.wp-pv-danger') || $('.wp-pv-danger');
    let armed = false, armT = 0;
    danger.onclick = async () => {
      if (!armed) {
        armed = true; danger.classList.add('armed');
        danger.textContent = '¿Seguro? Toca otra vez';
        clearTimeout(armT); armT = setTimeout(() => { armed = false; danger.classList.remove('armed'); danger.textContent = isOwner ? 'Cancelar plan' : 'Ya no puedo ir'; }, 3000);
        this._haptic?.('light');
        return;
      }
      clearTimeout(armT);
      const ok = isOwner ? await this._planRpc('cancel_plan', { p_activity: a.id }, 'Plan cancelado · ya les avisamos')
        : await this._planRpc('respond_plan', { p_activity: a.id, p_accept: false }, 'Listo, ya no vas');
      if (ok) close();
    };
    if (!isOwner) return;
    // Cupos: − / + cambian, "Guardar" lo aplica; "Cerrar el plan" = cupo igual a los que van
    const addB = $('.wp-pv-spots-add'), minus = $('.wp-pv-spots-minus'), save = $('.wp-pv-spots-save'), closeB = $('.wp-pv-spots-close');
    if (addB) {
      const max0 = a.max_participants, minMax = Math.max(1, going);
      let max = max0;
      const paint = () => {
        const d = max - max0;
        $('.wp-pv-spots-txt b').textContent = `${going} de ${max}`;
        minus.disabled = max <= minMax; addB.disabled = max >= 50;
        const willFull = going >= max;
        $('.wp-pv-spots').classList.toggle('full', willFull);
        const tag = $('.wp-pv-spots .wp-pv-full-tag'), left = $('.wp-pv-spots-left');
        if (tag) tag.hidden = !willFull;
        if (left) { left.hidden = willFull; left.textContent = `Queda${max - going === 1 ? '' : 'n'} ${max - going}`; }
        save.hidden = !d;
        save.className = 'wp-pv-spots-save' + (d < 0 ? ' less' : '');
        save.textContent = !d ? '' : d > 0 ? `Abrir ${d} cupo${d === 1 ? '' : 's'} más` : willFull ? `Cerrar el plan con ${going}` : `Quitar ${-d} cupo${d === -1 ? '' : 's'}`;
        if (closeB) closeB.hidden = !!d;
      };
      addB.onclick = () => { if (max < 50) { max++; this._haptic?.('light'); paint(); } };
      minus.onclick = () => { if (max > minMax) { max--; this._haptic?.('light'); paint(); } };
      const apply = async (n, btn) => {
        btn.disabled = true;
        const d = n - max0;
        const msg = n <= going ? `Plan cerrado · ${going} de ${going} ✓ Completo`
          : d > 0 ? `Abriste ${d} cupo${d === 1 ? '' : 's'}${(a.waitlist || []).length && max0 <= going ? ' · le avisamos a quien esperaba' : ''}`
          : `Quitaste ${-d} cupo${d === -1 ? '' : 's'}`;
        const ok = await this._planRpc('set_plan_cupo', { p_activity: a.id, p_max: n }, msg);
        btn.disabled = false;
        if (ok) close();
      };
      save.onclick = () => apply(max, save);
      if (closeB) closeB.onclick = () => apply(going, closeB);
    }
    // Cambiar hora (fecha y hora del teléfono)
    const tBtn = body.querySelector('[data-a="time"]'), tIn = tBtn.querySelector('input');
    const pad = (x) => String(x).padStart(2, '0');
    const d0 = new Date(a.scheduled_at);
    tIn.value = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}T${pad(d0.getHours())}:${pad(d0.getMinutes())}`;
    tBtn.onclick = (e) => { if (e.target === tIn) return; try { tIn.showPicker ? tIn.showPicker() : tIn.click(); } catch (_) { tIn.click(); } };
    tIn.onchange = async () => {
      if (!tIn.value) return;
      const at = new Date(tIn.value);
      if (await this._planRpc('reschedule_plan', { p_activity: a.id, p_at: at.toISOString() }, `Nueva hora · ${this._planWhen(at)}`)) close();
    };
    // Invitar a más
    const invBox = $('.wp-pv-invite'), peopleEl = invBox.querySelector('.wp-pv-people'), go = $('.wp-pv-invite-go');
    const sel = new Set();
    const already = new Set([...(a.participants || []), ...(a.invited || [])]);
    const invFoot = body.querySelector('.wp-mp-invfoot'), pvEl = body.querySelector('.wp-pv');
    body.querySelector('[data-a="invite"]').onclick = async () => {
      invBox.hidden = !invBox.hidden;
      if (invFoot) {
        invFoot.hidden = invBox.hidden;
        // el contenido se hace más bajo lo que mide el botón, y se desliza
        pvEl.style.maxHeight = invBox.hidden ? '' : `calc(100dvh - 150px - env(safe-area-inset-top, 0px) - ${invFoot.offsetHeight + 6}px)`;
        if (!invBox.hidden) requestAnimationFrame(() => { pvEl.scrollTo({ top: pvEl.scrollTop + invBox.getBoundingClientRect().top - pvEl.getBoundingClientRect().top - 12, behavior: 'smooth' }); });
      }
      if (invBox.hidden || peopleEl.dataset.loaded) return;
      peopleEl.dataset.loaded = '1';
      try {
        const sb = getSupabase();
        const { data: fl } = await sb.from('follows').select('following_id').eq('follower_id', me).limit(80);
        const ids = (fl || []).map(r => r.following_id).filter(id => !already.has(id));
        if (!ids.length) { peopleEl.innerHTML = '<span class="wp-pv-empty">Ya invitaste a todos los que sigues</span>'; return; }
        const { data: ps } = await sb.from('profiles').select('id, name, username, avatar_url').in('id', ids);
        (ps || []).forEach(p => this._profCache.set(p.id, p));
        peopleEl.innerHTML = (ps || []).map(p => `<button type="button" class="wp-pv-person" data-id="${p.id}">
            <span class="wp-pv-pav wp-seal" style="background-image:url('${this._esc(p.avatar_url || getAvatarUrl(p.name || p.username || 'user'))}')"></span>
            <i class="wp-pv-pchk"><svg viewBox="0 0 24 24" width="11" height="11"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i>
            <span class="wp-pv-pname">${this._esc(String(p.name || (p.username ? '@' + p.username : 'Alguien')).split(' ')[0])}</span></button>`).join('');
      } catch (e) { peopleEl.innerHTML = '<span class="wp-pv-empty">No se pudo cargar a quién sigues</span>'; }
    };
    peopleEl.addEventListener('click', (e) => {
      const b = e.target.closest('.wp-pv-person'); if (!b) return;
      sel.has(b.dataset.id) ? sel.delete(b.dataset.id) : sel.add(b.dataset.id);
      b.classList.toggle('on', sel.has(b.dataset.id));
      go.disabled = !sel.size;
      go.querySelector('span').textContent = sel.size ? `Invitar a ${sel.size}` : 'Enviar invitaciones';
    });
    const ask = $('.wp-pv-ask');
    const sendInv = async (expand) => {
      if (!sel.size) return;
      go.disabled = true;
      const n = sel.size;
      const ok = await this._planRpc('invite_to_plan', { p_activity: a.id, p_invited: [...sel], p_expand: expand },
        `Invitaste a ${n}${expand ? ' · abriste más cupos' : ''} · ya les avisamos`, {
          onError: (err) => {
            const m = /PLAN_LLENO:(\d+)/.exec(err?.message || '');
            if (!m) return false;
            const k = +m[1];
            ask.querySelector('.wp-pv-ask-q').textContent = `Tu plan está lleno: ¿abrir ${k} cupo${k === 1 ? '' : 's'} más para invitar?`;
            ask.hidden = false; go.hidden = true;
            this._haptic?.('light');
            requestAnimationFrame(() => { try { ask.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {} });
            return true;
          },
        });
      go.disabled = !sel.size;
      if (ok) close();
    };
    go.onclick = () => sendInv(false);
    ask.querySelector('.wp-pv-ask-yes').onclick = () => { ask.hidden = true; go.hidden = false; sendInv(true); };
    ask.querySelector('.wp-pv-ask-no').onclick = () => { ask.hidden = true; go.hidden = false; };
  }

  // ── Hoja "Planes aquí": unirme / aceptar invitación / crear el mío ──
  _openPlansHereSheet() {
    const { me, mine, pending, others } = this._planGroups();
    const info = this._placeInfo();
    const { body, close } = this._openSheet('Planes aquí', info.name);
    const EMO = { food: '🍔', drinks: '☕', hangout: '🎈', explore: '🚀', shop: '🛍️', music: '🎵', sport: '🏃', photo: '📸', spa: '💆' };
    const list = [...pending, ...others.filter(a => !pending.includes(a))];
    const name = (id) => { const p = this._profCache?.get(id) || {}; return this._esc(String(p.name || (p.username ? '@' + p.username : 'Alguien')).split(' ')[0]); };
    body.innerHTML = `
      <div class="wp-pv wp-ph">
        ${list.map((a, i) => {
          const going = (a.participants || []).length, left = Math.max(0, (a.max_participants || 0) - going);
          const full = this._planFull(a), waiting = (a.waitlist || []).includes(me);
          const inv = pending.includes(a), inIt = (a.participants || []).includes(me);
          const WL = waiting ? `<button type="button" class="wp-ph-wl on" data-wl="off">✓ Te avisaremos si se libera un cupo</button>`
            : `<button type="button" class="wp-ph-wl" data-wl="on">🔔 Avísame si se libera un cupo</button>`;
          return `<div class="wp-ph-card${inv ? ' inv' : ''}" data-i="${i}">
            ${inv ? `<span class="wp-ph-tag">Te invitó ${name(a.creator_id)}</span>` : ''}
            <div class="wp-ph-top">
              <div class="wp-pv-card-emo">${this._planEmoji(a.type)}</div>
              <div class="wp-pv-card-txt"><b class="wp-pv-card-t">${this._esc(a.title)}</b>
                <span class="wp-pv-card-w">${this._esc(this._planWhen(a.scheduled_at))} · organiza ${name(a.creator_id)}</span>
                <span class="wp-pv-card-v">${full ? `<span class="wp-pv-full-tag">${going} de ${going} · Completo</span>` : a.max_participants ? `Queda${left === 1 ? '' : 'n'} ${left} cupo${left === 1 ? '' : 's'}` : 'Sin límite'}</span></div>
              <div class="wp-pv-card-faces">${(a.participants || []).slice(0, 3).map(id => this._planFace(id)).join('')}${going > 3 ? `<b>+${going - 3}</b>` : ''}</div>
            </div>
            ${this._planRouteHtml(a, { compact: true })}
            ${this._planRulesHtml(a, 'sm')}
            ${a.note ? `<div class="wp-ph-note">“${this._esc(a.note)}”</div>` : ''}
            <div class="wp-ph-btns">
              ${inIt ? `<button type="button" class="wp-ph-yes" disabled>Ya vas</button>`
                : inv && !full ? `<button type="button" class="wp-ph-no" data-a="no">No puedo</button><button type="button" class="wp-ph-yes" data-a="yes">Aceptar</button>`
                : inv ? `<button type="button" class="wp-ph-no" data-a="no">No puedo</button>${WL}`
                : !full ? `<button type="button" class="wp-ph-yes" data-a="yes">Unirme</button>`
                : WL}
            </div>
          </div>`;
        }).join('')}
        ${mine ? '' : `<div class="wp-pv-foot"><button type="button" class="wp-pv-cta wp-ph-new"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Crear mi plan</span></button></div>`}
      </div>`;
    body.querySelectorAll('.wp-ph-card button[data-a]').forEach(b => b.onclick = async () => {
      const a = list[+b.closest('.wp-ph-card').dataset.i];
      const yes = b.dataset.a === 'yes';
      b.disabled = true;
      const ok = await this._planRpc('respond_plan', { p_activity: a.id, p_accept: yes }, yes ? `¡Vas! ${this._planWhen(a.scheduled_at)}` : 'Le avisamos que no puedes');
      if (ok) close(); else b.disabled = false;
    });
    // Lista de espera
    body.querySelectorAll('.wp-ph-card button[data-wl]').forEach(b => b.onclick = async () => {
      const a = list[+b.closest('.wp-ph-card').dataset.i];
      const on = b.dataset.wl === 'on';
      b.disabled = true;
      const ok = await this._planRpc('plan_waitlist', { p_activity: a.id, p_on: on },
        on ? 'Listo · te avisamos si se libera un cupo' : 'Ya no estás en la lista de espera');
      b.disabled = false;
      if (!ok) return;
      a.waitlist = on ? [...(a.waitlist || []), me] : (a.waitlist || []).filter(id => id !== me);
      b.dataset.wl = on ? 'off' : 'on';
      b.classList.toggle('on', on);
      b.textContent = on ? '✓ Te avisaremos si se libera un cupo' : '🔔 Avísame si se libera un cupo';
    });
    { const f = body.querySelector('.wp-pv > .wp-pv-foot'); if (f) body.appendChild(f); }
    const nb = body.querySelector('.wp-ph-new');
    if (nb) nb.onclick = () => { close(true); setTimeout(() => this._openPlanSheet(), 60); };
  }
}
