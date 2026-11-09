// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — tabs/plans-tab.js
// Pestaña "Planes" de la barra de abajo: todos los planes, no solo los
// de un lugar (eso es "Planes aquí" en la ficha).
//  · Pestañas: Explorar (planes de otros cerca: ~15 km del lugar donde
//    estás o del centro del mapa) · Mis planes (los que organizas y a los
//    que vas) · Guardados.
//  · Tira de días (la misma de "Planes aquí") y chips del tipo de plan.
//  · Tarjetas con foto (plans-tab-cards.js), agrupadas por día.
//  · Tocar un plan: tuyo o al que vas → "Tu plan" / "Vas a ir"; de otros
//    → el plan completo con Unirme (plans-here.js _openPlanDetailSheet).
//    Al cerrar, la lista se vuelve a cargar (por si te uniste).
//  · Todo entra en ola (wave.js), como las hojas grandes.
//  · Sin internet: se ve lo último que se cargó (tab-cache.js) con un
//    aviso, o "Sin conexión" si nunca se cargó; al volver la red se
//    recarga sola. prefetch() deja Mis planes y Explorar guardados al
//    abrir la app.
// Usa los ayudantes de la ficha (PlaceModal2) para caras, horas, días.
//
// Uso: const t = new PlansTab({ getPM, getMap, getPlaces }); t.open(); t.close()
// Estilos: /styles/tabs.css (.wp-pt-*) + /styles/plans-here.css (tira de días)
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { savedIds, setSaved, mySavedPlans } from '/src/components/place-plans/plan-saves.js';
import { addElastic } from '/src/components/place-plans/elastic.js';
import { photoSmall } from '/src/utils/photo-url.js';
import { wave } from '/src/components/place-plans/wave.js';
import { openTabScreen, ensureCss } from '/src/components/tabs/tab-screen.js';
import { cardHtml, skeletonHtml, planKind, TYPES } from '/src/components/tabs/plans-tab-cards.js';
import { cacheGet, cacheSet, withTimeout, netError, peopleOf, restorePeople, offlineNote, whenOnline } from '/src/components/tabs/tab-cache.js';

const TABS = [['explore', 'Explorar'], ['mine', 'Mis planes'], ['saved', 'Guardados']];
const NEAR = 0.14;   // ° alrededor (~15 km)
const EMPTY = {
  explore: ['Por ahora no hay planes cerca', 'Arma uno desde la ficha de un lugar con "Planear visita"'],
  mine: ['Aún no tienes planes', 'Únete a uno en Explorar o arma el tuyo'],
  saved: ['No has guardado planes', 'Toca el listón de un plan para tenerlo aquí'],
};

export class PlansTab {
  constructor({ getPM, getMap, getPlaces }) {
    Object.assign(this, { getPM, getMap, getPlaces });
    this.tab = 'explore'; this.type = 'all'; this.day = 'all';
    this.list = []; this.saved = new Set(); this.scr = null;
  }

  open(tab) {
    ensureCss('wp-ph-css', '/styles/plans-here.css');
    if (tab) this.tab = tab;
    if (this.scr?.root.isConnected) { this._pickTab(this.tab); return; }
    this.scr = openTabScreen('plans', `
      <header class="wp-pt-head"><h1>Planes</h1><span>Cerca de ti</span></header>
      <div class="wp-pt-tabs" role="tablist">${TABS.map(([k, t]) => `<button type="button" data-tab="${k}"${k === this.tab ? ' class="on"' : ''}>${t}</button>`).join('')}</div>
      <div class="wp-ph4-cal wp-pt-cal"></div>
      <div class="wp-pt-types"></div>
      <div class="wp-pt-list">${skeletonHtml()}</div>`);
    this.scr.root.addEventListener('click', (e) => this._click(e));
    wave(this.scr.body);   // encabezado, pestañas, días… en ola
    this._load();
  }

  close() { this.scr?.close(); this.scr = null; this._unOnline?.(); this._unOnline = null; }

  // Al abrir la app: dejar Mis planes y Explorar guardados en el teléfono
  async prefetch() {
    if (!window.wpApp?.currentUser) return;
    for (const tab of ['mine', 'explore']) { try { await this._fetchAll(tab); } catch (_) {} }
  }
  top() { this.scr?.vp.scrollTo({ top: 0, behavior: 'smooth' }); }

  // ── Datos ───────────────────────────────────────────────────────────
  _center() {
    const g = window.wpApp?.subcatRow?._lastGpsPos;
    if (g?.lat) return g;
    const c = this.getMap?.()?.getCenter?.();
    return c ? { lat: c.lat, lng: c.lng } : null;
  }

