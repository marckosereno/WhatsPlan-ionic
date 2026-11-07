// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here.js
// Hoja "Planes aquí" (los planes de otros en este lugar), en la misma
// hoja grande de "Tu plan" (openSheetPage). Dos niveles:
//  · Lista: mini calendario arriba (plans-here-days.js) y una tarjeta
//    blanca compacta por plan (emoji, nombre, horario, quién organiza,
//    caritas, cupos, cuenta regresiva), agrupadas por día. Etiqueta y
//    botón según el caso: Tuyo (Ver tu plan) · Vas (Ya vas) · Te invitó
//    (Aceptar) · de otros (Unirme / Avísame). Tuyos y "Vas" abren "Tu plan".
//    Hoja en tema "explore" (blanco neutro).
//  · Detalle: al tocar la tarjeta, su encabezado "crece" hasta su lugar
//    en el detalle (transición de elemento compartido) y lo demás entra
//    en cascada. Es lo mismo que ve quien ya va ("Tu plan"), con el
//    botón grande abajo. Atrás regresa a la lista, donde estaba.
//
// Mixin de PlaceModal2 (usa piezas de my-plan.js: _mpCard, _mpSocial,
// _mpWho, _mpTiles, _mpCountdown; el detalle vive en plans-here-detail.js).
// Estilos: /styles/plans-here.css
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';

const BELL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
const PLUS = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

export class PlansHere {
  _openPlansHereSheet() {
    const { me, mine, pending } = this._planGroups();
    // todos los planes del lugar (también los tuyos), en orden de fecha
    const list = [...(this._plans || [])].sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
    const v = { me, mine, pending, list, day: 'all', at: -1, scroll: 0 };
    v.sheet = openSheetPage({
      title: 'Planes aquí', theme: 'explore',
      html: '<div class="wp-ph2-list"><div class="wp-st-days wp-ph2-days"></div><div class="wp-ph2-groups"></div></div><div class="wp-ph2-detail wp-mp" hidden></div>',
      foot: this._phFootList(v), onBack: () => (v.at >= 0 ? (this._phBack(v), true) : false),
    });
    this._phMountDays(v, v.sheet.body.querySelector('.wp-ph2-days'));
    this._phPaintList(v);
    v.sheet.root.addEventListener('click', (e) => this._phClick(v, e));
  }

