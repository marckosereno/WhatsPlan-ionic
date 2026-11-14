// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-wizard.js
// "Planear visita" por pasos en pantalla completa (step-screen.js):
//   1 ¿Cuándo?              tira de días + hora grande (sin scroll)
//   2 ¿Quién puede unirse?  Cualquiera · Seguidores · Solo invitados
//   3 ¿Quién va?            "asientos" del plan (tú + invitados + libres)
//                           y la gente que sigues para llenarlos
//   4 ¿Cómo lo llamamos?    ícono en media luna (emoji-dial.js) + nombre
//   5 Detalles              reglas y nota (opcional) → "Crear plan"
// Guarda con la RPC create_plan (supabase/24_activities_plans.sql); sin
// ese SQL cae a ActivityService.createActivity (público, sin invitados).
// Se mezcla en PlaceModal2.prototype. Estilos: /styles/plan-steps.css
// ════════════════════════════════════════════════════════════════════
import { getSupabase, ActivityService } from '/src/services/SupabaseService.js';
import { getAvatarUrl } from '/src/services/AvatarService.js';
import { openStepScreen } from '/src/components/place-plans/step-screen.js';
import { createEmojiDial } from '/src/components/place-plans/emoji-dial.js';
import { openPeoplePicker } from '/src/components/place-plans/people-picker.js';
import { pulse } from '/src/components/place-plans/pulse.js';

