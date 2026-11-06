// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-wizard.js
// "Planear visita" por pasos en pantalla completa (step-screen.js):
//   1 ¿Cuándo?              tira de días + hora grande
//   2 ¿Quién puede unirse?  Cualquiera · Seguidores · Solo invitados
//   3 ¿A quién invitas?     gente que sigues + cupos (opcional si es abierto)
//   4 Último toque          nombre e ícono, reglas, nota → "Crear plan"
// Guarda con la RPC create_plan (supabase/24_activities_plans.sql); sin
// ese SQL cae a ActivityService.createActivity (público, sin invitados).
// Se mezcla en PlaceModal2.prototype. Estilos: /styles/plan-steps.css
// ════════════════════════════════════════════════════════════════════
import { getSupabase, ActivityService } from '/src/services/SupabaseService.js';
import { getAvatarUrl } from '/src/services/AvatarService.js';
import { openStepScreen } from '/src/components/place-plans/step-screen.js';

const GENERIC = [
  ['food', '🍔', 'Comer'], ['drinks', '☕', 'Café'], ['hangout', '🎈', 'Pasar el rato'],
  ['explore', '🚀', 'Explorar'], ['shop', '🛍️', 'Compras'], ['music', '🎵', 'Música'],
  ['sport', '🏃', 'Deporte'], ['photo', '📸', 'Fotos'], ['spa', '💆', 'Spa'],
];
const CAT_TYPES = {
  RESTAURANTS: ['food', 'drinks', 'hangout', 'music', 'photo'], HEALTH: ['spa', 'sport', 'hangout'],
  SHOPPING: ['shop', 'hangout', 'drinks', 'food', 'photo'], ENTERTAINMENT: ['hangout', 'music', 'drinks', 'food', 'photo', 'explore'],
  PARKS: ['hangout', 'sport', 'explore', 'photo'], WORKSHOPS: ['explore', 'hangout', 'shop', 'photo'],
};
const VIS = [
  ['public', '🌎', 'Cualquiera', 'Sale en el mapa y cualquiera puede unirse.'],
  ['followers', '👥', 'Mis seguidores', 'Solo lo ve y se puede unir la gente que te sigue.'],
  ['invited', '🔒', 'Solo invitados', 'Privado: van tú y las personas que invites.'],
];
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS = 14, SLOT = 30;
const CHECK = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const TICK = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class PlanWizard {
  _openPlanSheet() {
    const user = this._requireUser('Inicia sesión para planear una visita');
    if (!user || !this._place) return;
    const w = this._pwContext(user);
    w.screen = openStepScreen({
      doneLabel: 'Crear plan',
      haptic: (k) => this._haptic?.(k),
      onDone: () => this._pwCreate(w),
      steps: [
        { title: '¿Cuándo?', sub: this._esc(w.info.name), mount: (el) => this._pwMountWhen(w, el), valid: () => !this._pwPast(w) },
        { title: '¿Quién puede unirse?', mount: (el) => this._pwMountVis(w, el) },
        { title: '¿A quién invitas?', sub: 'La gente que sigues', mount: (el, sec) => this._pwMountPeople(w, el, sec),
          optional: () => w.vis !== 'invited', valid: () => w.vis !== 'invited' || w.invited.size > 0, onEnter: () => this._pwPaintPeople(w) },
        { title: 'Último toque', sub: 'Así lo verán los demás', mount: (el) => this._pwMountLast(w, el), onEnter: () => this._pwPaintLast(w) },
      ],
    });
    this._pwLoadPeople(w);
  }

  // ── Datos del asistente ──────────────────────────────────────────────
  _pwContext(user) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const now = new Date();
    const first = new Date(now); first.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);   // próxima media hora
    const { shown, type, icons } = this._pwTypes(this._place);
    return {
      user, place: this._place, info: this._placeInfo(), today,
      days: Array.from({ length: DAYS }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; }),
      day: first.getDate() === now.getDate() ? 0 : 1, mins: first.getHours() * 60 + first.getMinutes(), now: false,
      vis: 'public', invited: new Set(), people: new Map(), n: 4, nTouched: false,
      shown, type, icons, rules: new Set(), title: '', titleTouched: false, note: '',
    };
  }

  // Íconos posibles para el plan según el lugar (catálogo de Crear actividad)
  _pwTypes(place) {
    const cat = String(place.category || '').toUpperCase();
    const text = `${place.category || ''} ${(place.types || []).join(' ')} ${place.subcategory || ''}`.toLowerCase();
    let type = /caf|coffee|bakery|pan/.test(text) ? 'drinks' : /restaur|food|taco|comida/.test(text) ? 'food'
      : /bar|night|antro|music/.test(text) ? 'music' : /store|shop|tienda|mall/.test(text) ? 'shop'
      : /gym|sport|park|parque/.test(text) ? 'sport' : /spa|beauty|salon|barber/.test(text) ? 'spa' : 'hangout';
    let keys = CAT_TYPES[cat] || GENERIC.map(t => t[0]);
    if (!keys.includes(type)) type = keys[0];
    keys = [type, ...keys.filter(k => k !== type)];
    let shown = keys.map(k => GENERIC.find(t => t[0] === k));
    const icons = {};
    const acts = (this._actTypes || []).filter(t => t.cat === cat);
    if (acts.length) {
      const tags = new Set([...(Array.isArray(place.subcategoryTags) ? place.subcategoryTags : []), ...String(place.subcategory_tags || '').split(','), place.subcategory]
        .map(x => String(x || '').trim().toLowerCase()).filter(Boolean));
      let mine = acts.filter(t => (t.subcats || []).some(s => tags.has(s)));
      if (!mine.length) mine = acts;
      shown = [...mine.map(t => { icons[t.key] = t.icon3d; return [t.key, t.emoji, t.label]; }), ...['hangout', 'photo'].map(k => GENERIC.find(t => t[0] === k))];
      type = shown[0][0];
    }
    return { shown, type, icons };
  }

  _pwAt(w) {
    if (w.now) return new Date(Date.now() + 5 * 60000);
    const d = new Date(w.days[w.day]); d.setHours(0, w.mins, 0, 0); return d;
  }
  _pwPast(w) { return !w.now && this._pwAt(w) < new Date(); }
  _pwWhenTxt(w) { return w.now ? 'Ahora' : this._planWhen(this._pwAt(w).toISOString()); }
  _pwEmoji(w) { return (w.shown.find(t => t[0] === w.type) || GENERIC[2])[1]; }
  _pwAutoTitle(w) { return `Plan en ${w.info.name}`.slice(0, 60); }

  // ── Paso 1 · cuándo ──────────────────────────────────────────────────
  _pwMountWhen(w, el) {
    el.innerHTML = `
      <div class="wp-st-days">${w.days.map((d, i) => `<button type="button" class="wp-st-day" data-day="${i}"><small>${i === 0 ? 'Hoy' : DOW[d.getDay()]}</small><b>${d.getDate()}</b></button>`).join('')}</div>
      <div class="wp-st-lbl">Hora</div>
      <div class="wp-st-clock"><button type="button" data-d="-1" aria-label="Más temprano">−</button><b></b><button type="button" data-d="1" aria-label="Más tarde">+</button></div>
      <p class="wp-st-clock-sub"></p>
      <div class="wp-st-chips wrap"></div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.day) { w.day = +b.dataset.day; w.now = false; }
      else if (b.dataset.d) { w.now = false; w.mins = Math.max(0, Math.min(23 * 60 + 30, w.mins + SLOT * +b.dataset.d)); }
      else if (b.dataset.t === 'now') w.now = !w.now;
      else if (b.dataset.t) { w.now = false; w.mins = +b.dataset.t; }
      this._haptic?.('light');
      this._pwPaintWhen(w, el);
    });
    this._pwPaintWhen(w, el);
  }

  _pwPaintWhen(w, el) {
    el.querySelectorAll('.wp-st-day').forEach(b => b.classList.toggle('on', +b.dataset.day === w.day));
    const at = this._pwAt(w);
    el.querySelector('.wp-st-clock b').textContent = w.now ? 'Ahora' : this._hhmm(at);
    el.querySelector('[data-d="-1"]').disabled = w.now || w.mins <= 0;
    el.querySelector('[data-d="1"]').disabled = w.now || w.mins >= 23 * 60 + 30;
    const sub = el.querySelector('.wp-st-clock-sub');
    sub.textContent = this._pwPast(w) ? 'Esa hora ya pasó · elige otra' : this._pwWhenTxt(w);
    sub.style.color = this._pwPast(w) ? '#e0123c' : '';
    const quick = [[9 * 60, 'Desayuno'], [14 * 60, 'Comida'], [19 * 60, 'Tarde'], [21 * 60, 'Noche']];
    el.querySelector('.wp-st-chips').innerHTML = (w.day === 0 ? `<button type="button" data-t="now"${w.now ? ' class="on"' : ''}>⚡ Ahora</button>` : '')
      + quick.map(([m, l]) => `<button type="button" data-t="${m}"${!w.now && w.mins === m ? ' class="on"' : ''}>${l} · ${this._hhmm(new Date(2000, 0, 1, 0, m))}</button>`).join('');
    w.screen?.refresh();
  }

  // ── Paso 2 · quién puede unirse ──────────────────────────────────────
  _pwMountVis(w, el) {
    el.innerHTML = `<div class="wp-st-opts">${VIS.map(([k, e, t, d]) => `<button type="button" class="wp-st-opt" data-vis="${k}">
        <span class="wp-st-opt-i">${e}</span><span class="wp-st-opt-t"><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>`;
    const paint = () => el.querySelectorAll('.wp-st-opt').forEach(b => b.classList.toggle('on', b.dataset.vis === w.vis));
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.wp-st-opt'); if (!b) return;
      w.vis = b.dataset.vis; this._haptic?.('light'); paint();
      setTimeout(() => { if (w.screen.index === 1) w.screen.go(2); }, 260);   // elegir = avanzar
    });
    paint();
  }

  // ── Paso 3 · a quién invitas + cupos ─────────────────────────────────
  _pwMountPeople(w, el, sec) {
    w.peopleSec = sec;
    el.innerHTML = `<div class="wp-st-people"><p class="wp-st-empty">Cargando…</p></div>
      <div class="wp-st-num"><span><b>Cupos</b><small>Contándote a ti</small></span>
        <div><button type="button" data-n="-1" aria-label="Menos">−</button><b data-v="n"></b><button type="button" data-n="1" aria-label="Más">+</button></div></div>`;
    el.addEventListener('click', (e) => {
      const p = e.target.closest('.wp-st-person');
      if (p) { const id = p.dataset.id; w.invited.has(id) ? w.invited.delete(id) : w.invited.add(id); this._haptic?.('light'); this._pwPaintPeople(w); return; }
      const n = e.target.closest('button[data-n]');
      if (n && !n.disabled) { w.n += +n.dataset.n; w.nTouched = true; this._haptic?.('light'); this._pwPaintPeople(w); }
    });
  }

  async _pwLoadPeople(w) {
    try {
      const sb = getSupabase();
      const { data: fl, error } = await sb.from('follows').select('following_id').eq('follower_id', w.user.id).limit(80);
      if (error) throw error;
      const ids = (fl || []).map(r => r.following_id);
      if (ids.length) {
        const { data: ps, error: e2 } = await sb.from('profiles').select('id, name, username, avatar_url').in('id', ids);
        if (e2) throw e2;
        (ps || []).sort((a, b) => String(a.name || a.username || '').localeCompare(String(b.name || b.username || ''))).forEach(p => w.people.set(p.id, p));
      }
      w.peopleLoaded = true;
    } catch (e) {
      console.warn('[DIAG-PLAN] no cargó a quién sigues:', e?.message || e);
      w.peopleError = true;
    }
    this._pwPaintPeople(w);
  }

  _pwPaintPeople(w) {
    const sec = w.peopleSec; if (!sec) return;
    const grid = sec.querySelector('.wp-st-people');
    if (w.peopleError) grid.innerHTML = '<p class="wp-st-empty">No se pudo cargar a quién sigues</p>';
    else if (w.peopleLoaded && !w.people.size) grid.innerHTML = '<p class="wp-st-empty">Cuando sigas a alguien, aquí podrás invitarlo</p>';
    else if (w.peopleLoaded && !grid.querySelector('.wp-st-person')) {
      grid.innerHTML = [...w.people.values()].map(p => `<button type="button" class="wp-st-person" data-id="${p.id}">
          <i class="wp-seal" style="background-image:url('${this._esc(p.avatar_url || getAvatarUrl(p.name || p.username || 'user'))}')"></i><em>${TICK}</em>
          <small>${this._esc(String(p.name || (p.username ? '@' + p.username : 'Alguien')).split(' ')[0])}</small></button>`).join('');
    }
    grid.querySelectorAll('.wp-st-person').forEach(b => b.classList.toggle('on', w.invited.has(b.dataset.id)));
    // Cupos: con "Solo invitados" = tú + invitados; si es abierto, nunca menos que eso
    const min = Math.max(2, w.invited.size + 1);
    if (w.vis === 'invited' || !w.nTouched) w.n = Math.max(w.vis === 'invited' ? min : 4, min);
    w.n = Math.max(min, Math.min(50, w.n));
    const num = sec.querySelector('.wp-st-num');
    num.hidden = w.vis === 'invited';
    num.querySelector('[data-v="n"]').textContent = w.n;
    num.querySelector('[data-n="-1"]').disabled = w.n <= min;
    num.querySelector('[data-n="1"]').disabled = w.n >= 50;
    sec.querySelector('.wp-st-sub').textContent = w.vis === 'invited'
      ? (w.invited.size ? `Van tú y ${w.invited.size} más` : 'Elige al menos a una persona')
      : (w.invited.size ? `${w.invited.size} invitad${w.invited.size === 1 ? 'o' : 'os'} · les avisamos` : 'Opcional · puedes omitirlo');
    w.screen?.refresh();
  }

  // ── Paso 4 · último toque ────────────────────────────────────────────
  _pwMountLast(w, el) {
    w.lastEl = el;
    el.innerHTML = `
      <div class="wp-st-titlef"><button type="button" class="wp-st-ico" data-a="ico" aria-label="Cambiar ícono"></button>
        <input type="text" maxlength="60" enterkeyhint="done" autocapitalize="sentences" autocomplete="off"></div>
      <div class="wp-st-chips" data-icons hidden>${w.shown.map(([k, e, l]) => `<button type="button" data-type="${k}" aria-label="${l}">${e}</button>`).join('')}</div>
      <div class="wp-st-lbl">Reglas del plan · opcional</div>
      <div class="wp-st-chips wrap">${this._planRules().map(([k, e, t]) => `<button type="button" data-r="${k}">${e} ${t}</button>`).join('')}</div>
      <div class="wp-st-lbl">Nota para los que van · opcional</div>
      <textarea class="wp-st-in" maxlength="280" rows="3" placeholder="Ej. Yo llevo el pastel · nos vemos en la entrada" autocapitalize="sentences"></textarea>
      <p class="wp-st-hint" data-sum></p>`;
    const title = el.querySelector('.wp-st-titlef input');
    title.addEventListener('input', () => { w.title = title.value; w.titleTouched = true; this._pwPaintLast(w); });
    el.querySelector('textarea').addEventListener('input', (e) => { w.note = e.target.value; });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'ico') { const s = el.querySelector('[data-icons]'); s.hidden = !s.hidden; return; }
      if (b.dataset.type) { w.type = b.dataset.type; el.querySelector('[data-icons]').hidden = true; }
      if (b.dataset.r) {
        const k = b.dataset.r, ex = this._planRules().find(r => r[0] === k)?.[3];
        if (w.rules.has(k)) w.rules.delete(k); else { w.rules.add(k); if (ex) w.rules.delete(ex); }
      }
      this._haptic?.('light');
      this._pwPaintLast(w);
    });
  }

  _pwPaintLast(w) {
    const el = w.lastEl; if (!el) return;
    if (!w.titleTouched) w.title = this._pwAutoTitle(w);
    const t = el.querySelector('.wp-st-titlef input');
    if (t.value !== w.title) t.value = w.title;
    el.querySelector('[data-a="ico"]').textContent = this._pwEmoji(w);
    el.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b.dataset.type === w.type));
    el.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', w.rules.has(b.dataset.r)));
    const who = w.vis === 'invited' ? `tú + ${w.invited.size}` : `${w.n} cupos`;
    el.querySelector('[data-sum]').textContent = `${this._pwWhenTxt(w)} · ${who} · ${VIS.find(v => v[0] === w.vis)[2].toLowerCase()}`;
  }

  // ── Crear ────────────────────────────────────────────────────────────
  async _pwCreate(w) {
    const { place, info } = w;
    const at = this._pwAt(w), title = (w.title || '').trim() || this._pwAutoTitle(w), whenTxt = this._pwWhenTxt(w);
    try {
      const { error } = await getSupabase().rpc('create_plan', {
        p_title: title, p_type: w.type, p_place_name: info.name, p_place_id: String(place.place_id || place.id || ''),
        p_lat: Number(info.lat), p_lng: Number(info.lng), p_at: at.toISOString(), p_max: w.n,
        p_spontaneous: w.now, p_visibility: w.vis, p_note: w.note.trim() || null, p_invited: [...w.invited],
        p_icon: w.icons[w.type] || null, p_rules: [...w.rules],
      });
      if (error) {
        if (!(error.code === 'PGRST202' || /create_plan/.test(error.message || ''))) throw error;
        console.warn('[DIAG-PLAN] falta activities_plans.sql: se crea sin invitados ni visibilidad');
        await ActivityService.createActivity({
          title, type: w.type, place_name: info.name, place_id: place.place_id || place.id || null, icon_url: w.icons[w.type] || null,
          lat: Number(info.lat), lng: Number(info.lng), scheduled_at: at.toISOString(), max_participants: w.n, is_spontaneous: w.now,
        });
      }
    } catch (e) {
      console.warn('[DIAG-PLAN] no se creó el plan:', e?.message || e);
      this._showToast(e?.message || 'No se pudo crear el plan');
      return false;
    }
    this._haptic?.('success');
    try { this._loadPlaceActivities(place); } catch (_) {}
    try { this._loadPlanState(place); } catch (_) {}
    try { window.wpApp?.mapView?._loadActivities?.(); } catch (_) {}
    this._pwDone(w, title, whenTxt);
    return false;   // no cerrar: se queda la pantalla de "¡Plan creado!"
  }

  _pwDone(w, title, whenTxt) {
    const n = w.invited.size;
    const box = w.screen.showDone(`
      <div class="wp-st-done-ic">${CHECK}</div>
      <h2>¡Plan creado!</h2>
      <p>${this._esc(title)}<br>${this._esc(whenTxt)}${n ? ` · ${n} invitad${n === 1 ? 'o' : 'os'} (ya les avisamos)` : ''}</p>
      <button type="button" class="wp-st-btn" data-x="share">Compartir el plan</button>
      <button type="button" class="wp-st-btn ghost" data-x="ok">Listo</button>`);
    const txt = `¿Vamos? ${title} · ${whenTxt}${w.info.address ? ' · ' + w.info.address : ''}${w.info.url ? '\n' + w.info.url : ''}`;
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-x]'); if (!b) return;
      if (b.dataset.x === 'ok') { w.screen.close(); return; }
      try {
        if (navigator.share) await navigator.share({ title, text: txt });
        else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
      } catch (_) {}
    });
  }
}