  // ── Lista ────────────────────────────────────────────────────────────
  _phPaintList(v, swap = false) {
    const box = v.sheet.body.querySelector('.wp-ph2-groups');
    const groups = this._phGroups(v);
    box.innerHTML = groups.length ? groups.map(g => `<div class="wp-ph2-day-h">${g.label}</div>${g.items.map(([a, i]) => this._phCard(v, a, i)).join('')}`).join('')
      : `<p class="wp-st-empty">${v.list.length ? 'No hay planes ese día' : 'Por ahora no hay planes aquí'}</p>`;
    if (swap) { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); }
  }

  _phCard(v, a, i) {
    const P = a.participants || [], max = a.max_participants || 0, left = Math.max(0, max - P.length);
    const inv = v.pending.includes(a), end = a.ends_at ? ` → ${this._hhmm(new Date(a.ends_at))}` : '';
    const own = a.creator_id === v.me, go = !own && P.includes(v.me);
    const tag = own ? '<span class="wp-ph2-tag own">Tuyo</span>' : go ? '<span class="wp-ph2-tag go">Vas</span>'
      : inv ? `<span class="wp-ph2-tag">Te invitó ${this._phName(a.creator_id)}</span>` : '';
    const cupo = this._planFull(a) ? 'Completo' : max ? `${P.length} de ${max} · queda${left === 1 ? '' : 'n'} ${left}` : `Van ${P.length}`;
    return `<div class="wp-ph2-card${own ? ' own' : go ? ' go' : inv ? ' inv' : ''}" data-open="${i}" role="button" tabindex="0">
        ${tag}
        <div class="wp-ph2-row">
          <span class="wp-mp-ic">${this._planEmoji(a.type)}</span>
          <span class="wp-ph2-t"><b>${this._esc(a.title)}</b><small>${this._esc(this._planWhen(a.scheduled_at))}${end}</small><small>${own ? 'Organizas tú' : `Organiza ${this._phName(a.creator_id)}`}</small></span>
          ${this._mpCountdown(a)}
        </div>
        <div class="wp-ph2-bot">
          <span class="wp-mp-faces">${P.slice(0, 3).map(id => this._planFace(id)).join('')}</span>
          <span class="wp-ph2-n">${cupo}</span>
          ${this._phAction(v, a, 'sm')}
        </div>
      </div>`;
  }

  // El botón que toca según el caso (en la lista chico, en el detalle grande)
  _phAction(v, a, size = '') {
    const P = a.participants || [], inv = v.pending.includes(a), full = this._planFull(a);
    const waiting = (a.waitlist || []).includes(v.me);
    const b = (act, txt, cls = '') => `<button type="button" class="wp-ph2-act ${size} ${cls}" data-act="${act}">${txt}</button>`;
    if (a.creator_id === v.me) return b('mine', 'Ver tu plan', 'soft');
    if (P.includes(v.me)) return b('mine', 'Ya vas', 'soft go');
    if (!full) return b('yes', inv ? 'Aceptar' : `${PLUS}<span>Unirme</span>`);
    return waiting ? b('wl-off', 'Te avisaremos', 'soft on') : b('wl-on', `${BELL}<span>Avísame</span>`, 'soft');
  }

  _phFootList(v) {
    return v.mine ? '' : `<button type="button" class="wp-ph2-new" data-act="new">${PLUS}<span>Planear otra visita</span></button>`;
  }

  _phMine(v, a) {
    if (!a) return;
    v.sheet.close();
    setTimeout(() => this._openMyPlanSheet(a), 360);
  }

  _phName(id) {
    const p = this._profCache?.get(id) || {};
    return this._esc(String(p.name || (p.username ? '@' + p.username : 'Alguien')).split(' ')[0]);
  }

  // ── Clics ────────────────────────────────────────────────────────────
  _phClick(v, e) {
    const day = e.target.closest('.wp-ph2-days [data-day]');
    if (day) { this._phPickDay(v, day.dataset.day); return; }
    const act = e.target.closest('[data-act]');
    if (act) { e.stopPropagation(); this._phDo(v, act); return; }
    const card = e.target.closest('[data-open]');
    if (!card) return;
    // los tuyos y a los que ya vas se abren en "Tu plan" / "Vas a ir"
    if (card.matches('.own, .go')) this._phMine(v, v.list[+card.dataset.open]);
    else this._phOpen(v, +card.dataset.open, card);
  }

  async _phDo(v, b) {
    const a = v.list[+(b.closest('[data-open]')?.dataset.open ?? v.at)], act = b.dataset.act;
    if (act === 'new') { v.sheet.close(); setTimeout(() => this._openPlanSheet(), 140); return; }
    if (act === 'mine') { this._phMine(v, a); return; }
    if (!a || !act) return;
    b.disabled = true;
    if (act === 'yes' || act === 'no') {
      const yes = act === 'yes';
      const ok = await this._planRpc('respond_plan', { p_activity: a.id, p_accept: yes }, yes ? `¡Vas! ${this._planWhen(a.scheduled_at)}` : 'Le avisamos que no puedes');
      if (ok) { v.sheet.close(); return; }
    } else {
      const on = act === 'wl-on';
      const ok = await this._planRpc('plan_waitlist', { p_activity: a.id, p_on: on }, on ? 'Listo · te avisamos si se libera un cupo' : 'Ya no estás en la lista de espera');
      if (ok) {
        a.waitlist = on ? [...(a.waitlist || []), v.me] : (a.waitlist || []).filter(id => id !== v.me);
        v.at >= 0 ? this._phPaintFoot(v, a) : this._phPaintList(v);
        return;
      }
    }
    b.disabled = false;
  }
}
