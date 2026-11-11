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

import { titleHtml, wireHead } from '/src/components/discover/discover-head.js';
import { wireSearch, filterPill } from '/src/components/discover/discover-search.js';

export class Discover {
  constructor({ getPM, getPlaces, openMapSearch }) {
    Object.assign(this, { getPM, getPlaces, openMapSearch });
    this.page = null; this.feed = null; this.rank = []; this.filter = 'all'; this.q = ''; this.res = null; this.t = 0;
  }

  open() {
    ensureCss('wp-discover-css', '/styles/discover.css');
    if (this.page) return;
    this.filter = 'all'; this.q = ''; this.res = null; this.day = null; this.when = 'any'; this.sort = 'rating';
    this.page = openSheetPage({ title: titleHtml('all'),
      right: `<button type="button" class="wp-st-back wp-dc-map" data-map aria-label="Ir al mapa"><i style="display:flex;width:22px;height:22px">${ICON_HOME.replace('<svg ', '<svg width="22" height="22" ')}</i></button>`,
      html: `<div class="wp-dc"><div class="wp-dc-search home" role="button" tabindex="0" aria-label="Buscar">${SEARCH_IC}<span class="wp-dc-phold">Personas, planes o lugares</span>${filterPill()}</div>
        <div class="wp-dc-body"><div class="wp-dc-sk"></div><div class="wp-dc-sk"></div></div></div>`,
      onClose: () => { this.page = null; clearTimeout(this.t); } });
    this.page.root.classList.add('wp-dc-sheet');
    this.page.relayout();
    setTimeout(() => this.page?.relayout(), 120); setTimeout(() => this.page?.relayout(), 600);   // por si los estilos llegaron tarde
    this.page.root.addEventListener('click', (e) => this._click(e));
    this.head = wireHead(this); this.sm = wireSearch(this);
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
    if (this.q.length < 2) { this.res = null; this.sm?.paint(); return; }
    const q = this.q.toLowerCase();
    const places = (this.getPlaces?.() || []).filter(p => String(p.name || '').toLowerCase().includes(q)).slice(0, 12);
    this.res = { people: [], plans: [], places, loading: true };
    this.sm?.paint();
    try {
      const { data, error } = await withTimeout(getSupabase().rpc('discover_search', { p_q: this.q }));
      if (error) throw error;
      if (this.q.toLowerCase() !== q) return;
      this.res = { people: data.people || [], plans: data.plans || [], places };
    } catch (_) { this.res = { people: [], plans: [], places, failed: true }; }
    this.sm?.paint();
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
    {
      const d = this.feed || {};
      if (this.offline && !this.feed) { box.innerHTML = offlineNote(false); return; }
      // Momentos: solo en "Todo" y "Personas"
      if (show('people') && f === 'all') {
        const mo = (this.mo || []);
        html += `<section class="wp-dc-sec first"><div class="wp-dc-strip"><div class="wp-dc-track">${momentAdd()}${mo.map((g, i) => momentCard(g, esc, i)).join('')}</div></div></section>`;
      }
      if (show('places')) {
        const top = this._trending();
        if (top.length) html += section('Lugares destacados', top.map(p => placeCard(p, esc, this._idx(p), true)).join(''), { strip: true });
      }
      if (show('plans')) {
        const all = d.plans || [], l = this._plansOf(d).filter(a => !this.day || dayKey(a.scheduled_at) === this.day);
        if (all.length) html += `<section class="wp-dc-sec"><h3>Planes más cercanos</h3>${calStrip(all, this.day)}${l.length
          ? `<div class="wp-dc-strip"><div class="wp-dc-track">${l.map(a => planCard(a, esc)).join('')}</div></div>`
          : '<p class="wp-dc-none">Sin planes ese día. Toca otro.</p>'}</section>`;
      }
      if (show('people') && d.suggested?.length) html += section('Personas que quizá conozcas', d.suggested.map(p => personCard(p, esc, true)).join(''), { strip: true });
      if (show('people') && d.newest?.length) html += section('Nuevos en WhatsPlan', d.newest.map(p => personCard(p, esc, true)).join(''), { strip: true });
      if (show('people') && this.rank.length) html += section('Ranking de la semana', this.rank.map((r, i) => rankRow(r, i, esc)).join(''), { list: true });
      if (!html) html = emptyBox('Todavía no hay nada que mostrar', this.err ? 'No se pudo cargar. Intenta de nuevo.' : 'Cuando haya planes y personas nuevas cerca, aparecen aquí.');
    }
    box.innerHTML = (this.offline ? offlineNote(true) : '') + html;
    box.querySelectorAll('.wp-dc-strip').forEach(addDragStrip);
    if (animate) wave(box, '.wp-off-bar, .wp-dc-sec > h3, .wp-dc-card, .wp-dc-row, .wp-dc-mo', { max: 12 });
  }

