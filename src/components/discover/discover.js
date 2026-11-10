// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — discover/discover.js
// "Discover": el home para descubrir (el botón de arriba del mapa).
//  · Arriba: la tira de Momentos (como stories: la foto y la carita en la
//    esquina); "Mapa" en la barra abre el buscador del mapa.
//  · Minicalendario + los planes más cercanos (tocar un día filtra).
//  · Gente que quizá conozcas · Nuevos · Ranking · Lugares destacados
//    (portrait). Una sección sin nada se esconde.
//  · Abajo, flotando: chips de color suave (Todo · Planes · Personas ·
//    Lugares) y la barra de búsqueda con su filtro; con texto o con el
//    teclado abierto sale la X para borrar y cerrar.
//  · Sin internet: lo último que se vio (tab-cache.js) con aviso.
// En la base: supabase/39_discover.sql (discover_feed, discover_search).
//
// Uso: const d = new Discover({ getPM, getPlaces, openMapSearch }); d.open()
// Estilos: /styles/discover.css · tarjetas: discover-cards.js
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { addDragStrip } from '/src/components/place-plans/drag-strip.js';
import { wave } from '/src/components/place-plans/wave.js';
import { ensureCss } from '/src/components/tabs/tab-screen.js';
import { cacheGet, cacheSet, withTimeout, netError, offlineNote } from '/src/components/tabs/tab-cache.js';
import { PointsService } from '/src/services/PointsService.js';
import { SocialService } from '/src/services/SocialService.js';
import { planCard, personCard, rankRow, placeCard, momentCard, momentAdd, section, emptyBox, SEARCH_IC } from '/src/components/discover/discover-cards.js';
import { calStrip, dayKey } from '/src/components/discover/discover-cal.js';
import { MomentsService as MS } from '/src/services/MomentsService.js';
import { ICON_HOME } from '/src/components/FooterMenu.js';

// Cada chip lleva el tono suave de un pin (pin-palette.js)
const CHIPS = [['all', 'Todo', '#5b6270', '#8d93a0'], ['plans', 'Planes', '#5b63d6', '#8f95ea'], ['people', 'Personas', '#d9668f', '#ec97b4'], ['places', 'Lugares', '#5fa67a', '#8fcaa2']];
const FILTER_IC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg>';
const X_IC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

export class Discover {
  constructor({ getPM, getPlaces, openMapSearch }) {
    Object.assign(this, { getPM, getPlaces, openMapSearch });
    this.page = null; this.feed = null; this.rank = []; this.filter = 'all'; this.q = ''; this.res = null; this.t = 0;
  }

  open() {
    ensureCss('wp-discover-css', '/styles/discover.css');
    if (this.page) return;
    this.filter = 'all'; this.q = ''; this.res = null; this.day = null; this.when = 'any'; this.sort = 'rating';
    this.page = openSheetPage({ title: 'Discover',
      right: `<button type="button" class="wp-dc-map" data-map aria-label="Buscar en el mapa"><i style="display:flex;width:20px;height:20px">${ICON_HOME.replace('<svg ', '<svg width="20" height="20" ')}</i>Mapa</button>`,
      html: '<div class="wp-dc"><div class="wp-dc-body"><div class="wp-dc-sk"></div><div class="wp-dc-sk"></div></div></div>',
      foot: `<div class="wp-dc-bar">
        <div class="wp-dc-chips"><div class="wp-dc-track">${CHIPS.map(([k, t, b, l]) => `<button type="button" data-f="${k}" style="--cb:${b};--cl:${l}"${k === 'all' ? ' class="on"' : ''}>${t}</button>`).join('')}</div></div>
        <div class="wp-dc-field"><label class="wp-dc-search">${SEARCH_IC}<input type="text" inputmode="search" placeholder="Busca gente, planes o lugares" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"><button type="button" class="wp-dc-x" data-x aria-label="Borrar y cerrar">${X_IC}</button></label>
          <button type="button" class="wp-dc-filter" data-filter aria-label="Filtros">${FILTER_IC}</button></div></div>`,
      onClose: () => { this.page = null; clearTimeout(this.t); } });
    this.page.root.classList.add('wp-dc-sheet');
    this.page.relayout();
    setTimeout(() => this.page?.relayout(), 120); setTimeout(() => this.page?.relayout(), 600);   // por si los estilos llegaron tarde
    const pg = this.page, root = pg.root;
    addDragStrip(pg.foot.querySelector('.wp-dc-chips'));
    root.addEventListener('click', (e) => this._click(e));
    const inp = pg.foot.querySelector('input'), bar = pg.foot.querySelector('.wp-dc-field');
    const sync = () => bar.classList.toggle('open', document.activeElement === inp || !!inp.value);
    inp.addEventListener('focus', sync); inp.addEventListener('blur', () => setTimeout(sync, 60));
    inp.addEventListener('input', () => { sync(); clearTimeout(this.t); this.q = inp.value.trim(); this.t = setTimeout(() => this._search(), 280); });
    this.inp = inp; this.sync = sync;
    this._load();
    this._loadMoments();
  }

