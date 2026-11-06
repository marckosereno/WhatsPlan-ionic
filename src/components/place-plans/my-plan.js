// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan.js
// Hoja "Tu plan" / "Vas a ir" con la línea de diseño de los pasos:
// hoja hasta debajo de la barra de estado, fondo blanco-celeste,
// portada con degradado celeste → azul y nubes, quién va en una tira
// (cara + emoji de estado, como los días con caritas), tarjeta de
// "3 de 4 ya van", detalles en mosaicos (hora, dura, cupos, quién
// puede, ruta) y "Compartir" fijo abajo. Pulso, onda, elástico y las
// tarjetas en zoom de siempre. Lo que hace cada botón: my-plan-actions.js
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (#wp-mp, .wp-mp-*)
// ════════════════════════════════════════════════════════════════════
import { attachSheet } from '/src/components/place-plans/step-sheet.js';
import { attachPulse } from '/src/components/place-plans/pulse.js';
import { addElastic } from '/src/components/place-plans/elastic.js';
import { ICON_BACK } from '/src/components/place-plans/step-screen.js';

const VIS = { public: ['🌎', 'Cualquiera'], followers: ['🫶', 'Mis seguidores'], invited: ['🔒', 'Solo invitados'] };
const ROLE = { host: ['👑', 'Organiza'], go: ['✅', 'Va'], wait: ['⏳', 'Pendiente'], no: ['😕', 'No puede'] };
const SHARE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';

export class MyPlan {
  _openMyPlanSheet(a) {
    const me = window.wpApp?.currentUser?.id, owner = a.creator_id === me;
    const root = document.createElement('div');
    root.id = 'wp-mp';
    root.innerHTML = this._mpHtml(a, owner, me);
    document.body.appendChild(root);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      root.classList.remove('in');
      sh.remove();
      setTimeout(() => root.remove(), 340);
    };
    const sh = attachSheet(root, close, '.wp-mp-top');
    attachPulse(root);
    addElastic(root.querySelector('.wp-mp-scroll'), 'y');
    addElastic(root.querySelector('.wp-mp-who'), 'x');
    const ctx = { a, me, owner, root, close };
    root.addEventListener('click', (e) => this._mpClick(ctx, e));
    this._mpDanger(ctx);
    void root.offsetHeight;
    root.classList.add('in');
  }

  _mpHtml(a, owner, me) {
    return `
      <header class="wp-mp-top">
        <button type="button" class="wp-mp-back" data-a="close" aria-label="Cerrar">${ICON_BACK}</button>
        <span class="wp-mp-ttl">${owner ? 'Tu plan' : 'Vas a ir'}</span>
        <button type="button" class="wp-mp-danger" data-nopulse>${owner ? 'Cancelar plan' : 'Ya no puedo ir'}</button>
      </header>
      <div class="wp-mp-scroll">
        ${this._mpHero(a)}
        ${this._mpSocial(a)}
        <div class="wp-mp-lbl">Quién va</div>
        <div class="wp-mp-who">${this._mpWho(a, owner, me)}</div>
        <div class="wp-mp-lbl">Detalles</div>
        <div class="wp-mp-grid">${this._mpTiles(a, owner)}</div>
        ${this._planRulesHtml(a, 'wp-mp-rules')}
        ${a.note ? `<div class="wp-mp-note"><span class="wp-mp-tile-k"><i>📝</i>Nota</span><p>${this._esc(a.note)}</p></div>` : ''}
        ${this._planRouteHtml(a, { owner }) ? `<div class="wp-mp-card">${this._planRouteHtml(a, { owner })}</div>` : ''}
      </div>
      <footer class="wp-mp-foot"><button type="button" class="wp-mp-cta" data-a="share">${SHARE}<span>Compartir el plan</span></button></footer>`;
  }

  // Portada: degradado con nubes, ícono del plan, nombre y chips
  _mpHero(a) {
    const ic = a.icon_url ? `<img src="${this._esc(a.icon_url)}" alt="" onerror="this.replaceWith(document.createTextNode('${this._planEmoji(a.type)}'))">` : this._planEmoji(a.type);
    const end = a.ends_at ? ` → ${this._hhmm(new Date(a.ends_at))}` : '';
    return `<section class="wp-mp-hero">
        <i class="wp-mp-cloud c1"></i><i class="wp-mp-cloud c2"></i><i class="wp-mp-cloud c3"></i>
        ${this._mpCountdown(a)}
        <div class="wp-mp-ic">${ic}</div>
        <h2>${this._esc(a.title)}</h2>
        <div class="wp-mp-chips"><span>📍 ${this._esc(a.place_name || this._placeInfo().name)}</span><span>🕒 ${this._esc(this._planWhen(a.scheduled_at))}${end}</span></div>
      </section>`;
  }

  _mpCountdown(a) {
    const now = Date.now(), t = new Date(a.scheduled_at).getTime(), mins = Math.round((t - now) / 60000);
    const live = mins <= 0 && (!a.ends_at || now < new Date(a.ends_at).getTime());
    const txt = live ? '<i></i>Ahora' : mins <= 0 ? 'Terminó' : mins < 60 ? `En ${mins} min` : mins < 24 * 60 ? `En ${Math.round(mins / 60)} h` : `En ${Math.round(mins / 1440)} días`;
    return `<span class="wp-mp-count${live ? ' live' : ''}">${txt}</span>`;
  }

  // "3 de 4 ya van" con caritas encimadas
  _mpSocial(a) {
    const P = a.participants || [], max = a.max_participants || 0, left = Math.max(0, max - P.length);
    const pend = (a.invited || []).filter(id => !P.includes(id) && !(a.declined || []).includes(id)).length;
    const wl = (a.waitlist || []).length;
    const title = this._planFull(a) ? `¡Completo! Van ${P.length} 🎉` : max ? `${P.length} de ${max} ya van` : `Van ${P.length}`;
    const sub = [this._planFull(a) ? 'Ya no quedan cupos' : max ? `Queda${left === 1 ? '' : 'n'} ${left} cupo${left === 1 ? '' : 's'}` : '',
      pend ? `${pend} sin responder` : '', wl ? `${wl} en espera` : ''].filter(Boolean).join(' · ');
    return `<section class="wp-mp-social"><span class="wp-mp-faces">${P.slice(0, 3).map(id => this._planFace(id)).join('')}</span>
        <span class="wp-mp-social-t"><b>${title}</b><small>${sub}</small></span></section>`;
  }

  // Tira de quién va: cara, nombre y emoji de estado debajo
  _mpWho(a, owner, me) {
    const P = a.participants || [], D = a.declined || [];
    const rows = [[a.creator_id, 'host'], ...P.filter(id => id !== a.creator_id).map(id => [id, 'go']),
      ...(a.invited || []).filter(id => !P.includes(id) && !D.includes(id)).map(id => [id, 'wait']),
      ...D.filter(id => !P.includes(id)).map(id => [id, 'no'])];
    const first = (id) => { const p = this._profCache?.get(id) || {}; return this._esc(String(p.name || p.username || 'Alguien').split(' ')[0]); };
    return (owner ? '<button type="button" class="wp-mp-p add" data-a="invite"><i>+</i><b>Invitar</b><em>✨</em></button>' : '')
      + rows.map(([id, k]) => `<div class="wp-mp-p ${k}" title="${ROLE[k][1]}">${this._planFace(id)}<b>${id === me ? 'Tú' : first(id)}</b><em aria-label="${ROLE[k][1]}">${ROLE[k][0]}</em></div>`).join('');
  }

  // Mosaicos de detalles; los de quien organiza se pueden tocar
  _mpTiles(a, owner) {
    const P = a.participants || [], max = a.max_participants || 0;
    const dur = a.ends_at ? Math.round((new Date(a.ends_at) - new Date(a.scheduled_at)) / 60000) : 0;
    const st = Array.isArray(a.stops) ? a.stops.length : 0;
    const [ve, vt] = VIS[a.visibility] || VIS.public;
    const tile = (act, ic, k, v, extra = '') => `<${act ? `button type="button" data-a="${act}"` : 'div'} class="wp-mp-tile${act ? ' edit' : ''}">
        <span class="wp-mp-tile-k"><i>${ic}</i>${k}</span><b>${v}</b>${extra}</${act ? 'button' : 'div'}>`;
    const bar = max ? `<span class="wp-mp-bar"><i style="width:${Math.min(100, Math.round(P.length / max * 100))}%"></i></span>` : '';
    return [
      tile(owner && 'time', '🕒', 'Hora', `${this._hhmm(new Date(a.scheduled_at))}${a.ends_at ? ` → ${this._hhmm(new Date(a.ends_at))}` : ''}`),
      tile(owner && 'dur', '⏳', 'Dura', dur ? this._pwDurTxt(dur) : 'Sin hora de fin'),
      tile(owner && max && 'cupo', '🎟️', 'Cupos', max ? `${P.length} de ${max}` : `${P.length}`, bar),
      tile('', ve, 'Quién puede', vt),
      tile(st ? 'route' : (owner && 'addstop'), '🗺️', 'Ruta', st ? `${1 + st} paradas` : owner ? 'Agregar parada' : 'Un solo lugar'),
    ].join('');
  }
}
