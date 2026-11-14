// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/new-plan.js
// El botón "+" del mapa: armar un plan desde cero por pasos, con las
// mismas pantallas de "Agregar parada" y "Planear visita":
//   1 ¿Qué van a hacer?     íconos por categoría          (stop-flow)
//   2 ¿Dónde?               cerca · buscar · elegir en el mapa
//                           (pin, punto propio o tu ubicación)
//   3 ¿Cuándo?  4 ¿Quién puede unirse?  5 ¿Quién va?
//   6 ¿Cómo lo llamamos?    7 Detalles                    (plan-wizard)
// Al elegir lugar se rellena el contexto del asistente (this._place,
// info, íconos) y se crea con la misma RPC create_plan.
// Se mezcla en PlaceModal2.prototype.   Estilos: /styles/plan-steps.css
// ════════════════════════════════════════════════════════════════════
import { openStepScreen } from '/src/components/place-plans/step-screen.js';
import { FALLBACK_ACTS } from '/src/components/place-plans/stop-flow.js';
import { pickPlaceOnMap } from '/src/components/place-plans/pick-place.js';
import { openPlacePicker } from '/src/components/place-plans/place-picker.js';

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const kmTxt = (d) => (d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`);
const SEARCH = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const MAP = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7z"/><path d="M9 4v13M15 7v13"/></svg>';

export class NewPlan {
  _openNewPlan() {
    const user = this._requireUser('Inicia sesión para planear algo');
    if (!user) return;
    const prev = this._place;
    this._place = { name: 'Lugar', category: '' };   // provisional: el real llega en el paso ¿Dónde?
    const w = this._pwContext(user);
    const c = window.wpApp?.mapView?.map?.getCenter?.();
    Object.assign(w, {
      cat: 'RESTAURANTS', act: null, place: null, pick: null, all: [], res: [],
      acts: (this._actTypes || []).length ? this._actTypes : FALLBACK_ACTS,
      origin: c ? { lat: c.lat, lng: c.lng } : null,
    });
    w.screen = openStepScreen({
      sheet: true,
      doneLabel: 'Crear plan',
      haptic: (k) => this._haptic?.(k),
      onDone: () => this._pwCreate(w),
      onClose: () => { if (!w.keepPlace) this._place = prev; },
      steps: [
        { title: '¿Qué van a hacer?', sub: 'Elige el tipo de plan', mount: (el) => this._sfMountWhat(w, el), valid: () => !!w.act },
        { title: '¿Dónde?', sub: 'Cerca de ti', mount: (el, sec) => this._npMountWhere(w, el, sec), valid: () => !!w.pick, onEnter: () => this._npPaintWhere(w) },
        { title: '¿Cuándo?', sub: ' ', mount: (el) => this._pwMountWhen(w, el), valid: () => !this._pwPast(w), onEnter: () => this._npApply(w) },
        { title: '¿Quién puede unirse?', mount: (el) => this._pwMountVis(w, el) },
        { title: '¿Quién va?', sub: 'Toca a quien quieras invitar', mount: (el, sec) => this._pwMountPeople(w, el, sec),
          optional: () => w.vis !== 'invited', valid: () => w.vis !== 'invited' || w.invited.size > 0, onEnter: () => this._pwPaintPeople(w) },
        { title: '¿Cómo lo llamamos?', sub: 'Desliza para elegir su ícono', mount: (el) => this._pwMountName(w, el), onEnter: () => this._pwPaintName(w),
          valid: () => !!(w.title || '').trim() },
        { title: 'Detalles', sub: 'Para que todos lleguen sabiendo', optional: true, mount: (el) => this._pwMountDetails(w, el), onEnter: () => this._pwPaintDetails(w) },
      ],
    });
    this._pwLoadPeople(w);
    this._planPlaces().then((ps) => { w.all = (ps || []).filter(p => p.place_id && p.lat && p.lng); this._npPaintWhere(w); });
  }

  // ── Paso 2 · dónde ────────────────────────────────────────────────────
  _npMountWhere(w, el, sec) {
    w.whereEl = el; w.whereSub = sec.querySelector('.wp-st-sub');
    el.innerHTML = `
      <button type="button" class="wp-st-search wp-seats-q" data-q>${SEARCH}<span>Buscar un lugar</span></button>
      <button type="button" class="wp-st-row wp-st-map" data-a="map"><span class="wp-st-row-ph wp-st-map-ic">${MAP}</span>
        <span class="wp-st-row-t"><b>Elegir en el mapa</b><small>Un pin, cualquier punto o tu ubicación</small></span></button>
      <div class="wp-st-picked"></div>
      <div class="wp-st-list"></div>`;
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-q]')) { this._npSearch(w, e.target.closest('[data-q]')); return; }
      if (e.target.closest('[data-a="map"]')) { this._npPick(w); return; }
      const r = e.target.closest('.wp-st-row[data-i]'); if (!r) return;
      const p = w.res?.[+r.dataset.i]; if (!p) return;
      w.pick = w.pick && String(w.pick.place_id) === String(p.place_id) ? null : p;
      this._haptic?.('light');
      this._npPaintWhere(w);
      w.screen.refresh();
    });
  }

  // Candidatos del paso (cerca de ti, o lo que coincide con la búsqueda), con distancia
  _npCandidates(w, q = '') {
    const A = this._sfAct(w), k = norm(q.trim());
    let base = w.all;
    // Siempre dentro de la categoría del plan elegido en el paso 1
    if (A) base = base.filter(p => String(p.category || '').toUpperCase() === A.cat);
    if (k) base = base.filter(p => norm(p.name).includes(k) || norm(p.formattedAddress).includes(k));
    else if (A) {
      const subs = new Set(A.subcats || []);
      const tags = (p) => [...(Array.isArray(p.subcategoryTags) ? p.subcategoryTags : []), p.subcategory].map(x => String(x || '').toLowerCase());
      const same = base.filter(p => String(p.category || '').toUpperCase() === A.cat);
      const fit = subs.size ? same.filter(p => tags(p).some(t => subs.has(t))) : [];
      base = fit.length ? fit : same;
    }
    const o = w.origin;
    return base.map(p => [p, o ? this._distM(o, p) : 0]).sort((x, y) => x[1] - y[1]).slice(0, k ? 15 : 6);
  }

  // Buscador en zoom (igual que "Buscar a quién sigues"): campo y resultados dentro de la tarjeta
  _npSearch(w, from) {
    const o = w.origin;
    openPlacePicker({
      from, esc: (t) => this._esc(t), haptic: (k) => this._haptic?.(k),
      face: (p) => this._esc(p.photoUrl || p.photosUrls?.[0] || ''),
      emoji: (p) => this._stopEmoji(p.category),
      search: (q) => this._npCandidates(w, q).map(([p, d]) => ({ place: p, sub: `${p.rating ? `★ ${parseFloat(p.rating).toFixed(1)} · ` : ''}${o ? kmTxt(d) : (p.formattedAddress || '')}` })),
      isOn: (p) => !!w.pick && String(w.pick.place_id) === String(p.place_id),
      onPick: (p) => { w.pick = { ...p, category: this._sfAct(w)?.cat || p.category, viaSearch: true }; },
      onClose: () => { this._npPaintWhere(w); w.screen.refresh(); },
    });
  }

  _npPaintWhere(w) {
    const el = w.whereEl; if (!el) return;
    const A = this._sfAct(w);
    if (w.whereSub) w.whereSub.textContent = A ? `Para ${A.label.toLowerCase()}` : 'Cerca de ti';
    const o = w.origin;
    const res = this._npCandidates(w);
    w.res = res.map(r => r[0]);
    // lo elegido en el mapa (punto propio o pin) va arriba, marcado
    const pk = w.pick, fromMap = pk && (pk.custom || !w.res.some(p => String(p.place_id) === String(pk.place_id)));
    const pph = pk && !pk.custom ? (pk.photoUrl || pk.photosUrls?.[0] || '') : '';
    el.querySelector('.wp-st-picked').innerHTML = fromMap ? `<div class="wp-st-row on"><span class="wp-st-row-ph"${pph ? ` style="background-image:url('${this._esc(pph)}')"` : ''}>${pph ? '' : pk.custom ? this._esc(pk.emoji || '📍') : this._stopEmoji(pk.category)}</span>
        <span class="wp-st-row-t"><b>${this._esc(pk.name)}</b><small>${pk.viaSearch ? 'Elegido' : 'Elegido en el mapa'}</small></span><i class="wp-st-radio"></i></div>` : '';
    const list = el.querySelector('.wp-st-list');
    if (!w.all.length) { list.innerHTML = '<p class="wp-st-empty">Cargando lugares…</p>'; return; }
    list.innerHTML = res.length ? res.map(([p, d], i) => {
      const ph = p.photoUrl || p.photosUrls?.[0] || '';
      const on = pk && String(pk.place_id) === String(p.place_id);
      return `<button type="button" class="wp-st-row${on ? ' on' : ''}" data-i="${i}">
          <span class="wp-st-row-ph"${ph ? ` style="background-image:url('${this._esc(ph)}')"` : ''}>${ph ? '' : this._stopEmoji(p.category)}</span>
          <span class="wp-st-row-t"><b>${this._esc(p.name)}</b><small>${p.rating ? `★ ${parseFloat(p.rating).toFixed(1)} · ` : ''}${o ? kmTxt(d) : this._esc(p.formattedAddress || '')}</small></span>
          <i class="wp-st-radio"></i></button>`;
    }).join('') : `<p class="wp-st-empty">No hay lugares así cerca · busca o elígelo en el mapa</p>`;
  }

  // "Elegir en el mapa": la hoja se esconde, el mapa queda libre y al
  // elegir se regresa al mismo paso con el lugar marcado
  _npPick(w) {
    const A = this._sfAct(w);
    this._haptic?.('light');
    pickPlaceOnMap({
      cat: A?.cat || w.cat, emoji: A?.emoji,
      onPick: (p) => {
        w.pick = p.custom ? p : { ...p, category: A?.cat };
        w.res = w.res || [];
        this._npPaintWhere(w); w.screen.refresh();
        setTimeout(() => { if (w.screen.index === 1) w.screen.go(2); }, 260);   // elegir = avanzar
      },
      onCancel: () => { this._npPaintWhere(w); w.screen.refresh(); },
    });
  }

  // Con el lugar elegido se rellena lo que el asistente de "Planear visita"
  // espera (lugar, datos, íconos del plan)
  _npApply(w) {
    const p = w.pick, A = this._sfAct(w);
    if (!p) return;
    const place = { ...p, category: p.category || A?.cat || w.cat };
    this._place = w.place = place;
    w.info = this._placeInfo();
    const { shown, type } = this._pwTypes(place);
    let list = shown, t = type;
    if (A) {
      list = [[A.key, A.emoji, A.label], ...shown.filter(x => x[0] !== A.key)];
      t = A.key;
    }
    w.shown = list; w.type = t;
    const sub = w.screen.root.querySelectorAll('.wp-st-step')[2]?.querySelector('.wp-st-sub');
    if (sub) sub.textContent = w.info.name;
    if (w.nameEl) this._pwMountName(w, w.nameEl);   // el selector de íconos se arma de nuevo con los del lugar
    if (!w.titleTouched) w.title = this._pwAutoTitle(w);
  }
}
