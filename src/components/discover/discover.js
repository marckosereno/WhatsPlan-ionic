// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — discover/discover.js
// "Discover": el home para descubrir (el botón de arriba del mapa).
//  · Buscador arriba: gente (nombre / @usuario), planes y lugares.
//    "Buscar en el mapa" abre el buscador de siempre (con categorías).
//  · Chips: Todo · Planes · Personas · Lugares.
//  · Secciones en carrusel: Planes cerca de ti · Gente que quizá conozcas
//    · Nuevos en WhatsPlan · Ranking de la semana · Lugares en tendencia.
//    Una sección sin nada se esconde.
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
import { planCard, personCard, rankRow, placeCard, section, emptyBox, SEARCH_IC, MAP_IC } from '/src/components/discover/discover-cards.js';

const CHIPS = [['all', 'Todo'], ['plans', 'Planes'], ['people', 'Personas'], ['places', 'Lugares']];

export class Discover {
  constructor({ getPM, getPlaces, openMapSearch }) {
    Object.assign(this, { getPM, getPlaces, openMapSearch });
    this.page = null; this.feed = null; this.rank = []; this.filter = 'all'; this.q = ''; this.res = null; this.t = 0;
  }

  open() {
    ensureCss('wp-discover-css', '/styles/discover.css');
    if (this.page) return;
    this.filter = 'all'; this.q = ''; this.res = null;
    this.page = openSheetPage({ title: 'Discover',
      html: `<div class="wp-dc">
        <label class="wp-dc-search">${SEARCH_IC}<input type="search" placeholder="Busca gente, planes o lugares" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"></label>
        <div class="wp-dc-chips"><div class="wp-dc-track">${CHIPS.map(([k, t]) => `<button type="button" data-f="${k}"${k === 'all' ? ' class="on"' : ''}>${t}</button>`).join('')}<button type="button" data-map class="ghost">${MAP_IC}Buscar en el mapa</button></div></div>
        <div class="wp-dc-body"><div class="wp-dc-sk"></div><div class="wp-dc-sk"></div></div></div>`,
      onClose: () => { this.page = null; clearTimeout(this.t); } });
    this.page.root.classList.add('wp-dc-sheet');
    addDragStrip(this.page.body.querySelector('.wp-dc-chips'));
    this.page.body.addEventListener('click', (e) => this._click(e));
    const inp = this.page.body.querySelector('input');
    inp.addEventListener('input', () => { clearTimeout(this.t); this.q = inp.value.trim(); this.t = setTimeout(() => this._search(), 280); });
    this._load();
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
      const d = this.feed || {}, mine = new Set();
      if (this.offline && !this.feed) { box.innerHTML = offlineNote(false); return; }
      if (show('plans') && d.plans?.length) html += section('Planes cerca de ti', d.plans.map(a => planCard(a, esc)).join(''), { strip: true });
      if (show('people') && d.suggested?.length) html += section('Gente que quizá conozcas', d.suggested.map(p => personCard(p, esc, true)).join(''), { strip: true });
      if (show('people') && d.newest?.length) html += section('Nuevos en WhatsPlan', d.newest.map(p => personCard(p, esc, true)).join(''), { strip: true });
      if (show('people') && this.rank.length) html += section('Ranking de la semana', this.rank.map((r, i) => rankRow(r, i, esc)).join(''), { list: true });
      if (show('places')) {
        const top = this._trending();
        if (top.length) html += section('Lugares en tendencia', top.map(p => placeCard(p, esc, this._idx(p), true)).join(''), { strip: true });
      }
      if (!html) html = emptyBox('Todavía no hay nada que mostrar', this.err ? 'No se pudo cargar. Jala para volver a intentar.' : 'Cuando haya planes y gente nueva cerca, aparecen aquí.');
      void mine;
    }
    box.innerHTML = (this.offline ? offlineNote(true) : '') + html;
    box.querySelectorAll('.wp-dc-strip').forEach(addDragStrip);
    if (animate) wave(box, '.wp-off-bar, .wp-dc-sec > h3, .wp-dc-card, .wp-dc-row', { max: 10 });
  }

  _idx(p) { return (window.wpApp?.mapView?.allPlaces || []).indexOf(p); }
  // Lugares con mejor nota y más reseñas (mínimo 3 reseñas para no premiar a un solo voto)
  _trending() {
    return (this.getPlaces?.() || []).filter(p => Number(p.rating) >= 4 && Number(p.userRatingCount ?? 0) >= 3)
      .sort((a, b) => score(b) - score(a)).slice(0, 10);
  }

  async _click(e) {
    const t = e.target;
    const chip = t.closest('.wp-dc-chips [data-f]');
    if (chip) {
      this.filter = chip.dataset.f;
      this.page.body.querySelectorAll('.wp-dc-chips [data-f]').forEach(b => b.classList.toggle('on', b === chip));
      this._paint(true); return;
    }
    if (t.closest('[data-map]')) { this.close(); setTimeout(() => this.openMapSearch?.(), 340); return; }
    const fb = t.closest('[data-follow]');
    if (fb) { e.stopPropagation(); this._follow(fb); return; }
    const person = t.closest('[data-uid]');
    if (person) { this._person(person.dataset.uid, person); return; }
    const plan = t.closest('[data-plan]');
    if (plan) { this._plan(plan.dataset.plan); return; }
    const place = t.closest('[data-place]');
    if (place) this._place(place.dataset.place);
  }

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