  close() { this.page?.close(); }

  async _load() {
    try {
      const { data, error } = await withTimeout(getSupabase().rpc('discover_feed'));
      if (error) throw error;
      this.feed = data; this.offline = false; cacheSet('discover', data);
    } catch (e) {
      this.offline = netError(e);
      this.feed = cacheGet('discover')?.data || null;
      this.err = !this.offline;
    }
    PointsService.ranking('week').then(r => { this.rank = (r || []).slice(0, 5); if (this.page && !this.q) this._paint(false); }).catch(() => {});
    if (this.page) this._paint(true);
  }

  async _search() {
    if (!this.page) return;
    if (this.q.length < 2) { this.res = null; this._paint(false); return; }
    const q = this.q.toLowerCase();
    const places = (this.getPlaces?.() || []).filter(p => String(p.name || '').toLowerCase().includes(q)).slice(0, 12);
    this.res = { people: [], plans: [], places, loading: true };
    this._paint(false);
    try {
      const { data, error } = await withTimeout(getSupabase().rpc('discover_search', { p_q: this.q }));
      if (error) throw error;
      if (this.q.toLowerCase() !== q) return;
      this.res = { people: data.people || [], plans: data.plans || [], places };
    } catch (_) { this.res = { people: [], plans: [], places, failed: true }; }
    this._paint(false);
  }

  // Momentos vivos agrupados por persona (los míos primero, luego el más reciente)
  async _loadMoments() {
    try {
      const list = await withTimeout(MS.listActive(80));
      const me = window.wpApp?.currentUser?.id, by = new Map();
      list.forEach(m => { if (!by.has(m.user_id)) by.set(m.user_id, { uid: m.user_id, mine: m.user_id === me, items: [] }); by.get(m.user_id).items.push(m); });
      let seen = []; try { seen = JSON.parse(localStorage.getItem('wpMomentsSeen') || '[]'); } catch (_) {}
      this.mo = [...by.values()].map(g => ({ ...g, seen: g.items.every(m => seen.includes(m.id)) }))
        .sort((a, b) => (b.mine - a.mine) || (a.seen - b.seen));
    } catch (_) { this.mo = []; }
    if (this.page && !this.res) this._paint(false);
  }

  _plansOf(d) {
    let l = d.plans || [];
    if (this.when === 'today') l = l.filter(a => dayKey(a.scheduled_at) === dayKey(new Date()));
    else if (this.when === 'week') l = l.filter(a => Date.parse(a.scheduled_at) < Date.now() + 7 * 864e5);
    return l;
  }