  counts() {
    const d = this.feed || {}, pl = this._plansOf(d).length, pe = (d.suggested?.length || 0) + (d.newest?.length || 0), lu = this._trending().length;
    return { all: pl + pe + lu, plans: pl, people: pe, places: lu };
  }

  _idx(p) { return (window.wpApp?.mapView?.allPlaces || []).indexOf(p); }
  // Lugares destacados: nota 4+ y 3+ reseñas, por nota o por reseñas (filtro)
  _trending() {
    const n = (p) => Number(p.userRatingCount ?? 0), r = (p) => Number(p.rating || 0);
    return (this.getPlaces?.() || []).filter(p => r(p) >= 4 && n(p) >= 3)
      .sort((a, b) => this.sort === 'reviews' ? n(b) - n(a) : (r(b) * Math.log(2 + n(b))) - (r(a) * Math.log(2 + n(a)))).slice(0, 10);
  }

  // El filtro de tipo (Todo · Planes · Personas · Lugares) lo comparten el título y la búsqueda
  setFilter(k) {
    if (!this.page || k === this.filter) return;
    this.filter = k;
    this.page.setTitle(titleHtml(k));
    this.page.root.querySelectorAll('.wp-dc-chips [data-f], .wp-dc-pop [data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === k));
    this.getPM()?._haptic?.('light');
    if (this.sm?.isOpen()) this.sm.paint(); else this._paint(true);
  }
  filterOn() { return this.when !== 'any' || this.sort !== 'rating'; }

  async _click(e) {
    const t = e.target;
    if (t.closest('[data-map]')) { this.close(); setTimeout(() => this.openMapSearch?.(), 340); return; }
    const chip = t.closest('[data-f]');
    if (chip && !t.closest('.wp-dc-pop')) { this.setFilter(chip.dataset.f); return; }
    if (t.closest('[data-filter]')) { e.stopPropagation(); this._filters(t.closest('[data-filter]')); return; }
    if (t.closest('.wp-dc-pop, .wp-dc-search, [data-x], [data-ttl], [data-more], [data-recx], [data-recall], [data-rec]')) return;
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
  _mark() { this.page?.root.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('on', this.filterOn())); }

  _person(uid, el) {
    const pm = this.getPM(); if (!pm) return;
    pm._openMiniProfile?.(uid, 'saved', el.dataset.name || '', el.dataset.av || '');
    const up = () => { const m = document.getElementById('wp-mp'); if (m) m.style.zIndex = '1500600'; };
    up(); requestAnimationFrame(up);
  }

  async _follow(btn) {
    if (btn.classList.contains('busy')) return;
    btn.classList.add('busy');
    try { await this._followId(btn.dataset.follow); btn.outerHTML = '<span class="wp-dc-done">Siguiendo</span>'; }
    catch (_) { btn.classList.remove('busy'); }
  }

  async _followId(uid) {
    const me = window.wpApp?.currentUser?.id;
    if (!me) { window.wpApp?.authModal?.show?.(); throw new Error('login'); }
    try {
      await SocialService.follow(me, uid, window.wpApp?.currentUser?.user_metadata?.name || '');
      this.getPM()?._haptic?.('medium');
    } catch (e) { this.getPM()?._showToast?.('No se pudo seguir'); throw e; }
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
