// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here-detail.js
// Plan completo dentro de "Planes aquí" (plans-here.js), en la misma
// hoja grande: al tocar un plan de otros, la lista se va y entra el plan
// con todo, con las mismas piezas de "Tu plan" (_mpBody: tira de
// lugares, tarjeta, datos, resumen IA, quién va, ruta). La foto viaja
// desde el racimo tocado (FLIP) y lo demás sube en cascada. Pie: el botón del caso (Unirme · Aceptar + No
// puedo · Avísame). Atrás regresa a todos los planes, donde estabas.
// Los planes tuyos o a los que vas abren "Tu plan" / "Vas a ir" (con
// atrás de vuelta aquí).
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph2-*) y
// las piezas de "Tu plan" (my-plan.css, .wp-mp-*)
// ════════════════════════════════════════════════════════════════════
import { pulse } from '/src/components/place-plans/pulse.js';

const SPRING = 'cubic-bezier(0.34, 1.25, 0.64, 1)';
const PLUS = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const BELL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

export class PlansHereDetail {
  _phOpen(v, i, row) {
    const a = v.list[i]; if (!a) return;
    const k = this._phKind(v, a);
    if (k === 'own' || k === 'go') {   // lo tuyo se ve (y se edita) en "Tu plan"
      v.sheet.close();
      setTimeout(() => this._openMyPlanSheet(a, { onBack: () => this._openPlansHereSheet() }), 360);
      return;
    }
    const vp = v.sheet.root.querySelector('.wp-st-vp');
    const list = v.sheet.body.querySelector('.wp-ph2-list'), det = v.sheet.body.querySelector('.wp-ph2-detail');
    const from = row?.querySelector('.wp-ph4-thumb')?.getBoundingClientRect();   // el racimo tocado (sin él: entra sin viaje)
    v.at = i; v.scroll = vp.scrollTop;
    const stops = this._mpStops(a);
    det.innerHTML = this._mpBody(a, { owner: false, me: v.me, stops, others: false });
    v.ctx = { a, me: v.me, owner: false, root: det, stops, close: () => v.sheet.close() };
    this._mpLoadPhotos(v.ctx);
    list.hidden = true; det.hidden = false; vp.scrollTop = 0;
    v.sheet.setTitle(`Plan de ${this._phName(a.creator_id)}`);
    v.sheet.setTheme(k === 'inv' ? 'invited' : 'explore');
    v.sheet.setRight(this._phSaveTop(v, a));
    this._phPaintFoot(v, a);
    this._mpWire(det);
    this._haptic?.('light');
    // el encabezado sale del racimo tocado
    const head = det.querySelector('.wp-mp-hero-ph'), to = head.getBoundingClientRect();
    if (from) head.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, transformOrigin: '0 0', opacity: 0.6 },
      { transform: 'none', transformOrigin: '0 0', opacity: 1 },
    ], { duration: 440, easing: SPRING });
    det.classList.remove('enter'); void det.offsetWidth; det.classList.add('enter');
  }

  // Botones de las piezas de "Tu plan" dentro del plan abierto (elegir
  // lugar, más info, resumen, ver ruta)
  _phDetailClick(v, e) {
    if (v.at >= 0 && v.ctx && e.target.closest('.wp-ph2-detail [data-a]')) this._mpClick(v.ctx, e);
  }

  _phBack(v) {
    const vp = v.sheet.root.querySelector('.wp-st-vp');
    const list = v.sheet.body.querySelector('.wp-ph2-list'), det = v.sheet.body.querySelector('.wp-ph2-detail');
    const i = v.at; v.at = -1;
    det.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px)' }], { duration: 160, easing: 'ease-in' }).onfinish = () => {
      det.hidden = true; det.innerHTML = '';
      list.hidden = false; vp.scrollTop = v.scroll;
      v.sheet.setTitle('Planes aquí');
      v.sheet.setTheme('explore');
      v.sheet.setRight('');
      v.sheet.foot.innerHTML = this._phFootList(v); v.sheet.relayout();
      pulse(list.querySelector(`.wp-ph2-it[data-open="${i}"]`));
    };
  }

  // Guardar, redondo como el botón de atrás: contorno + relleno con el
  // degradado que se descubre de abajo hacia arriba (my-plan.css .wp-st-save)
  _phSaveTop(v, a) {
    const on = v.saved.has(a.id), d = 'M6.5 4.5h11v15.5l-5.5-3.8-5.5 3.8z';
    return `<button type="button" class="wp-st-back wp-st-save${on ? ' on' : ''}" data-act="save-top" data-nopulse aria-label="${on ? 'Quitar de guardados' : 'Guardar'}">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="wpSaveG" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7dd3fc"/><stop offset="0.45" stop-color="#38bdf8"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
        <path class="f" d="${d}" fill="url(#wpSaveG)"/><path class="o" d="${d}" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/></svg></button>`;
  }

  // Cambia el botón de arriba sin volver a dibujarlo (para que se anime);
  // el saltito y el aro solo cuando lo tocaste tú
  _phSaveState(b, on, user) {
    if (b.classList.contains('on') === on) return;
    b.classList.toggle('on', on);
    b.setAttribute('aria-label', on ? 'Quitar de guardados' : 'Guardar');
    if (!user || !on) return;
    b.classList.remove('burst'); void b.offsetWidth; b.classList.add('burst');
    setTimeout(() => b.classList.remove('burst'), 650);
  }

  _phFootList(v) {
    return v.mine ? '' : `<button type="button" class="wp-ph2-new" data-act="new">${PLUS}<span>Planear otra visita</span></button>`;
  }

  // Pie del plan abierto: el botón del caso (+ "No puedo" si te invitaron)
  _phPaintFoot(v, a) {
    const k = this._phKind(v, a), full = this._planFull(a), waiting = (a.waitlist || []).includes(v.me);
    const no = k === 'inv' ? '<button type="button" class="wp-ph2-btn ghost" data-act="no">No puedo</button>' : '';
    const main = !full ? `<button type="button" class="wp-ph2-btn" data-act="yes">${k === 'inv' ? 'Aceptar' : `${PLUS}<span>Unirme</span>`}</button>`
      : waiting ? '<button type="button" class="wp-ph2-btn soft on" data-act="wl-off">Te avisaremos si se libera un cupo</button>'
        : `<button type="button" class="wp-ph2-btn soft" data-act="wl-on">${BELL}<span>Avísame si se libera un cupo</span></button>`;
    v.sheet.foot.innerHTML = `${!full ? this._phWhole(a) : ''}<div class="wp-ph2-acts">${no}${main}</div>`;
    v.sheet.relayout();
  }

  // Con paradas, antes de unirte: te unes a la salida completa (los cupos
  // son del plan, no de cada parada)
  _phWhole(a) {
    const n = 1 + (Array.isArray(a.stops) ? a.stops.length : 0);
    if (n < 2) return '';
    const t0 = new Date(a.scheduled_at), end = this._mpEndAt(a);
    const when = end && end > t0 ? `de ${this._hhmm(t0)} a ${this._hhmm(end)}` : `desde ${t0.getHours() % 12 === 1 ? 'la' : 'las'} ${this._hhmm(t0)}`;
    return `<p class="wp-ph2-whole">Te unes al plan completo · ${n} lugares, ${when}</p>`;
  }

  async _phDo(v, b) {
    const act = b.dataset.act;
    if (act === 'new') { v.sheet.close(); setTimeout(() => this._openPlanSheet(), 140); return; }
    const a = v.list[v.at]; if (!a) return;
    b.disabled = true;
    if (act === 'yes' || act === 'no') {
      const yes = act === 'yes';
      if (await this._planRpc('respond_plan', { p_activity: a.id, p_accept: yes }, yes ? `¡Vas! ${this._planWhen(a.scheduled_at)}` : 'Le avisamos que no puedes')) { v.sheet.close(); return; }
    } else {
      const on = act === 'wl-on';
      if (await this._planRpc('plan_waitlist', { p_activity: a.id, p_on: on }, on ? 'Listo · te avisamos si se libera un cupo' : 'Ya no estás en la lista de espera')) {
        a.waitlist = on ? [...(a.waitlist || []), v.me] : (a.waitlist || []).filter(id => id !== v.me);
        this._phPaintFoot(v, a);
        return;
      }
    }
    b.disabled = false;
  }
}