  _paint(animate) {
    const box = this.page?.body.querySelector('.wp-dc-body'); if (!box) return;
    const f = this.filter, show = (k) => f === 'all' || f === k, pm = this.getPM();
    const esc = (s) => (pm?._esc ? pm._esc(s) : String(s ?? ''));
    let html = '';
    if (this.res) {                                           // resultados de búsqueda
      const r = this.res;
      if (show('people') && r.people.length) html += section('Personas', r.people.map(p => personCard(p, esc)).join(''), { list: true });
      if (show('plans') && r.plans.length) html += section('Planes', r.plans.map(a => planCard(a, esc)).join(''), { list: true });
      if (show('places') && r.places.length) html += section('Lugares', r.places.map(p => placeCard(p, esc, this._idx(p))).join(''), { list: true });
      if (!html) html = r.loading ? '<div class="wp-dc-sk"></div>' : emptyBox('Nada por aquí', r.failed ? 'No se pudo buscar ahora. Intenta de nuevo.' : 'Prueba con otro nombre, @usuario o lugar.');
    } else {
      const d = this.feed || {};
      if (this.offline && !this.feed) { box.innerHTML = offlineNote(false); return; }
      // Momentos: solo en "Todo" y "Personas"
      if (show('people') && f === 'all') {
        const mo = (this.mo || []);
        html += `<section class="wp-dc-sec first"><div class="wp-dc-strip"><div class="wp-dc-track">${momentAdd()}${mo.map((g, i) => momentCard(g, esc, i)).join('')}</div></div></section>`;
      }
      if (show('plans')) {
        const all = d.plans || [], l = this._plansOf(d).filter(a => !this.day || dayKey(a.scheduled_at) === this.day);
        if (all.length) html += `<section class="wp-dc-sec"><h3>Planes más cercanos</h3>${calStrip(all, this.day)}${l.length
          ? `<div class="wp-dc-strip"><div class="wp-dc-track">${l.map(a => planCard(a, esc)).join('')}</div></div>`
          : '<p class="wp-dc-none">Sin planes ese día. Toca otro.</p>'}</section>`;
      }
      if (show('people') && d.suggested?.length) html += section('Gente que quizá conozcas', d.suggested.map(p => personCard(p, esc, true)).join(''), { strip: true });
      if (show('people') && d.newest?.length) html += section('Nuevos en WhatsPlan', d.newest.map(p => personCard(p, esc, true)).join(''), { strip: true });
      if (show('people') && this.rank.length) html += section('Ranking de la semana', this.rank.map((r, i) => rankRow(r, i, esc)).join(''), { list: true });
      if (show('places')) {
        const top = this._trending();
        if (top.length) html += section('Lugares destacados', top.map(p => placeCard(p, esc, this._idx(p), true)).join(''), { strip: true });
      }
      if (!html) html = emptyBox('Todavía no hay nada que mostrar', this.err ? 'No se pudo cargar. Intenta de nuevo.' : 'Cuando haya planes y gente nueva cerca, aparecen aquí.');
    }
    box.innerHTML = (this.offline ? offlineNote(true) : '') + html;
    box.querySelectorAll('.wp-dc-strip').forEach(addDragStrip);
    if (animate) wave(box, '.wp-off-bar, .wp-dc-sec > h3, .wp-dc-card, .wp-dc-row, .wp-dc-mo', { max: 12 });
  }

  _idx(p) { return (window.wpApp?.mapView?.allPlaces || []).indexOf(p); }
  // Lugares destacados: nota 4+ y 3+ reseñas, por nota o por reseñas (filtro)
  _trending() {
    const n = (p) => Number(p.userRatingCount ?? 0), r = (p) => Number(p.rating || 0);
    return (this.getPlaces?.() || []).filter(p => r(p) >= 4 && n(p) >= 3)
      .sort((a, b) => this.sort === 'reviews' ? n(b) - n(a) : (r(b) * Math.log(2 + n(b))) - (r(a) * Math.log(2 + n(a)))).slice(0, 10);
  }

  async _click(e) {
    const t = e.target;
    if (t.closest('[data-map]')) { this.close(); setTimeout(() => this.openMapSearch?.(), 340); return; }
    const chip = t.closest('.wp-dc-chips [data-f]');
    if (chip) {
      this.filter = chip.dataset.f;
      this.page.root.querySelectorAll('.wp-dc-chips [data-f]').forEach(b => b.classList.toggle('on', b === chip));
      this.getPM()?._haptic?.('light'); this._paint(true); return;
    }
    if (t.closest('[data-x]')) { this.inp.value = ''; this.q = ''; this.res = null; this.inp.blur(); this.sync(); this._paint(false); return; }
    if (t.closest('[data-filter]')) { this._filters(t.closest('[data-filter]')); return; }
    const day = t.closest('[data-day]');
    if (day) { this.day = this.day === day.dataset.day ? null : day.dataset.day; this._paint(false); return; }
    if (t.closest('[data-mo-add]')) { window.wpApp?.momentsUI?.openCamera?.(); return; }
    const mo = t.closest('[data-mo]');
    if (mo) { this._moment(+mo.dataset.mo); return; }
    const fb = t.closest('[data-follow]');
    if (fb) { e.stopPropagation(); this._follow(fb); return; }
    const person = t.closest('[data-uid]');
    if (person) { this._person(person.dataset.uid, person); return; }
    const plan = t.closest('[data-plan]');
    if (plan) { this._plan(plan.dataset.plan); return; }
    const place = t.closest('[data-place]');
    if (place) this._place(place.dataset.place);
  }

