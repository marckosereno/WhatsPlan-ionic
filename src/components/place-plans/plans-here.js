// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here.js
// Hoja "Planes aquí" (todos los planes del lugar, también los tuyos) en
// la hoja grande (openSheetPage, tema "explore" = blanco neutro).
//  · Arriba el calendario de 2 semanas (plans-here-days.js).
//  · Abajo una tarjeta por día: la fecha grande a la izquierda (mes,
//    número, Hoy/Mañana/día) y a la derecha los planes de ese día
//    apilados con líneas finas: emoji en cuadrito, nombre, hora y quién
//    organiza, y al final un ícono chico de estado (tuyo → flecha, vas →
//    palomita verde, te invitaron → sobre azul, de otros → sus caras).
//  · Tocar un plan lo abre ahí mismo (acordeón): plans-here-open.js.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph2-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';

const ICON = {
  arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg width="13" height="13" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mail: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
};
const PLUS = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

export class PlansHere {
  _openPlansHereSheet() {
    const { me, mine, pending } = this._planGroups();
    const list = [...(this._plans || [])].sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
    const v = { me, mine, pending, list, day: 'all', open: -1 };
    v.sheet = openSheetPage({
      title: 'Planes aquí', theme: 'explore',
      html: '<div class="wp-ph2-list"><div class="wp-ph3-cal"></div><div class="wp-ph2-groups"></div></div>',
      foot: v.mine ? '' : `<button type="button" class="wp-ph2-new" data-act="new">${PLUS}<span>Planear otra visita</span></button>`,
    });
    this._phMountDays(v, v.sheet.body.querySelector('.wp-ph3-cal'));
    this._phPaintList(v);
    v.sheet.root.addEventListener('click', (e) => this._phClick(v, e));
  }

  _phPaintList(v, swap = false) {
    const box = v.sheet.body.querySelector('.wp-ph2-groups');
    const groups = this._phGroups(v);
    v.open = -1;
    box.innerHTML = groups.length
      ? groups.map(g => `<section class="wp-ph3-day">
          <div class="wp-ph3-date"><small>${this._phMonth(g.at)}</small><b>${new Date(g.at).getDate()}</b><i>${this._phDayLabel(g.at)}</i></div>
          <div class="wp-ph3-rows">${g.items.map(([a, i]) => this._phItem(v, a, i)).join('')}</div></section>`).join('')
      : `<p class="wp-st-empty">${v.list.length ? 'No hay planes ese día' : 'Por ahora no hay planes aquí'}</p>`;
    if (swap) { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); }
  }

  // De quién es el plan (para el punto del riel y la línea de contexto)
  _phKind(v, a) {
    if (a.creator_id === v.me) return 'own';
    if ((a.participants || []).includes(v.me)) return 'go';
    return v.pending.includes(a) ? 'inv' : 'other';
  }

  _phItem(v, a, i) {
    const k = this._phKind(v, a);
    return `<div class="wp-ph2-it ${k}" data-open="${i}">
        <div class="wp-ph2-head" role="button" tabindex="0" aria-expanded="false">
          <span class="wp-ph2-emo">${this._planEmoji(a.type)}</span>
          <span class="wp-ph2-t"><b>${this._esc(a.title)}</b><small>${this._phLine(v, a, k)}</small></span>
          ${this._phEnd(v, a, k)}
        </div>
        <div class="wp-ph2-more" hidden></div>
      </div>`;
  }

  // Ícono chico al final de la fila: dice el estado sin palabras
  _phEnd(v, a, k) {
    if (k === 'own') return `<span class="wp-ph3-end own" aria-label="Tu plan">${ICON.arrow}</span>`;
    if (k === 'go') return `<span class="wp-ph3-end go" aria-label="Vas">${ICON.check}</span>`;
    if (k === 'inv') return `<span class="wp-ph3-end inv" aria-label="Te invitaron">${ICON.mail}</span>`;
    const P = a.participants || [], extra = Math.max(0, P.length - 2);
    return `<span class="wp-ph2-cluster">${P.slice(0, 2).map(id => this._planFace(id)).join('')}${extra ? `<em>+${extra}</em>` : ''}</span>`;
  }

  // Una sola línea que dice lo importante para ti
  _phLine(v, a, k) {
    const now = Date.now(), live = new Date(a.scheduled_at) <= now && (!a.ends_at || now < new Date(a.ends_at));
    const who = this._phName(a.creator_id);
    const txt = k === 'own' ? 'tú organizas' : k === 'go' ? `vas con ${who}` : k === 'inv' ? `<span class="wp-ph2-inv">${who} te invitó</span>`
      : `${who}${this._planFull(a) ? ' · completo' : ''}`;
    const time = live ? '<i class="wp-ph2-live"></i>Ahora' : this._hhmm(new Date(a.scheduled_at));
    return `${time} · ${txt}`;
  }

  _phName(id) {
    const p = this._profCache?.get(id) || {};
    return this._esc(String(p.name || (p.username ? '@' + p.username : 'Alguien')).split(' ')[0]);
  }

  _phClick(v, e) {
    const day = e.target.closest('.wp-ph3-cal [data-day]');
    if (day) { this._phPickDay(v, day.dataset.day); return; }
    const act = e.target.closest('[data-act]');
    if (act) { this._phDo(v, act); return; }
    const head = e.target.closest('.wp-ph2-head');
    if (head) this._phToggle(v, +head.closest('[data-open]').dataset.open);
  }
}