  async _fetch(tab) {
    const sb = getSupabase(), me = window.wpApp?.currentUser?.id;
    const since = new Date(Date.now() - 2 * 3600e3).toISOString();
    const base = () => sb.from('activities').select('*').eq('status', 'active').gt('scheduled_at', since).order('scheduled_at', { ascending: true });
    if (tab === 'saved') return me ? mySavedPlans() : [];
    if (tab === 'mine') {
      if (!me) return [];
      const { data, error } = await base().or(`creator_id.eq.${me},participants.cs.{${me}}`).limit(60);
      if (error) throw error;
      return data || [];
    }
    const c = this._center();
    let q = base().limit(80);
    if (c) q = q.gte('lat', c.lat - NEAR).lte('lat', c.lat + NEAR).gte('lng', c.lng - NEAR).lte('lng', c.lng + NEAR);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).filter(a => !['own', 'go'].includes(planKind(a, me)));   // los tuyos van en "Mis planes"
  }

  // Lista + caras + guardados, y se guarda en el teléfono
  async _fetchAll(tab) {
    const pm = this.getPM();
    const list = await withTimeout(this._fetch(tab));
    list.sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
    await this._loadPeople(pm, list);
    let saved = new Set();
    try { saved = await savedIds(list.map(a => a.id)); } catch (_) {}
    cacheSet(`plans:${tab}`, { list: list.slice(0, 60), saved: [...saved],
      people: peopleOf(pm, list.slice(0, 60).flatMap(a => [a.creator_id, ...(a.participants || [])])) });
    return { list, saved };
  }

  async _load() {
    const tab = this.tab, pm = this.getPM();
    let list = [], saved = new Set(), offline = false;
    try { ({ list, saved } = await this._fetchAll(tab)); }
    catch (e) { console.warn('[PLANES]', e.message || e); offline = netError(e); }
    if (!this.scr || tab !== this.tab) return;
    if (offline) {
      const c = cacheGet(`plans:${tab}`);
      this._waitOnline();
      if (!c) { this._paintOffline(); return; }
      restorePeople(pm, c.data.people);
      list = c.data.list || []; saved = new Set(c.data.saved || []);
    }
    this.list = list; this.saved = saved; this.offline = offline;
    if (!list.some(a => a.type === this.type)) this.type = 'all';
    this._paintDays(pm); this._paintTypes(pm); this._paint(true);
  }

  // Sin red y sin nada guardado: aviso grande
  _paintOffline() {
    this.list = [];
    this.scr.body.querySelector('.wp-pt-cal').innerHTML = '';
    this.scr.body.querySelector('.wp-pt-types').innerHTML = '';
    const box = this.scr.body.querySelector('.wp-pt-list');
    box.innerHTML = offlineNote(false);
    wave(box, '.wp-off-box');
  }

  _waitOnline() {
    if (this._unOnline) return;
    this._unOnline = whenOnline(() => { this._unOnline = null; if (this.scr) this._load(); });
  }

  async _loadPeople(pm, list) {
    if (!pm) return;
    pm._profCache = pm._profCache || new Map();
    const ids = [...new Set(list.flatMap(a => [a.creator_id, ...(a.participants || [])]))].filter(id => id && !pm._profCache.has(id)).slice(0, 120);
    if (!ids.length) return;
    try {
      const { data } = await getSupabase().from('profiles').select('id, name, username, avatar_url').in('id', ids);
      (data || []).forEach(p => pm._profCache.set(p.id, p));
    } catch (_) {}
  }

  // ── Pintar ──────────────────────────────────────────────────────────
  _shown() {
    return this.list.map((a, i) => [a, i]).filter(([a]) => (this.type === 'all' || a.type === this.type)
      && (this.day === 'all' || this.getPM()._phDayKey(a) === this.day));
  }

  _paintDays(pm) {
    const box = this.scr.body.querySelector('.wp-pt-cal');
    pm._phMountDays({ list: this.list }, box);
    this.day = 'all';
  }

  _paintTypes(pm) {
    const types = [...new Set(this.list.map(a => a.type).filter(t => TYPES[t]))];
    const box = this.scr.body.querySelector('.wp-pt-types');
    box.innerHTML = types.length > 1 ? `<div class="wp-pt-chips">${[['all', 'Todos'], ...types.map(t => [t, `${pm._planEmoji(t)} ${TYPES[t]}`])]
      .map(([k, t]) => `<button type="button" data-type="${k}"${k === this.type ? ' class="on"' : ''}>${t}</button>`).join('')}</div>` : '';
    const strip = box.firstElementChild;
    if (strip) addElastic(strip, 'x');
  }

  _paint(swap = false) {
    const pm = this.getPM(), me = window.wpApp?.currentUser?.id, c = this._center();
    const box = this.scr.body.querySelector('.wp-pt-list'), shown = this._shown();
    if (!shown.length) {
      const [t, s] = this.list.length ? ['No hay planes con ese filtro', 'Prueba con otro día o tipo'] : EMPTY[this.tab];
      box.innerHTML = `<div class="wp-pt-empty"><b>${t}</b><span>${s}</span></div>`;
    } else {
      const groups = new Map();
      shown.forEach(([a, i]) => { const k = pm._phDayKey(a); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([a, i]); });
      box.innerHTML = [...groups.values()].map(g => `<section class="wp-pt-day"><h3>${pm._phDayLabel(new Date(g[0][0].scheduled_at))}</h3>
        ${g.map(([a, i]) => cardHtml(pm, a, i, { me, saved: this.saved, photo: this._photo(a), km: c && a.lat ? pm._mpKm(c, a) : null })).join('')}</section>`).join('');
    }
    if (this.offline) box.insertAdjacentHTML('afterbegin', offlineNote(true));   // aviso: lo último que viste
    if (swap) wave(box, '.wp-off-bar, .wp-pt-day > h3, .wp-pt-card, .wp-pt-empty');   // entra en ola
  }

  _photo(a) {
    const p = (this.getPlaces?.() || []).find(x => String(x.place_id || x.id) === String(a.place_id));
    const u = p && ((p.photosUrls && p.photosUrls[0]) || p.photoUrl || p.photo_url);
    return u ? (photoSmall(u) || u) : '';
  }

  // ── Toques ──────────────────────────────────────────────────────────
  _click(e) {
    if (e.target.closest('[data-retry]')) { this.getPM()?._haptic?.('light'); this._load(); return; }
    const t = e.target.closest('[data-tab]');
    if (t) { this._pickTab(t.dataset.tab); return; }
    const ty = e.target.closest('[data-type]');
    if (ty) { this.type = ty.dataset.type; this.scr.body.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b === ty)); this._paint(true); return; }
    const d = e.target.closest('.wp-pt-cal [data-day]');
    if (d) { this._pickDay(d.dataset.day); return; }
    const s = e.target.closest('[data-save]');
    if (s) { this._save(s); return; }
    const card = e.target.closest('.wp-pt-card');
    if (card) this._openPlan(this.list[+card.dataset.i]);
  }

  _pickTab(tab) {
    if (!this.scr) return;
    this.tab = tab;
    this.scr.body.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    this.scr.body.querySelector('.wp-pt-list').innerHTML = skeletonHtml();
    this.getPM()?._haptic?.('light');
    this._load();
  }

  _pickDay(k) {
    this.day = k === this.day || k === 'all' ? 'all' : k;
    const box = this.scr.body.querySelector('.wp-pt-cal');
    let picked = null;
    box.querySelectorAll('.wp-ph4-d').forEach(b => { const on = b.dataset.day === this.day; b.classList.toggle('on', on); if (on) picked = b; });
    box.querySelector('.wp-ph4-all').hidden = this.day === 'all';
    this.getPM()._phPaintMonth(null, box, picked ? new Date(+picked.dataset.y, +picked.dataset.m, 1) : new Date());
    const strip = box.querySelector('.wp-ph4-strip');
    if (picked) strip.scrollTo({ left: picked.offsetLeft - (strip.clientWidth - picked.offsetWidth) / 2, behavior: 'smooth' });
    this.getPM()?._haptic?.('light');
    this._paint(true);
  }

  async _save(b) {
    const pm = this.getPM(), a = this.list[+b.closest('.wp-pt-card').dataset.i];
    if (!a) return;
    if (!window.wpApp?.currentUser) { window.wpApp?.authModal?.show?.(); return; }
    const on = !this.saved.has(a.id);
    on ? this.saved.add(a.id) : this.saved.delete(a.id);
    b.classList.toggle('on', on);
    pm?._haptic?.(on ? 'medium' : 'light');
    try { await setSaved(a.id, on); pm?._showToast(on ? 'Guardado' : 'Quitado de guardados'); }
    catch (err) { on ? this.saved.delete(a.id) : this.saved.add(a.id); b.classList.toggle('on', !on); pm?._showToast(err.message || 'No se pudo'); }
    if (this.tab === 'saved' && !on) this._load();
  }

  // Abrir el plan con la ficha "prestada" (sus ayudantes trabajan sobre this._place)
  _openPlan(a) {
    const pm = this.getPM(); if (!a || !pm) return;
    if (!window.wpApp?.currentUser) { window.wpApp?.authModal?.show?.(); return; }
    const p = (this.getPlaces?.() || []).find(x => String(x.place_id || x.id) === String(a.place_id));
    pm._place = p || { place_id: a.place_id, id: a.place_id, name: a.place_name, lat: a.lat, lng: a.lng };
    pm._plans = [a];
    const k = planKind(a, window.wpApp.currentUser.id), back = () => this.scr && this._load();
    if (k === 'own' || k === 'go') pm._openMyPlanSheet(a, { onClose: back });
    else pm._openPlanDetailSheet(a, { onClose: back });
  }
}
