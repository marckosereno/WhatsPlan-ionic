// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here.js
// Hoja "Planes aquí" (todos los planes del lugar, también los tuyos) en
// la hoja grande (openSheetPage, tema "explore" = blanco neutro).
//  · Arriba el calendario en tira (plans-here-days.js).
//  · Abajo, agrupados por día, una tarjeta por plan:
//      racimo en abanico (hasta 3 fotos del lugar con borde blanco; las
//      que falten, tarjetitas pastel del color del tipo de plan; sin
//      fotos, el emoji al frente) con una insignia encima con la hora
//      (o "Ahora" si ya empezó) · nombre · descripción · caras de los
//      que van + tu estado · guardar centrado a la derecha.
//  · Guardar (plan-saves.js) lo deja en tu perfil para ir después.
//  · Tocar un plan lo abre completo en la misma hoja, con atrás a todos
//    los planes: plans-here-detail.js.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph4-*, .wp-ph2-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { savedIds, setSaved } from '/src/components/place-plans/plan-saves.js';
import { photoSmall } from '/src/utils/photo-url.js';

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
    const all = [...(p.photosUrls || p.photos_urls || []), p.photoUrl || p.photo_url].filter(Boolean);
    const photos = [...new Set(all)].slice(0, 3).map(u => photoSmall(u) || u);
    const v = { me, mine, pending, list, day: 'all', at: -1, scroll: 0, saved: new Set(), photos };
    v.sheet = openSheetPage({
      title: 'Planes aquí', theme: 'explore',
      html: '<div class="wp-ph2-list"><div class="wp-ph4-cal"></div><div class="wp-ph2-groups"></div></div><div class="wp-ph2-detail wp-mp" hidden></div>',
      foot: this._phFootList(v), onBack: () => (v.at >= 0 ? (this._phBack(v), true) : false),
    });
    this._phMountDays(v, v.sheet.body.querySelector('.wp-ph4-cal'));
    this._phPaintList(v);
    v.sheet.root.addEventListener('click', (e) => this._phClick(v, e));
    savedIds(list.map(a => a.id)).then(s => { v.saved = s; this._phPaintSaves(v); });
  }

  _phPaintList(v, swap = false) {
    const box = v.sheet.body.querySelector('.wp-ph2-groups');
    const groups = this._phGroups(v);
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
    const k = this._phKind(v, a), P = a.participants || [], extra = Math.max(0, P.length - 3);
    return `<div class="wp-ph2-it ${k}" data-open="${i}" role="button" tabindex="0">
        ${this._phThumb(v, a, i)}
        <span class="wp-ph4-txt">
          <b>${this._esc(a.title)}</b>
          <small>${this._esc(this._phDesc(a))}</small>
          <span class="wp-ph4-meta"><span class="wp-ph4-faces">${P.slice(0, 3).map(id => this._planFace(id)).join('')}${extra ? `<em>+${extra}</em>` : ''}</span>${this._phState(v, a, k)}</span>
        </span>
        <button type="button" class="wp-ph4-save" data-act="save" aria-label="Guardar">${MARK}</button>
      </div>`;
  }

  // Racimo en abanico + insignia con la hora o el estado
  _phThumb(v, a, i) {
    const [bg] = PASTEL[a.type] || PASTEL.hangout;
    const backs = [bg, BACKS[(i + 2) % BACKS.length]];
    // c2 = al frente (foto 1), c1 y c0 detrás (fotos 2 y 3, o pastel)
    const cards = [2, 1, 0].map(n => {
      const ph = v.photos[n];
      if (ph) return `<i class="c${2 - n}" style="background-image:url('${this._esc(ph)}')"></i>`;
      return `<i class="c${2 - n} pastel" style="--bg:${backs[n % 2]}">${n === 0 ? this._planEmoji(a.type) : ''}</i>`;
    }).join('');
    const now = Date.now(), live = new Date(a.scheduled_at) <= now && (!a.ends_at || now < new Date(a.ends_at));
    const badge = live ? '<b class="live"><i></i>Ahora</b>' : `<b>${this._hhmm(new Date(a.scheduled_at))}</b>`;
    return `<span class="wp-ph4-thumb">${cards}${badge}</span>`;
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
    const a = v.at >= 0 ? v.list[v.at] : null;
    if (a) v.sheet.setRight(this._phSaveTop(v, a));
    v.sheet.body.querySelectorAll('.wp-ph2-it').forEach(it => {
      const on = v.saved.has(v.list[+it.dataset.open]?.id), b = it.querySelector('.wp-ph4-save');
      b.classList.toggle('on', on); b.setAttribute('aria-label', on ? 'Quitar de guardados' : 'Guardar');
    });
  }

  async _phSave(v, b) {
    const a = b.dataset.act === 'save-top' ? v.list[v.at] : v.list[+b.closest('[data-open]').dataset.open]; if (!a) return;
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
    if (act) { /^save/.test(act.dataset.act) ? this._phSave(v, act) : this._phDo(v, act); return; }
    if (v.at >= 0) { this._phDetailClick(v, e); return; }
    const row = e.target.closest('.wp-ph2-it');
    if (row && v.at < 0) this._phOpen(v, +row.dataset.open, row);
  }
}
