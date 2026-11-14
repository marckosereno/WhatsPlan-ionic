// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/stop-flow.js
// "Nueva parada" por pasos en pantalla completa (step-screen.js):
//   1 ¿Qué van a hacer?   íconos 3D por categoría
//   2 ¿Dónde?             sugeridos cerca · buscar · lugar propio
//   3 ¿A qué hora llegan? hora grande con − / +
//   4 ¿Cuánto tiempo ahí? duración grande con − / + (15 min a 12 h)
//   5 ¿Alguna indicación? opcional (se puede omitir)
// Con la duración, la siguiente parada se sugiere justo al terminar esta
// y el plan sabe a qué hora termina toda la salida.
// Se mezcla en PlaceModal2.prototype (usa _hhmm, _distM, _stopEmoji,
// _planPlaces, _planRpc, _openMyPlanSheet, _esc…).
// Estilos: /styles/plan-steps.css
// ════════════════════════════════════════════════════════════════════
import { openStepScreen } from '/src/components/place-plans/step-screen.js';
import { openTimePicker } from '/src/components/place-plans/time-picker.js';
import { openPlacePicker } from '/src/components/place-plans/place-picker.js';

const GROUPS = [
  ['RESTAURANTS', '🍽️', 'Comer y beber'], ['ENTERTAINMENT', '🎉', 'Salir'], ['SHOPPING', '🛍️', 'Compras'],
  ['PARKS', '🌳', 'Aire libre'], ['HEALTH', '💆', 'Bienestar'], ['WORKSHOPS', '🔧', 'Talleres'],
];
// Si ActivityModal no exporta su catálogo, se usan estos genéricos
export const FALLBACK_ACTS = [
  ['food', '🍔', 'Comer', 'RESTAURANTS', 'Hamburger/3D/hamburger_3d.png'],
  ['drinks', '☕', 'Café', 'RESTAURANTS', 'Hot beverage/3D/hot_beverage_3d.png'],
  ['music', '🎵', 'Música', 'ENTERTAINMENT', 'Musical note/3D/musical_note_3d.png'],
  ['hangout', '🎉', 'Pasar el rato', 'ENTERTAINMENT', 'Balloon/3D/balloon_3d.png'],
  ['shop', '🛍️', 'Compras', 'SHOPPING', 'Shopping bags/3D/shopping_bags_3d.png'],
  ['sport', '🏃', 'Deporte', 'PARKS', 'Person running/3D/person_running_3d.png'],
  ['photo', '📸', 'Fotos', 'PARKS', 'Camera with flash/3D/camera_with_flash_3d.png'],
  ['spa', '💆', 'Spa', 'HEALTH', 'Person getting massage/3D/person_getting_massage_3d.png'],
].map(([key, emoji, label, cat]) => ({ key, emoji, label, cat }));

