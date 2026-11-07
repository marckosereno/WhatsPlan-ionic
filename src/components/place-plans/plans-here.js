// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here.js
// Hoja "Planes aquí" (todos los planes del lugar, también los tuyos) en
// la hoja grande (openSheetPage, tema "explore" = blanco neutro).
//  · Arriba el calendario en tira (plans-here-days.js).
//  · Abajo, agrupados por día, una tarjeta por plan:
//      racimo (la foto del lugar al frente y dos tarjetitas pastel
//      giradas detrás, con el emoji del plan como sticker; sin foto, el
//      emoji con borde blanco sobre pastel) · nombre · dos líneas de
//      descripción · categoría en pastel + tu estado (tú organizas, vas,
//      te invitaron, cuántos van) · a la derecha guardar y la hora.
//  · Guardar (plan-saves.js) lo deja en tu perfil para ir después.
//  · Tocar un plan lo abre ahí mismo (acordeón): plans-here-open.js.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph4-*, .wp-ph2-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { savedIds, setSaved } from '/src/components/place-plans/plan-saves.js';
import { photoSmall } from '/src/utils/photo-url.js';

const PLUS = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const MARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M6 4h12v16l-6-4-6 4z"/></svg>';
// Pastel por tipo de plan: [fondo, texto] (los del perfil)
const PASTEL = {
  food: ['#fed7aa', '#9a3412', 'Comida'], drinks: ['#fde68a', '#854d0e', 'Café y bebidas'], hangout: ['#ddd6fe', '#5b21b6', 'Pasar el rato'],
  explore: ['#bbf7d0', '#166534', 'Explorar'], shop: ['#fecdd3', '#9f1239', 'Compras'], music: ['#bfdbfe', '#1e40af', 'Música'],
  sport: ['#bbf7d0', '#166534', 'Deporte'], photo: ['#fecdd3', '#9f1239', 'Fotos'], spa: ['#ddd6fe', '#5b21b6', 'Relax'],
};
const BACKS = ['#bfdbfe', '#fde68a', '#ddd6fe', '#fecdd3', '#bbf7d0', '#fed7aa'];

export class PlansHere {
  _openPlansHereSheet() {
    const { me, mine, pending } = this._planGroups();
    const list = [...(this._plans || [])].sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
    const p = this._place || {};
    const photo = photoSmall((p.photosUrls && p.photosUrls[0]) || p.photoUrl || p.photo_url || '') || '';
    const v = { me, mine, pending, list, day: 'all', open: -1, saved: new Set(), photo };
    v.sheet = openSheetPage({
      title: 'Planes aquí', theme: 'explore',
      html: '<div class="wp-ph2-list"><div class="wp-ph4-cal"></div><div class="wp-ph2-groups"></div></div>',
      foot: v.mine ? '' : `<button type="button" class="wp-ph2-new" data-act="new">${PLUS}<span>Planear otra visita</span></button>`,
    });
    this._phMountDays(v, v.sheet.body.querySelector('.wp-ph4-cal'));
    this._phPaintList(v);
    v.sheet.root.addEventListener('click', (e) => this._phClick(v, e));
    savedIds(list.map(a => a.id)).then(s => { v.saved = s; this._phPaintSaves(v); });
  }

