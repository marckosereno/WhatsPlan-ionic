// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here.js
// Hoja "Planes aquí" (todos los planes del lugar, también los tuyos) en
// la hoja grande (openSheetPage, tema "explore" = blanco neutro).
//  · Arriba el mini calendario (plans-here-days.js).
//  · Abajo una línea de tiempo por día: la hora grande a la izquierda
//    sobre un riel con un punto, y a la derecha el plan (emoji, nombre,
//    una línea de contexto y el racimo de caras). El punto dice de quién
//    es sin etiquetas: azul lleno = tuyo · menta = vas · aro azul = te
//    invitaron · gris = de otros.
//  · Tocar un plan lo abre ahí mismo (acordeón, uno a la vez) con sus
//    datos y el botón del caso: plans-here-open.js.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph2-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';

const PLUS = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

export class PlansHere {
  _openPlansHereSheet() {
    const { me, mine, pending } = this._planGroups();
    const list = [...(this._plans || [])].sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
    const v = { me, mine, pending, list, day: 'all', open: -1 };
    v.sheet = openSheetPage({
      title: 'Planes aquí', theme: 'explore',
      html: '<div class="wp-ph2-list"><div class="wp-st-days wp-ph2-days"></div><div class="wp-ph2-groups"></div></div>',
      foot: v.mine ? '' : `<button type="button" class="wp-ph2-new" data-act="new">${PLUS}<span>Planear otra visita</span></button>`,
    });
    this._phMountDays(v, v.sheet.body.querySelector('.wp-ph2-days'));
    this._phPaintList(v);
    v.sheet.root.addEventListener('click', (e) => this._phClick(v, e));
  }

  _phPaintList(v, swap = false) {
    const box = v.sheet.body.querySelector('.wp-ph2-groups');
    const groups = this._phGroups(v);
    v.open = -1;
    box.innerHTML = groups.length
      ? groups.map(g => `<section class="wp-ph2-day"><h3>${g.label}</h3>${g.items.map(([a, i]) => this._phItem(v, a, i)).join('')}</section>`).join('')
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
    const k = this._phKind(v, a), [hh, ap] = this._pwSplit(new Date(a.scheduled_at));
    const P = a.participants || [], extra = Math.max(0, P.length - 3);
    return `<div class="wp-ph2-it ${k}" data-open="${i}">
        <div class="wp-ph2-time"><b>${hh}</b><small>${ap}</small></div>
        <div class="wp-ph2-card">
          <div class="wp-ph2-head" role="button" tabindex="0" aria-expanded="false">
            <span class="wp-ph2-emo">${this._planEmoji(a.type)}</span>
            <span class="wp-ph2-t"><b>${this._esc(a.title)}</b><small>${this._phLine(v, a, k)}</small></span>
            <span class="wp-ph2-cluster">${P.slice(0, 3).map(id => this._planFace(id)).join('')}${extra ? `<em>+${extra}</em>` : ''}</span>
          </div>
          <div class="wp-ph2-more" hidden></div>
        </div>
      </div>`;
  }

  // Una sola línea que dice lo importante para ti
  _phLine(v, a, k) {
    const now = Date.now(), live = new Date(a.scheduled_at) <= now && (!a.ends_at || now < new Date(a.ends_at));
    const who = this._phName(a.creator_id);
    const txt = k === 'own' ? 'Tú organizas' : k === 'go' ? `Vas con ${who}` : k === 'inv' ? `<span class="wp-ph2-inv">${who} te invitó</span>`
      : `Organiza ${who}`;
    // corta: los cupos se ven al abrir (aquí solo si ya está lleno)
    return `${live ? '<i class="wp-ph2-live"></i>Ahora · ' : ''}${txt}${k === 'other' && this._planFull(a) ? ' · completo' : ''}`;
  }

  _phName(id) {
    const p = this._profCache?.get(id) || {};
    return this._esc(String(p.name || (p.username ? '@' + p.username : 'Alguien')).split(' ')[0]);
  }

  _phClick(v, e) {
    const day = e.target.closest('.wp-ph2-days [data-day]');
    if (day) { this._phPickDay(v, day.dataset.day); return; }
    const act = e.target.closest('[data-act]');
    if (act) { this._phDo(v, act); return; }
    const head = e.target.closest('.wp-ph2-head');
    if (head) this._phToggle(v, +head.closest('[data-open]').dataset.open);
  }
}
