// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan.js
// Hoja "Tu plan" / "Vas a ir" en la hoja grande (openSheetPage), como
// una ficha de viaje con nuestros colores:
//  · tira de fotos de los lugares + tarjeta principal + renglones de
//    datos con "Más info" (my-plan-hero.js)
//  · resumen del plan hecho con IA (plan-summary.js)
//  · "3 de 4 ya van" y quién va en tarjetitas (+ Invitar)
//  · ruta numerada con fotos (my-plan-route.js) y otros planes aquí
//  · "Compartir el plan" fijo abajo
// _mpBody también lo usa el plan completo de "Planes aquí"
// (plans-here-detail.js). Lo que hace cada botón: my-plan-actions.js
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (.wp-mp-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { addElastic } from '/src/components/place-plans/elastic.js';

const ICO = {
  go: '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wait: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/></svg>',
  no: '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M7 12h10" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>',
};
const ROLE = { host: ['👑', 'Organiza'], go: [ICO.go, 'Va'], wait: [ICO.wait, 'Pendiente'], no: [ICO.no, 'No puede'] };
const ARROW = '<svg class="wp-mp-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// Mismo ícono de compartir que la barra de la ficha
const SHARE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1141,4.49112 L9.91063,7.63542 L9.891,8.05196 L9.8012,8.06134 C5.36297,8.583 2,12.3671 2,17 C2,17.457 2.03414,17.91 2.10168,18.3565 C2.38094,20.2022 2.59088,20.3807 3.87391,18.8547 C4.18977,18.479 4.54227,18.1439 4.91368,17.8247 C6.24977,16.7224 7.90632,16.0786 9.66842,16.0067 L9.894,16.002 L9.95549,17.2308 L10.1215,19.576 C10.2008,20.38 11.0467,20.9293 11.8253,20.4902 C12.1766,20.2919 12.52,20.0809 12.8641,19.8706 C14.652,18.7519 16.3249,17.4666 17.9553,16.1321 C18.9147,15.3326 19.7558,14.5744 20.4714,13.8844 C20.8007,13.5606 21.1304,13.2376 21.4496,12.9037 C21.9118,12.42 21.9575,11.6189 21.4737,11.1124 C20.3603,9.94706 18.7862,8.48751 16.8271,6.94049 C15.2394,5.69825 13.597,4.53773 11.8571,3.51856 C11.0203,3.04172 10.1902,3.69599 10.1141,4.49112 Z"/></svg>';

export class MyPlan {
  // opts.onBack: si vienes de "Planes aquí", atrás te regresa allá
  _openMyPlanSheet(a, opts = {}) {
    const me = window.wpApp?.currentUser?.id, owner = a.creator_id === me, stops = this._mpStops(a);
    let page = null;
    const onBack = opts.onBack ? () => { page.close(); setTimeout(opts.onBack, 360); return true; } : undefined;
    const { root, body, close } = page = openSheetPage({
      onBack,
      title: owner ? 'Tu plan' : 'Vas a ir',
      theme: owner ? 'mine' : 'going',
      right: `<button type="button" class="wp-mp-danger" data-nopulse>${owner ? 'Cancelar plan' : 'Ya no puedo ir'}</button>`,
      html: this._mpBody(a, { owner, me, stops }),
      foot: `<button type="button" class="wp-mp-cta" data-a="share">${SHARE}<span>Compartir el plan</span></button>`,
    });
    body.classList.add('wp-mp');
    this._mpWire(body);
    const ctx = { a, me, owner, root, close, stops };
    this._mpLoadPhotos(ctx);
    root.addEventListener('click', (e) => this._mpClick(ctx, e));
    this._mpDanger(ctx);
  }

  _mpBody(a, { owner = false, me, stops = this._mpStops(a), others = true } = {}) {
    return `
      ${this._mpStrip(stops)}
      ${this._mpHero(a, owner, stops)}
      ${this._mpRows(a, owner)}
      ${this._mpSummaryHtml(a)}
      ${this._mpSocial(a)}
      <div class="wp-mp-lbl">Quién va</div>
      <div class="wp-mp-who">${this._mpWho(a, owner, me)}</div>
      ${this._mpRoute(a, owner, stops)}
      ${others ? this._mpOthers(a) : ''}`;
  }

  // Tiras con rebote de lado
  _mpWire(body) {
    body.querySelectorAll('.wp-mp-who, .wp-mp-strip').forEach(el => addElastic(el, 'x'));
  }

  // "Otros planes aquí": tener tu plan no esconde los de los demás
  // (pueden ser otro día, o alguien te invitó a otro)
  _mpOthers(a) {
    const { pending, others } = this._planGroups();
    const list = others.filter(x => x.id !== a.id);
    if (!list.length) return '';
    const inv = pending.find(x => x.id !== a.id);
    const sub = inv ? `${this._phName(inv.creator_id)} te invitó a otro plan aquí` : 'Puedes unirte a otro, aunque sea otro día';
    return `<button type="button" class="wp-mp-more${inv ? ' inv' : ''}" data-a="others">
        <span class="wp-mp-faces">${[...new Set(list.map(x => x.creator_id))].slice(0, 3).map(id => this._planFace(id)).join('')}</span>
        <span class="wp-mp-social-t"><b>Otros planes aquí · ${list.length}</b><small>${sub}</small></span>${ARROW}</button>`;
  }

  _mpCountdown(a) {
    const now = Date.now(), mins = Math.round((new Date(a.scheduled_at).getTime() - now) / 60000);
    const live = mins <= 0 && (!a.ends_at || now < new Date(a.ends_at).getTime());
    const txt = live ? '<i></i>Ahora' : mins <= 0 ? 'Terminó' : mins < 60 ? `En ${mins} min` : mins < 1440 ? `En ${Math.round(mins / 60)} h` : `En ${Math.round(mins / 1440)} d`;
    return `<span class="wp-mp-count${live ? ' live' : ''}">${txt}</span>`;
  }

  // "3 de 4 ya van" con caritas encimadas
  _mpSocial(a) {
    const P = a.participants || [], max = a.max_participants || 0, left = Math.max(0, max - P.length);
    const pend = (a.invited || []).filter(id => !P.includes(id) && !(a.declined || []).includes(id)).length;
    const wl = (a.waitlist || []).length, full = this._planFull(a);
    const title = full ? `¡Completo! Van ${P.length}` : max ? `${P.length} de ${max} ya van` : `Van ${P.length}`;
    const sub = [full ? 'Ya no quedan cupos' : max ? `Queda${left === 1 ? '' : 'n'} ${left} cupo${left === 1 ? '' : 's'}` : '',
      pend ? `${pend} sin responder` : '', wl ? `${wl} en espera` : ''].filter(Boolean).join(' · ');
    return `<section class="wp-mp-social"><span class="wp-mp-faces">${P.slice(0, 3).map(id => this._planFace(id)).join('')}</span>
        <span class="wp-mp-social-t"><b>${title}</b><small>${sub}</small></span></section>`;
  }

  // Quién va: tarjetitas con cara, nombre y emoji de estado debajo
  _mpWho(a, owner, me) {
    const P = a.participants || [], D = a.declined || [];
    const rows = [[a.creator_id, 'host'], ...P.filter(id => id !== a.creator_id).map(id => [id, 'go']),
      ...(a.invited || []).filter(id => !P.includes(id) && !D.includes(id)).map(id => [id, 'wait']),
      ...D.filter(id => !P.includes(id)).map(id => [id, 'no'])];
    const first = (id) => { const p = this._profCache?.get(id) || {}; return this._esc(String(p.name || p.username || 'Alguien').split(' ')[0]); };
    return (owner ? '<button type="button" class="wp-mp-p add" data-a="invite"><i>+</i><b>Invitar</b><em>✨</em></button>' : '')
      + rows.map(([id, k]) => `<div class="wp-mp-p ${k}" title="${ROLE[k][1]}">${this._planFace(id)}<b>${id === me ? 'Tú' : first(id)}</b><em class="st-${k}" aria-label="${ROLE[k][1]}">${ROLE[k][0]}</em></div>`).join('');
  }
}