const STEP_MIN = 15, MAX_GAP = 360, MAX_DUR = 720;
const DUR_CHIPS = [30, 60, 90, 120, 180];
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const kmTxt = (d) => (d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`);
const gapTxt = (g) => (g < 60 ? `${g} min` : `${Math.floor(g / 60)} h${g % 60 ? ` ${g % 60} min` : ''}`);
const SEARCH = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

export class StopFlow {
  _openStopFlow(a) {
    const f = this._sfContext(a);
    f.screen = openStepScreen({
      sheet: true,
      doneLabel: 'Agregar parada',
      haptic: (k) => this._haptic?.(k),
      onDone: () => this._sfSave(f),
      onClose: () => setTimeout(() => this._openMyPlanSheet(f.a), 120),
      steps: [
        { title: '¿Qué van a hacer?', sub: `Después de ${this._esc(f.fromName)}`, mount: (el) => this._sfMountWhat(f, el), valid: () => !!f.act },
        { title: '¿Dónde?', sub: 'Cerca de la parada anterior', mount: (el, sec) => this._sfMountWhere(f, el, sec), valid: () => !!this._sfWhere(f), onEnter: () => this._sfPaintPlaces(f) },
        { title: '¿A qué hora llegan?', sub: `Después de ${this._esc(f.fromName)}`, mount: (el) => this._sfMountTime(f, el) },
        { title: '¿Cuánto tiempo ahí?', sub: 'Así sabemos a qué hora siguen o terminan', mount: (el) => this._sfMountDur(f, el), onEnter: () => this._sfPaintDur(f) },
        { title: '¿Alguna indicación?', sub: 'Solo para esta parada', optional: true, mount: (el) => this._sfMountNote(f, el) },
      ],
    });
    this._planPlaces().then((ps) => { f.all = (ps || []).filter(p => p.place_id && p.lat && p.lng); this._sfPaintPlaces(f); });
  }

  _sfContext(a) {
    const cur = Array.isArray(a.stops) ? a.stops : [];
    const last = cur[cur.length - 1];
    const t0 = new Date(a.scheduled_at);
    // la siguiente parada empieza donde termina la anterior: la última
    // parada, o el fin del plan si aún no hay paradas
    // (si la última parada tiene duración, la siguiente empieza al terminar ésa)
    const base = last ? (last.after || 0) + (last.dur || 0) : (a.ends_at ? Math.max(0, Math.round((new Date(a.ends_at) - t0) / 60000)) : 0);
    const fromEnd = last ? !!last.dur : !!a.ends_at;
    let cat = String(last?.cat || this._place?.category || 'RESTAURANTS').toUpperCase();
    if (!GROUPS.some(g => g[0] === cat)) cat = 'RESTAURANTS';
    return {
      a, cur, last, cat,
      acts: (this._actTypes || []).length ? this._actTypes : FALLBACK_ACTS,
      base, fromEnd, lastT: new Date(t0.getTime() + base * 60000),
      origin: last?.lat ? { lat: Number(last.lat), lng: Number(last.lng) } : { lat: Number(a.lat), lng: Number(a.lng) },
      fromName: last?.name || a.place_name || 'la parada anterior',
      exclude: new Set([String(a.place_id || ''), ...cur.map(x => String(x.place_id))]),
      act: null, place: null, custom: null, gap: fromEnd ? 15 : 60, dur: 60, note: '', all: [],
    };
  }

  _sfAct(f) { return f.acts.find(x => x.key === f.act) || null; }
  _sfWhere(f) { return f.custom || f.place; }

  // ── Paso 1 · qué ──────────────────────────────────────────────────────
  _sfMountWhat(f, el) {
    el.innerHTML = `<div class="wp-st-chips">${GROUPS.map(([k, e, l]) => `<button type="button" data-c="${k}">${e} ${l}</button>`).join('')}</div><div class="wp-st-tiles"></div>`;
    el.addEventListener('click', (e) => {
      const c = e.target.closest('button[data-c]');
      if (c) { f.cat = c.dataset.c; this._haptic?.('light'); this._sfPaintWhat(f, el); return; }
      const t = e.target.closest('.wp-st-tile'); if (!t) return;
      f.act = t.dataset.k; f.place = null;
      this._haptic?.('light');
      this._sfPaintWhat(f, el);
      f.screen.refresh();
      setTimeout(() => { if (f.screen.index === 0) f.screen.go(1); }, 280);   // elegir = avanzar
    });
    this._sfPaintWhat(f, el);
  }

  _sfPaintWhat(f, el) {
    el.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === f.cat));
    el.querySelector('.wp-st-tiles').innerHTML = f.acts.filter(x => x.cat === f.cat).map(x => `<button type="button" class="wp-st-tile${x.key === f.act ? ' on' : ''}" data-k="${x.key}">
        <span class="wp-st-tile-i">${x.emoji}</span>
        <span class="wp-st-tile-l">${this._esc(x.label)}</span></button>`).join('');
  }

  // ── Paso 2 · dónde ────────────────────────────────────────────────────
  _sfMountWhere(f, el, sec) {
    f.whereEl = el; f.whereSub = sec.querySelector('.wp-st-sub');
    el.innerHTML = `
      <button type="button" class="wp-st-search wp-seats-q" data-q>${SEARCH}<span>Buscar un lugar</span></button>
      <div class="wp-st-picked"></div>
      <div class="wp-st-list"></div>
      <button type="button" class="wp-st-row wp-st-own" data-a="own"><span class="wp-st-row-ph">🏡</span>
        <span class="wp-st-row-t"><b>Un lugar que no está en el mapa</b><small>Casa de alguien, un parque sin nombre…</small></span><i class="wp-st-radio"></i></button>
      <div class="wp-st-ownf" hidden>
        <input class="wp-st-in" data-zoom="Nombre del lugar" data-f="name" type="text" maxlength="80" placeholder="Nombre (ej. Casa de Ana)" autocapitalize="sentences" autocomplete="off">
        <input class="wp-st-in" data-zoom="Dirección o referencia" data-f="address" type="text" maxlength="160" placeholder="Dirección o referencia (opcional)" autocapitalize="sentences" autocomplete="off">
      </div>`;
    el.querySelectorAll('.wp-st-ownf input').forEach(i => i.addEventListener('input', () => this._sfSyncOwn(f)));
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-q]')) { this._sfSearch(f, e.target.closest('[data-q]')); return; }
      if (e.target.closest('[data-a="own"]')) { this._sfToggleOwn(f); return; }
      const r = e.target.closest('.wp-st-row[data-i]'); if (!r) return;
      const p = f.res?.[+r.dataset.i]; if (!p) return;
      f.place = f.place && String(f.place.place_id) === String(p.place_id) ? null : p;
      if (f.place) this._sfClearOwn(f);
      this._haptic?.('light');
      this._sfPaintPlaces(f);
      f.screen.refresh();
    });
  }

  // Candidatos (cerca de la parada anterior, o lo que coincide con la búsqueda), con distancia.
  // Siempre dentro de la categoría de la actividad elegida en el paso 1 (igual que "Planear visita")
  _sfCandidates(f, q = '') {
    const A = this._sfAct(f), k = norm(q.trim());
    let base = f.all.filter(p => !f.exclude.has(String(p.place_id)));
    if (A) base = base.filter(p => String(p.category || '').toUpperCase() === A.cat);
    if (k) base = base.filter(p => norm(p.name).includes(k) || norm(p.formattedAddress).includes(k));
    else if (A) {
      const subs = new Set(A.subcats || []);
      const tags = (p) => [...(Array.isArray(p.subcategoryTags) ? p.subcategoryTags : []), p.subcategory].map(x => String(x || '').toLowerCase());
      const fit = subs.size ? base.filter(p => tags(p).some(t => subs.has(t))) : [];
      base = fit.length ? fit : base;
    }
    return base.map(p => [p, this._distM(f.origin, p)]).sort((x, y) => x[1] - y[1]).slice(0, k ? 15 : 6);
  }

  // Buscador en zoom, el mismo de "Planear visita": campo y resultados dentro de la tarjeta
  _sfSearch(f, from) {
    openPlacePicker({
      from, esc: (t) => this._esc(t), haptic: (k) => this._haptic?.(k),
      face: (p) => this._esc(p.photoUrl || p.photosUrls?.[0] || ''),
      emoji: (p) => this._stopEmoji(p.category),
      search: (q) => this._sfCandidates(f, q).map(([p, d]) => ({ place: p, sub: `${p.rating ? `★ ${parseFloat(p.rating).toFixed(1)} · ` : ''}${kmTxt(d)}` })),
      isOn: (p) => !!f.place && String(f.place.place_id) === String(p.place_id),
      onPick: (p) => { f.place = { ...p, viaSearch: true }; this._sfClearOwn(f); this._sfPaintPlaces(f); f.screen.refresh(); },
    });
  }

  _sfPaintPlaces(f) {
    const el = f.whereEl; if (!el) return;
    const A = this._sfAct(f);
    if (f.whereSub) f.whereSub.textContent = A ? `Para ${A.label.toLowerCase()} · cerca de ${f.fromName}` : `Cerca de ${f.fromName}`;
    const res = this._sfCandidates(f);
    f.res = res.map(r => r[0]);
    // lo elegido con el buscador (que no está entre los sugeridos) va arriba, marcado
    const pk = f.place, extra = pk && !f.res.some(p => String(p.place_id) === String(pk.place_id));
    const pph = pk ? (pk.photoUrl || pk.photosUrls?.[0] || '') : '';
    el.querySelector('.wp-st-picked').innerHTML = extra ? `<div class="wp-st-row on"><span class="wp-st-row-ph"${pph ? ` style="background-image:url('${this._esc(pph)}')"` : ''}>${pph ? '' : this._stopEmoji(pk.category)}</span>
        <span class="wp-st-row-t"><b>${this._esc(pk.name)}</b><small>Elegido</small></span><i class="wp-st-radio"></i></div>` : '';
    const list = el.querySelector('.wp-st-list');
    const k = '';
    list.innerHTML = res.length ? res.map(([p, d], i) => {
      const ph = p.photoUrl || p.photosUrls?.[0] || '';
      const on = f.place && String(f.place.place_id) === String(p.place_id);
      return `<button type="button" class="wp-st-row${on ? ' on' : ''}" data-i="${i}">
          <span class="wp-st-row-ph"${ph ? ` style="background-image:url('${this._esc(ph)}')"` : ''}>${ph ? '' : this._stopEmoji(p.category)}</span>
          <span class="wp-st-row-t"><b>${this._esc(p.name)}</b><small>${p.rating ? `★ ${parseFloat(p.rating).toFixed(1)} · ` : ''}${kmTxt(d)}</small></span>
          <i class="wp-st-radio"></i></button>`;
    }).join('') : `<p class="wp-st-empty">${k ? 'No encontramos ese lugar' : 'No hay lugares así cerca · busca o agrega uno propio'}</p>`;
  }

  _sfToggleOwn(f) {
    const box = f.whereEl.querySelector('.wp-st-ownf'), open = box.hidden;
    box.hidden = !open;
    f.whereEl.querySelector('[data-a="own"]').classList.toggle('on', open);
    if (open) setTimeout(() => { try { box.querySelector('input').focus(); } catch (_) {} }, 40);
    else this._sfClearOwn(f);
    f.screen.refresh();
  }

  _sfSyncOwn(f) {
    const v = (k) => f.whereEl.querySelector(`[data-f="${k}"]`).value.trim();
    const name = v('name');
    f.custom = name ? { place_id: f.custom?.place_id || `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, address: v('address') } : null;
    if (f.custom && f.place) { f.place = null; this._sfPaintPlaces(f); }
    f.screen.refresh();
  }

  _sfClearOwn(f) {
    f.custom = null;
    f.whereEl.querySelectorAll('.wp-st-ownf input').forEach(i => { i.value = ''; });
    f.whereEl.querySelector('.wp-st-ownf').hidden = true;
    f.whereEl.querySelector('[data-a="own"]').classList.remove('on');
  }

  // ── Paso 3 · a qué hora ───────────────────────────────────────────────
  _sfMountTime(f, el) {
    el.innerHTML = `
      <div class="wp-st-clock"><button type="button" data-d="-1" aria-label="Más temprano">−</button><button type="button" class="wp-st-clock-v" data-clock aria-label="Elegir la hora"><b></b></button><button type="button" data-d="1" aria-label="Más tarde">+</button></div>
      <p class="wp-st-clock-sub"></p>
      <div class="wp-st-chips wrap">${[30, 60, 90, 120, 180].map(g => `<button type="button" data-g="${g}">+${gapTxt(g)}</button>`).join('')}</div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.d) f.gap = Math.max(STEP_MIN, Math.min(MAX_GAP, f.gap + STEP_MIN * +b.dataset.d));
      else if (b.dataset.g) f.gap = +b.dataset.g;
      else if (b.hasAttribute('data-clock')) { this._sfPickTime(f, el, b); return; }
      this._haptic?.('light');
      this._sfPaintTime(f, el);
    });
    this._sfPaintTime(f, el);
  }

  // Tocar la hora grande → hora exacta; se guarda como "tiempo después"
  // de la parada anterior (si queda antes, es al día siguiente)
  _sfPickTime(f, el, b) {
    const at = new Date(f.lastT.getTime() + f.gap * 60000);
    openTimePicker({
      from: b, mins: at.getHours() * 60 + at.getMinutes(), haptic: (k) => this._haptic?.(k),
      onPick: (m) => {
        const t = new Date(f.lastT); t.setHours(0, m, 0, 0);
        if (t <= f.lastT) t.setDate(t.getDate() + 1);
        f.gap = Math.max(STEP_MIN, Math.min(MAX_GAP, Math.round((t - f.lastT) / 60000)));
        this._sfPaintTime(f, el);
      },
    });
  }

  _sfPaintTime(f, el) {
    const clock = el.querySelector('.wp-st-clock b'), txt = this._hhmm(new Date(f.lastT.getTime() + f.gap * 60000));
    if (clock.textContent && clock.textContent !== txt) { clock.classList.remove('tick'); void clock.offsetWidth; clock.classList.add('tick'); }
    clock.textContent = txt;
    el.querySelector('.wp-st-clock-sub').textContent = `${gapTxt(f.gap)} después de ${f.fromEnd ? 'terminar en ' : ''}${f.fromName}`;
    el.querySelector('[data-d="-1"]').disabled = f.gap <= STEP_MIN;
    el.querySelector('[data-d="1"]').disabled = f.gap >= MAX_GAP;
    el.querySelectorAll('[data-g]').forEach(b => b.classList.toggle('on', +b.dataset.g === f.gap));
  }

  // ── Paso 4 · cuánto tiempo ────────────────────────────────────────────
  _sfMountDur(f, el) {
    f.durEl = el;
    el.innerHTML = `
      <div class="wp-st-clock"><button type="button" data-d="-1" aria-label="Menos tiempo">−</button><span class="wp-st-clock-v"><b></b></span><button type="button" data-d="1" aria-label="Más tiempo">+</button></div>
      <p class="wp-st-clock-sub"></p>
      <div class="wp-st-chips wrap">${DUR_CHIPS.map(m => `<button type="button" data-m="${m}">${gapTxt(m)}</button>`).join('')}</div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.d) f.dur = Math.max(STEP_MIN, Math.min(MAX_DUR, f.dur + STEP_MIN * +b.dataset.d));
      else if (b.dataset.m) f.dur = +b.dataset.m;
      this._haptic?.('light');
      this._sfPaintDur(f);
    });
    this._sfPaintDur(f);
  }

  _sfPaintDur(f) {
    const el = f.durEl; if (!el) return;
    const clock = el.querySelector('.wp-st-clock b'), txt = gapTxt(f.dur);
    if (clock.textContent && clock.textContent !== txt) { clock.classList.remove('tick'); void clock.offsetWidth; clock.classList.add('tick'); }
    clock.textContent = txt;
    const at = new Date(f.lastT.getTime() + f.gap * 60000), out = new Date(at.getTime() + f.dur * 60000);
    el.querySelector('.wp-st-clock-sub').textContent = `Llegan ${this._hhmm(at)} · se van ${this._hhmm(out)}`;
    el.querySelector('[data-d="-1"]').disabled = f.dur <= STEP_MIN;
    el.querySelector('[data-d="1"]').disabled = f.dur >= MAX_DUR;
    el.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', +b.dataset.m === f.dur));
  }

  // ── Paso 5 · indicación ───────────────────────────────────────────────
  _sfMountNote(f, el) {
    el.innerHTML = `<textarea class="wp-st-in" data-zoom="Indicación para esta parada" maxlength="140" rows="3" placeholder="Ej. Aquí cada quien pide lo suyo" autocapitalize="sentences"></textarea>
      <p class="wp-st-hint">Las reglas (quién paga, puntualidad…) son de todo el plan.</p>`;
    el.querySelector('textarea').addEventListener('input', (e) => { f.note = e.target.value; });
  }

  // ── Guardar ───────────────────────────────────────────────────────────
  async _sfSave(f) {
    const A = this._sfAct(f), W = this._sfWhere(f);
    if (!A || !W) return false;
    const stop = {
      place_id: String(W.place_id), name: W.name || W.displayName || 'Lugar',
      lat: W.lat != null ? Number(W.lat) : undefined, lng: W.lng != null ? Number(W.lng) : undefined,
      cat: W.category || A.cat || '', after: f.base + f.gap, dur: f.dur,
      act: A.key, emoji: A.emoji,
      note: f.note.trim() || undefined, address: W.address || W.formattedAddress || undefined,
    };
    const next = [...f.cur, stop];
    const ok = await this._planRpc('set_plan_stops', { p_activity: f.a.id, p_stops: next }, `Agregaste ${stop.name} · ya les avisamos`);
    if (ok) f.a.stops = next;
    return ok;
  }
}