const GENERIC = [
  ['food', '🍔', 'Comer'], ['drinks', '☕', 'Café'], ['hangout', '🎉', 'Pasar el rato'],
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
  ['followers', '🫶', 'Mis seguidores', 'Solo lo ve y se puede unir la gente que te sigue.'],
  ['invited', '🔒', 'Solo invitados', 'Privado: van tú y las personas que invites.'],
];
const DAYS = 14;
const CHECK = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const TICK = '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class PlanWizard {
  // preset (desde "¿Repetimos?" del chat): { invite: [ids], people: [perfiles], title }
  _openPlanSheet(preset = null) {
    const user = this._requireUser('Inicia sesión para planear una visita');
    if (!user || !this._place) return;
    const w = this._pwContext(user);
    if (preset?.invite?.length) {
      (preset.people || []).forEach(p => p?.id && w.people.set(p.id, p));
      preset.invite.forEach(id => w.invited.add(id));
      w.vis = 'invited';
    }
    if (preset?.title) { w.title = preset.title; w.titleTouched = true; }
    w.screen = openStepScreen({
      sheet: true,
      doneLabel: 'Crear plan',
      haptic: (k) => this._haptic?.(k),
      onDone: () => this._pwCreate(w),
      steps: [
        { title: '¿Cuándo?', sub: this._esc(w.info.name), mount: (el) => this._pwMountWhen(w, el), valid: () => !this._pwPast(w) },
        { title: '¿Quién puede unirse?', mount: (el) => this._pwMountVis(w, el) },
        { title: '¿Quién va?', sub: 'Toca a quien quieras invitar', mount: (el, sec) => this._pwMountPeople(w, el, sec),
          optional: () => w.vis !== 'invited', valid: () => w.vis !== 'invited' || w.invited.size > 0, onEnter: () => this._pwPaintPeople(w) },
        { title: '¿Cómo lo llamamos?', sub: 'Desliza para elegir su ícono', mount: (el) => this._pwMountName(w, el), onEnter: () => this._pwPaintName(w),
          valid: () => !!(w.title || '').trim() },
        { title: 'Detalles', sub: 'Para que todos lleguen sabiendo', optional: true, mount: (el) => this._pwMountDetails(w, el), onEnter: () => this._pwPaintDetails(w) },
      ],
    });
    this._pwLoadPeople(w);
  }

  // ── Datos del asistente ──────────────────────────────────────────────
  _pwContext(user) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const now = new Date();
    const first = new Date(now); first.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);   // próxima media hora
    const { shown, type } = this._pwTypes(this._place);
    return {
      user, place: this._place, info: this._placeInfo(), today,
      days: Array.from({ length: DAYS }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; }),
      day: first.getDate() === now.getDate() ? 0 : 1, mins: first.getHours() * 60 + first.getMinutes(), now: false, dur: 120,
      vis: 'public', invited: new Set(), people: new Map(), n: 4, nTouched: false,
      shown, type, rules: new Set(), title: '', titleTouched: false, note: '',
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
    const acts = (this._actTypes || []).filter(t => t.cat === cat);
    if (acts.length) {
      const tags = new Set([...(Array.isArray(place.subcategoryTags) ? place.subcategoryTags : []), ...String(place.subcategory_tags || '').split(','), place.subcategory]
        .map(x => String(x || '').trim().toLowerCase()).filter(Boolean));
      let mine = acts.filter(t => (t.subcats || []).some(s => tags.has(s)));
      if (!mine.length) mine = acts;
      shown = [...mine.map(t => [t.key, t.emoji, t.label]), ...['hangout', 'photo'].map(k => GENERIC.find(t => t[0] === k))];
      type = shown[0][0];
    }
    return { shown, type };
  }

  _pwAt(w) {
    if (w.now) return new Date(Date.now() + 5 * 60000);
    const d = new Date(w.days[w.day]); d.setHours(0, w.mins, 0, 0); return d;
  }
  _pwPast(w) { return !w.now && this._pwAt(w) < new Date(); }
  _pwWhenTxt(w) { return `${w.now ? 'Ahora' : this._planWhen(this._pwAt(w).toISOString())} · hasta ${this._hhmm(this._pwEnd(w))}`; }
  // Ícono propio del plan (solo si el emoji elegido es uno que puso el usuario); si no, el del tipo
  _pwIconUrl(w) { const u = (w.shown.find(t => t[0] === w.type) || [])[3]; return /^https:\/\//.test(u || '') ? u : null; }
  _pwEmoji(w) { return (w.shown.find(t => t[0] === w.type) || GENERIC[2])[1]; }
  _pwAutoTitle(w) { return `Plan en ${w.info.name}`.slice(0, 60); }

  // ── Paso 1 · cuándo → plan-when.js ───────────────────────────────────

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

  // ── Paso 3 · quién va: asientos + gente que sigues ───────────────────
  // Arriba, los "asientos" del plan: tú, tus invitados y los libres
  // (punteados). Con − / + cambias cuántos hay (si el plan es abierto).
  // Abajo, la gente que sigues: tocar = ocupa un asiento.
  _pwMountPeople(w, el, sec) {
    w.peopleSec = sec;
    el.innerHTML = `
      <div class="wp-seats"><div class="wp-seats-row"></div>
        <div class="wp-seats-ctl"><button type="button" data-n="-1" aria-label="Un cupo menos">−</button><span data-v="n"></span><button type="button" data-n="1" aria-label="Un cupo más">+</button></div></div>
      <button type="button" class="wp-st-search wp-seats-q" data-q><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Buscar a quién sigues</span></button>
      <div class="wp-st-people wp-seats-people"><p class="wp-st-empty">Cargando…</p></div>`;
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-q]')) { this._pwSearch(w, e.target.closest('[data-q]')); return; }
      const p = e.target.closest('[data-id]');
      if (p) { this._pwToggle(w, p.dataset.id, p); return; }
      const n = e.target.closest('button[data-n]');
      if (n && !n.disabled) { w.n += +n.dataset.n; w.nTouched = true; this._haptic?.('light'); this._pwPaintPeople(w); }
    });
  }

  // Invitar / quitar. Al quitar, el asiento se encoge y se va, y la
  // persona regresa a la lista con un pulso.
  _pwToggle(w, id, from) {
    this._haptic?.('light');
    if (!w.invited.has(id)) { w.invited.add(id); w.justSeated = id; this._pwPaintPeople(w); return; }
    const seat = from?.closest('.wp-seat');
    const done = () => {
      w.invited.delete(id); this._pwPaintPeople(w);
      pulse(w.peopleSec.querySelector(`.wp-seats-people [data-id="${CSS.escape(id)}"]`), 'wp-back-in');
    };
    if (!seat) { done(); return; }
    seat.classList.add('out');
    setTimeout(done, 220);
  }

  // Buscador en zoom: escribes y tocas para invitar sin salir
  _pwSearch(w, from) {
    const face = (p) => this._esc(p?.avatar_url || getAvatarUrl(p?.name || p?.username || 'user'));
    openPeoplePicker({
      from, people: [...w.people.values()].filter(p => p.id !== w.user.id), face, esc: (t) => this._esc(t),
      isOn: (id) => w.invited.has(id), haptic: (k) => this._haptic?.(k),
      onToggle: (id) => { w.invited.has(id) ? w.invited.delete(id) : (w.invited.add(id), w.justSeated = id); this._pwPaintPeople(w); },
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
    const face = (p) => this._esc(p?.avatar_url || getAvatarUrl(p?.name || p?.username || 'user'));
    const first = (p) => this._esc(String(p?.name || (p?.username ? '@' + p.username : 'Alguien')).split(' ')[0]);
    // Cupos: con "Solo invitados" = tú + invitados; si es abierto, nunca menos que eso
    const min = Math.max(2, w.invited.size + 1);
    if (w.vis === 'invited' || !w.nTouched) w.n = Math.max(w.vis === 'invited' ? min : 4, min);
    w.n = Math.max(min, Math.min(50, w.n));
    // Asientos
    const me = w.people.get(w.user.id) || { name: 'Tú', avatar_url: window.wpApp?.currentUser?.avatar_url };
    const seats = [`<span class="wp-seat me"><i class="wp-seal" style="background-image:url('${face(me)}')"></i><small>Tú</small></span>`]
      .concat([...w.invited].map(id => { const p = w.people.get(id); return `<button type="button" class="wp-seat${w.justSeated === id ? ' pop' : ''}" data-id="${id}" data-nopulse aria-label="Quitar a ${first(p)}"><i class="wp-seal" style="background-image:url('${face(p)}')"></i><small>${first(p)}</small><em>×</em></button>`; }))
      .concat(w.vis === 'invited' ? [] : Array.from({ length: Math.max(0, w.n - 1 - w.invited.size) }, () => '<span class="wp-seat free"><i></i><small>Libre</small></span>'));
    sec.querySelector('.wp-seats-row').innerHTML = seats.join('');
    w.justSeated = null;
    const ctl = sec.querySelector('.wp-seats-ctl');
    ctl.hidden = w.vis === 'invited';
    const free = Math.max(0, w.n - 1 - w.invited.size);
    ctl.querySelector('[data-v="n"]').textContent = `${w.n} cupos · ${free} libre${free === 1 ? '' : 's'}`;
    ctl.querySelector('[data-n="-1"]').disabled = w.n <= min;
    ctl.querySelector('[data-n="1"]').disabled = w.n >= 50;
    // Gente que sigues (los ya invitados no se repiten)
    const grid = sec.querySelector('.wp-seats-people');
    if (w.peopleError) grid.innerHTML = '<p class="wp-st-empty">No se pudo cargar a quién sigues</p>';
    else if (w.peopleLoaded && !w.people.size) grid.innerHTML = '<p class="wp-st-empty">Cuando sigas a alguien, aquí podrás invitarlo</p>';
    else if (w.peopleLoaded) {
      const list = [...w.people.values()].filter(p => p.id !== w.user.id && !w.invited.has(p.id));
      grid.innerHTML = list.length ? list.map(p => `<button type="button" class="wp-st-person" data-id="${p.id}"><i class="wp-seal" style="background-image:url('${face(p)}')"></i><small>${first(p)}</small></button>`).join('')
        : '<p class="wp-st-empty">Ya invitaste a todos 🎉</p>';
    }
    sec.querySelector('.wp-st-sub').textContent = w.vis === 'invited'
      ? (w.invited.size ? `Van tú y ${w.invited.size} más` : 'Elige al menos a una persona')
      : (w.invited.size ? `${w.invited.size} invitad${w.invited.size === 1 ? 'o' : 'os'} · les avisamos` : 'Opcional · los cupos libres los toma quien se una');
    w.screen?.refresh();
  }

  // ── Paso 4 · ícono (media luna) + nombre ─────────────────────────────
  _pwMountName(w, el) {
    w.nameEl = el;
    el.innerHTML = `<div class="wp-pw-dial"></div>
      <input class="wp-st-in wp-pw-title" data-zoom="Nombre del plan" type="text" maxlength="60" enterkeyhint="done" autocapitalize="sentences" autocomplete="off" placeholder="Nombre del plan">`;
    const items = w.shown.map(([key, emoji, label, img]) => ({ key, emoji, label, img }));   // img: emoji propio (lugar propio del +)
    w.dial = createEmojiDial(el.querySelector('.wp-pw-dial'), {
      items, value: w.type, haptic: (k) => this._haptic?.(k),
      onChange: (k) => { w.type = k; this._pwPaintName(w); },
    });
    const t = el.querySelector('.wp-pw-title');
    t.addEventListener('input', () => { w.title = t.value; w.titleTouched = true; w.screen?.refresh(); });
  }

  _pwPaintName(w) {
    if (!w.nameEl) return;
    if (!w.titleTouched) w.title = this._pwAutoTitle(w);
    const t = w.nameEl.querySelector('.wp-pw-title');
    if (t.value !== w.title) t.value = w.title;
    w.screen?.refresh();
  }

  // ── Paso 5 · detalles: reglas + nota ─────────────────────────────────
  _pwMountDetails(w, el) {
    w.detEl = el;
    el.innerHTML = `
      <div class="wp-st-chips wrap">${this._planRules().map(([k, e, t]) => `<button type="button" data-r="${k}">${e} ${t}</button>`).join('')}</div>
      <textarea class="wp-st-in" data-zoom="Nota para los que van" maxlength="280" rows="3" placeholder="Nota para los que van (ej. yo llevo el pastel)" autocapitalize="sentences"></textarea>
      <p class="wp-st-hint" data-sum></p>`;
    el.querySelector('textarea').addEventListener('input', (e) => { w.note = e.target.value; });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-r]'); if (!b) return;
      const k = b.dataset.r, ex = this._planRules().find(r => r[0] === k)?.[3];
      if (w.rules.has(k)) w.rules.delete(k); else { w.rules.add(k); if (ex) w.rules.delete(ex); }
      this._haptic?.('light');
      this._pwPaintDetails(w);
    });
  }

  _pwPaintDetails(w) {
    const el = w.detEl; if (!el) return;
    el.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', w.rules.has(b.dataset.r)));
    const who = w.vis === 'invited' ? `tú + ${w.invited.size}` : `${w.n} cupos`;
    el.querySelector('[data-sum]').textContent = `${this._pwEmoji(w)} ${(w.title || '').trim() || this._pwAutoTitle(w)} · ${this._pwWhenTxt(w)} · ${who}`;
  }

  // ── Crear ────────────────────────────────────────────────────────────
  async _pwCreate(w) {
    const { place, info } = w;
    const at = this._pwAt(w), title = (w.title || '').trim() || this._pwAutoTitle(w), whenTxt = this._pwWhenTxt(w);
    let plan = null;
    try {
      plan = await this._pwRpcCreate({
        p_title: title, p_type: w.type, p_place_name: info.name, p_place_id: String(place.place_id || place.id || ''),
        p_lat: Number(info.lat), p_lng: Number(info.lng), p_at: at.toISOString(), p_max: w.n,
        p_spontaneous: w.now, p_visibility: w.vis, p_note: w.note.trim() || null, p_invited: [...w.invited],
        p_icon: this._pwIconUrl(w), p_rules: [...w.rules], p_duration: w.dur,
      });
      if (!plan) {
        console.warn('[DIAG-PLAN] falta activities_plans.sql: se crea sin invitados ni visibilidad');
        await ActivityService.createActivity({
          title, type: w.type, place_name: info.name, place_id: place.place_id || place.id || null, icon_url: this._pwIconUrl(w),
          lat: Number(info.lat), lng: Number(info.lng), scheduled_at: at.toISOString(), max_participants: w.n, is_spontaneous: w.now,
        });
      }
    } catch (e) {
      console.warn('[DIAG-PLAN] no se creó el plan:', e?.message || e);
      this._showToast(e?.message || 'No se pudo crear el plan');
      return false;
    }
    this._haptic?.('success');
    window.dispatchEvent(new Event('wp:plan-action'));   // ofrece activar los avisos
    try { this._loadPlaceActivities(place); } catch (_) {}
    try { this._loadPlanState(place); } catch (_) {}
    try { window.wpApp?.mapView?._loadActivities?.(); } catch (_) {}
    this._pwDone(w, title, whenTxt, plan);
    return false;   // no cerrar: se queda la pantalla de "¡Plan creado!"
  }

  // create_plan; si la base aún no tiene la duración (SQL viejo) se
  // intenta sin ella. null = no existe create_plan (falta el SQL).
  async _pwRpcCreate(args) {
    const missing = (e) => e && (e.code === 'PGRST202' || /create_plan/.test(e.message || ''));
    let { data, error } = await getSupabase().rpc('create_plan', args);
    if (missing(error)) {
      const { p_duration, ...old } = args;
      ({ data, error } = await getSupabase().rpc('create_plan', old));
    }
    if (missing(error)) return null;
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  // "¡Plan creado!" + invitación a seguir armando el itinerario
  _pwDone(w, title, whenTxt, plan) {
    const n = w.invited.size;
    const box = w.screen.showDone(`
      <div class="wp-st-done-ic">${CHECK}</div>
      <h2>¡Plan creado!</h2>
      <p>${this._esc(title)}<br>${this._esc(whenTxt)}${n ? ` · ${n} invitad${n === 1 ? 'o' : 'os'} (ya les avisamos)` : ''}</p>
      ${plan?.id ? `<button type="button" class="wp-st-itin" data-x="stop">
        <span class="wp-st-itin-ic">🧭</span>
        <span class="wp-st-itin-t"><b>¿Y después a dónde?</b><small>Arma el itinerario: agrega la siguiente parada</small></span>
        <span class="wp-st-itin-plus" aria-hidden="true">+</span></button>` : ''}
      <button type="button" class="wp-st-btn" data-x="share">Compartir el plan</button>
      <button type="button" class="wp-st-btn ghost" data-x="ok">Listo</button>`);
    const txt = `¿Vamos? ${title} · ${whenTxt}${w.info.address ? ' · ' + w.info.address : ''}${w.info.url ? '\n' + w.info.url : ''}`;
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-x]'); if (!b) return;
      if (b.dataset.x === 'ok') { w.screen.close(); return; }
      if (b.dataset.x === 'stop') { w.screen.close(); setTimeout(() => this._openStopFlow(plan), 140); return; }
      try {
        if (navigator.share) await navigator.share({ title, text: txt });
        else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
      } catch (_) {}
    });
  }
}
