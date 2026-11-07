// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here-detail.js
// Detalle de un plan dentro de "Planes aquí" (plans-here.js).
//  · Entrada: el encabezado de la tarjeta tocada crece hasta su lugar
//    en el detalle (FLIP: se mide antes y después y se anima la
//    diferencia) y las demás secciones suben en cascada.
//  · Pie: el botón grande del caso (Unirme / Aceptar + No puedo /
//    Avísame) y, si te invitaron, "No puedo" al lado.
//  · Atrás: el detalle se desvanece, vuelve la lista en el mismo punto
//    del scroll y la tarjeta late para que la encuentres.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph2-*)
// ════════════════════════════════════════════════════════════════════
import { addElastic } from '/src/components/place-plans/elastic.js';
import { pulse } from '/src/components/place-plans/pulse.js';

const SPRING = 'cubic-bezier(0.34, 1.25, 0.64, 1)';

export class PlansHereDetail {
  _phOpen(v, i, card) {
    const a = v.list[i]; if (!a) return;
    const vp = v.sheet.root.querySelector('.wp-st-vp');
    const list = v.sheet.body.querySelector('.wp-ph2-list'), det = v.sheet.body.querySelector('.wp-ph2-detail');
    const from = card.querySelector('.wp-ph2-row').getBoundingClientRect();
    v.at = i; v.scroll = vp.scrollTop;
    det.innerHTML = this._phDetailHtml(v, a);
    list.hidden = true; det.hidden = false; vp.scrollTop = 0;
    const inv = v.pending.includes(a);
    v.sheet.setTitle(`Plan de ${this._phName(a.creator_id)}${inv ? ' <i class="wp-st-pill">Invitación</i>' : ''}`);
    v.sheet.setTheme(inv ? 'invited' : 'explore');   // te invitaron → toque celeste
    this._phPaintFoot(v, a);
    addElastic(det.querySelector('.wp-mp-who'), 'x');
    this._haptic?.('light');
    // el encabezado viaja desde la tarjeta (elemento compartido)
    const head = det.querySelector('.wp-mp-card'), to = head.getBoundingClientRect();
    head.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, transformOrigin: '0 0' },
      { transform: 'none', transformOrigin: '0 0' },
    ], { duration: 420, easing: SPRING });
    det.classList.remove('enter'); void det.offsetWidth; det.classList.add('enter');
  }

  _phBack(v) {
    const vp = v.sheet.root.querySelector('.wp-st-vp');
    const list = v.sheet.body.querySelector('.wp-ph2-list'), det = v.sheet.body.querySelector('.wp-ph2-detail');
    const i = v.at; v.at = -1;
    det.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px)' }], { duration: 160, easing: 'ease-in' }).onfinish = () => {
      det.hidden = true; det.innerHTML = '';
      this._phPaintList(v);
      list.hidden = false; vp.scrollTop = v.scroll;
      v.sheet.setTitle('Planes aquí');
      v.sheet.setTheme('explore');
      v.sheet.foot.innerHTML = this._phFootList(v); v.sheet.relayout();
      pulse(list.querySelector(`[data-open="${i}"]`));
    };
  }

  _phDetailHtml(v, a) {
    const inv = v.pending.includes(a);
    return `
      ${inv ? `<span class="wp-ph2-tag big">Te invitó ${this._phName(a.creator_id)}</span>` : ''}
      ${this._mpCard(a)}
      ${this._mpSocial(a)}
      <div class="wp-mp-lbl">Quién va</div>
      <div class="wp-mp-who">${this._mpWho(a, false, v.me)}</div>
      <div class="wp-mp-grid">${this._mpTiles(a, false)}</div>
      ${this._planRouteHtml(a, { owner: false }) ? `<div class="wp-mp-route">${this._planRouteHtml(a, { owner: false })}</div>` : ''}
      ${this._planRulesHtml(a, 'wp-mp-rules')}
      ${a.note ? `<div class="wp-mp-note"><small>📝 Nota</small><p>${this._esc(a.note)}</p></div>` : ''}`;
  }

  // Pie del detalle: el botón grande del caso (+ "No puedo" si te invitaron)
  _phPaintFoot(v, a) {
    const inv = v.pending.includes(a), P = a.participants || [];
    const no = inv && !P.includes(v.me) ? '<button type="button" class="wp-ph2-act lg ghost" data-act="no">No puedo</button>' : '';
    v.sheet.foot.innerHTML = `<div class="wp-ph2-foot">${no}${this._phAction(v, a, 'lg')}</div>`;
    v.sheet.relayout();
  }
}