  // Ver los momentos desde esa persona (siguen los demás, como stories)
  _moment(i) {
    const flat = (this.mo || []).flatMap(g => g.items), g = this.mo?.[i]; if (!g) return;
    window.wpApp?.momentsUI?.open?.(flat, flat.indexOf(g.items[0]));
  }

  // Menú del filtro: cuándo (planes) y cómo ordenar los lugares
  _filters(btn) {
    const pm = this.getPM(); if (!pm) return;
    const W = (k, label) => ({ label, icon: 'dot', active: this.when === k, onClick: () => { this.when = k; this.day = null; this._paint(false); this._mark(); } });
    const S = (k, label) => ({ label, icon: 'dot', active: this.sort === k, onClick: () => { this.sort = k; this._paint(false); this._mark(); } });
    pm._openPopMenu?.(btn, [W('any', 'Planes: cualquier fecha'), W('today', 'Planes: hoy'), W('week', 'Planes: esta semana'), { sep: true }, S('rating', 'Lugares: mejor calificados'), S('reviews', 'Lugares: más reseñas')]);
    const pop = document.querySelector('.wp-pm2-pop'); if (pop) pop.style.zIndex = '1500700';
  }
  _mark() { this.page?.foot.querySelector('.wp-dc-filter')?.classList.toggle('on', this.when !== 'any' || this.sort !== 'rating'); }

  _person(uid, el) {
    const pm = this.getPM(); if (!pm) return;
    pm._openMiniProfile?.(uid, 'saved', el.dataset.name || '', el.dataset.av || '');
    const up = () => { const m = document.getElementById('wp-mp'); if (m) m.style.zIndex = '1500600'; };
    up(); requestAnimationFrame(up);
  }

  async _follow(btn) {
    const me = window.wpApp?.currentUser?.id, uid = btn.dataset.follow;
    if (!me) { window.wpApp?.authModal?.show?.(); return; }
    if (btn.classList.contains('busy')) return;
    btn.classList.add('busy');
    try {
      await SocialService.follow(me, uid, window.wpApp?.currentUser?.user_metadata?.name || '');
      btn.outerHTML = '<span class="wp-dc-done">Siguiendo</span>';
      this.getPM()?._haptic?.('medium');
    } catch (_) { btn.classList.remove('busy'); this.getPM()?._showToast?.('No se pudo seguir'); }
  }

  async _plan(id) {
    const pm = this.getPM(); if (!pm) return;
    if (!window.wpApp?.currentUser) { window.wpApp?.authModal?.show?.(); return; }
    let a = null;
    try { ({ data: a } = await withTimeout(getSupabase().from('activities').select('*').eq('id', id).maybeSingle())); } catch (_) {}
    if (!a) { pm._showToast?.(this.offline ? 'Sin conexión' : 'Ese plan ya no está disponible'); return; }
    this.close();
    setTimeout(() => window.wpApp?.plansTab?._openPlan?.(a), 340);
  }

  _place(key) {
    const list = window.wpApp?.mapView?.allPlaces || [];
    const idx = list.findIndex(p => String(p.place_id || p.id) === key), p = list[idx], mv = window.wpApp?.mapView;
    if (!p || !mv) return;
    this.close();
    setTimeout(() => {
      const raw = p.photoUrl || p.photo_url || (p.photosUrls && p.photosUrls[0]) || null;
      mv.getMap?.().easeTo({ center: [p.lng, p.lat], zoom: Math.max(mv.getMap().getZoom(), 15), duration: 500 });
      mv._showMiniCard?.(p, idx, raw, true);
    }, 340);
  }
}

const score = (p) => Number(p.rating || 0) * Math.log(2 + Number(p.userRatingCount ?? 0));