  _phPaintList(v, swap = false) {
    const box = v.sheet.body.querySelector('.wp-ph2-groups');
    const groups = this._phGroups(v);
    v.open = -1;
    box.innerHTML = groups.length
      ? groups.map(g => `<section class="wp-ph4-day"><h3>${this._phDayLabel(g.at)}</h3>${g.items.map(([a, i]) => this._phItem(v, a, i)).join('')}</section>`).join('')
      : `<p class="wp-st-empty">${v.list.length ? 'No hay planes ese día' : 'Por ahora no hay planes aquí'}</p>`;
    this._phPaintSaves(v);
    if (swap) { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); }
  }

  // De quién es el plan
  _phKind(v, a) {
    if (a.creator_id === v.me) return 'own';
    if ((a.participants || []).includes(v.me)) return 'go';
    return v.pending.includes(a) ? 'inv' : 'other';
  }

  _phItem(v, a, i) {
    const k = this._phKind(v, a), [bg, fg, cat] = PASTEL[a.type] || PASTEL.hangout;
    const now = Date.now(), live = new Date(a.scheduled_at) <= now && (!a.ends_at || now < new Date(a.ends_at));
    return `<div class="wp-ph2-it ${k}" data-open="${i}">
        <div class="wp-ph2-head" role="button" tabindex="0" aria-expanded="false">
          ${this._phThumb(v, a, i, bg)}
          <span class="wp-ph4-txt">
            <b>${this._esc(a.title)}</b>
            <small>${this._esc(this._phDesc(a))}</small>
            <span class="wp-ph4-meta"><i class="wp-ph4-cat" style="--bg:${bg};--fg:${fg}">${cat}</i>${this._phState(v, a, k)}</span>
          </span>
          <span class="wp-ph4-side">
            <button type="button" class="wp-ph4-save" data-act="save" aria-label="Guardar">${MARK}</button>
            <small class="${live ? 'live' : ''}">${live ? '<i></i>Ahora' : this._hhmm(new Date(a.scheduled_at))}</small>
          </span>
        </div>
        <div class="wp-ph2-more" hidden></div>
      </div>`;
  }

  // Racimo: foto del lugar al frente (o pastel), dos tarjetitas detrás y el emoji como sticker
  _phThumb(v, a, i, bg) {
    const b1 = BACKS[i % BACKS.length], b2 = BACKS[(i + 3) % BACKS.length];
    const front = v.photo ? `<span class="ph" style="background-image:url('${this._esc(v.photo)}')"></span>` : `<span class="ph none" style="--bg:${bg}"></span>`;
    return `<span class="wp-ph4-thumb"><i style="--bg:${b1}"></i><i style="--bg:${b2}"></i>${front}<em>${this._planEmoji(a.type)}</em></span>`;
  }

  // Dos líneas: la nota si hay; si no, hasta qué hora, la ruta y quién
  // organiza (la hora de inicio ya va a la derecha)
  _phDesc(a) {
    if (a.note) return a.note;
    const bits = [a.ends_at ? `Hasta las ${this._hhmm(new Date(a.ends_at))}` : '',
      Array.isArray(a.stops) && a.stops.length ? `${a.stops.length + 1} paradas` : '',
      a.creator_id === window.wpApp?.currentUser?.id ? '' : `organiza ${this._phName(a.creator_id, false)}`];
    return bits.filter(Boolean).join(' · ');
  }

  _phState(v, a, k) {
    const P = a.participants || [], max = a.max_participants || 0;
    if (k === 'own') return '<span class="wp-ph4-st own">Tú organizas</span>';
    if (k === 'go') return '<span class="wp-ph4-st go">Vas</span>';
    if (k === 'inv') return `<span class="wp-ph4-st inv">${this._phName(a.creator_id)} te invitó</span>`;
    return `<span class="wp-ph4-st">${this._planFull(a) ? 'Completo' : max ? `${P.length} de ${max} van` : `Van ${P.length}`}</span>`;
  }

  _phName(id, esc = true) {
    const p = this._profCache?.get(id) || {};
    const n = String(p.name || (p.username ? '@' + p.username : 'Alguien')).split(' ')[0];
    return esc ? this._esc(n) : n;
  }

  _phPaintSaves(v) {
    v.sheet.body.querySelectorAll('.wp-ph2-it').forEach(it => {
      const on = v.saved.has(v.list[+it.dataset.open]?.id), b = it.querySelector('.wp-ph4-save');
      b.classList.toggle('on', on); b.setAttribute('aria-label', on ? 'Quitar de guardados' : 'Guardar');
    });
  }

  async _phSave(v, b) {
    const a = v.list[+b.closest('[data-open]').dataset.open]; if (!a) return;
    const on = !v.saved.has(a.id);
    on ? v.saved.add(a.id) : v.saved.delete(a.id);
    this._phPaintSaves(v); this._haptic?.('light');
    try { await setSaved(a.id, on); this._showToast(on ? 'Guardado · lo verás en tu perfil' : 'Quitado de guardados'); }
    catch (e) { on ? v.saved.delete(a.id) : v.saved.add(a.id); this._phPaintSaves(v); this._showToast(e.message); }
  }

  _phClick(v, e) {
    const day = e.target.closest('.wp-ph4-cal [data-day]');
    if (day) { this._phPickDay(v, day.dataset.day); return; }
    const act = e.target.closest('[data-act]');
    if (act) { act.dataset.act === 'save' ? this._phSave(v, act) : this._phDo(v, act); return; }
    const head = e.target.closest('.wp-ph2-head');
    if (head) this._phToggle(v, +head.closest('[data-open]').dataset.open);
  }
}
