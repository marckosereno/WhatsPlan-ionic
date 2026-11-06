// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan.js
// Hoja "Tu plan" / "Vas a ir". Usa la misma hoja de "Planear visita"
// (openSheetPage de step-sheet.js: sube desde abajo y llega hasta
// debajo de la barra de estado) con la línea de diseño de los pasos:
//  · tarjeta del plan con degradado celeste → azul (emoji, nombre,
//    horario y cuenta regresiva)
//  · quién va: tira de caras con su estado en una insignia
//  · detalles en 4 mosaicos (hora, dura, cupos con barra, quién puede);
//    los que puedes cambiar llevan una flecha y abren en zoom
//  · ruta, reglas y nota; "Compartir el plan" fijo abajo
// Pulso, onda y elástico. Lo que hace cada botón: my-plan-actions.js
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (.wp-mp-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { addElastic } from '/src/components/place-plans/elastic.js';

const VIS = { public: ['🌎', 'Cualquiera'], followers: ['🫶', 'Mis seguidores'], invited: ['🔒', 'Solo invitados'] };
const ROLE = { host: ['👑', 'Organiza'], go: ['✅', 'Va'], wait: ['⏳', 'Pendiente'], no: ['😕', 'No puede'] };
const ARROW = '<svg class="wp-mp-go" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const SHARE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';

export class MyPlan {
  _openMyPlanSheet(a) {
    const me = window.wpApp?.currentUser?.id, owner = a.creator_id === me;
    const { root, body, close } = openSheetPage({
      title: owner ? 'Tu plan' : 'Vas a ir',
      right: `<button type="button" class="wp-mp-danger" data-nopulse>${owner ? 'Cancelar plan' : 'Ya no puedo ir'}</button>`,
      html: this._mpHtml(a, owner, me),
      foot: `<button type="button" class="wp-mp-cta" data-a="share">${SHARE}<span>Compartir el plan</span></button>`,
    });
    body.classList.add('wp-mp');
    addElastic(body.querySelector('.wp-mp-who'), 'x');
    const ctx = { a, me, owner, root, close };
    root.addEventListener('click', (e) => this._mpClick(ctx, e));
    this._mpDanger(ctx);
  }

  _mpHtml(a, owner, me) {
    const P = a.participants || [], max = a.max_participants || 0, left = Math.max(0, max - P.length);
    const count = this._planFull(a) ? '¡Completo!' : max ? `${P.length} de ${max} · queda${left === 1 ? '' : 'n'} ${left}` : `${P.length}`;
    return `
      ${this._mpCard(a)}
      <div class="wp-mp-lbl"><b>Quién va</b><small>${count}</small></div>
      <div class="wp-mp-who">${this._mpWho(a, owner, me)}</div>
      <div class="wp-mp-grid">${this._mpTiles(a, owner)}</div>
      ${this._planRouteHtml(a, { owner }) ? `<div class="wp-mp-route">${this._planRouteHtml(a, { owner })}</div>` : ''}
      ${this._planRulesHtml(a, 'wp-mp-rules')}
      ${a.note ? `<div class="wp-mp-note"><small>📝 Nota</small><p>${this._esc(a.note)}</p></div>` : ''}
`;
  }

  // Tarjeta del plan: degradado, emoji, nombre, horario y cuenta regresiva
  _mpCard(a) {
    const end = a.ends_at ? ` → ${this._hhmm(new Date(a.ends_at))}` : '';
    return `<section class="wp-mp-card">
        <span class="wp-mp-ic">${this._planEmoji(a.type)}</span>
        <span class="wp-mp-card-t"><b>${this._esc(a.title)}</b><small>${this._esc(this._planWhen(a.scheduled_at))}${end}</small></span>
        ${this._mpCountdown(a)}
      </section>`;
  }

  _mpCountdown(a) {
    const now = Date.now(), mins = Math.round((new Date(a.scheduled_at).getTime() - now) / 60000);
    const live = mins <= 0 && (!a.ends_at || now < new Date(a.ends_at).getTime());
    const txt = live ? '<i></i>Ahora' : mins <= 0 ? 'Terminó' : mins < 60 ? `En ${mins} min` : mins < 1440 ? `En ${Math.round(mins / 60)} h` : `En ${Math.round(mins / 1440)} d`;
    return `<span class="wp-mp-count${live ? ' live' : ''}">${txt}</span>`;
  }

  // Tira de caras: insignia con el estado, nombre debajo
  _mpWho(a, owner, me) {
    const P = a.participants || [], D = a.declined || [];
    const rows = [[a.creator_id, 'host'], ...P.filter(id => id !== a.creator_id).map(id => [id, 'go']),
      ...(a.invited || []).filter(id => !P.includes(id) && !D.includes(id)).map(id => [id, 'wait']),
      ...D.filter(id => !P.includes(id)).map(id => [id, 'no'])];
    const first = (id) => { const p = this._profCache?.get(id) || {}; return this._esc(String(p.name || p.username || 'Alguien').split(' ')[0]); };
    return (owner ? '<button type="button" class="wp-mp-p add" data-a="invite"><span class="wp-mp-av">+</span><b>Invitar</b></button>' : '')
      + rows.map(([id, k]) => `<div class="wp-mp-p ${k}"><span class="wp-mp-av">${this._planFace(id)}<em title="${ROLE[k][1]}">${ROLE[k][0]}</em></span><b>${id === me ? 'Tú' : first(id)}</b></div>`).join('');
  }

  // 4 mosaicos; los que puede cambiar quien organiza llevan flecha
  _mpTiles(a, owner) {
    const P = a.participants || [], max = a.max_participants || 0;
    const dur = a.ends_at ? Math.round((new Date(a.ends_at) - new Date(a.scheduled_at)) / 60000) : 0;
    const [ve, vt] = VIS[a.visibility] || VIS.public;
    const tile = (act, ic, k, v, extra = '') => act
      ? `<button type="button" class="wp-mp-tile" data-a="${act}"><small>${ic} ${k}${ARROW}</small><b>${v}</b>${extra}</button>`
      : `<div class="wp-mp-tile"><small>${ic} ${k}</small><b>${v}</b>${extra}</div>`;
    const bar = max ? `<span class="wp-mp-bar"><i style="width:${Math.min(100, Math.round(P.length / max * 100))}%"></i></span>` : '';
    return [
      tile(owner && 'time', '🕒', 'Hora', `${this._hhmm(new Date(a.scheduled_at))}${a.ends_at ? ` → ${this._hhmm(new Date(a.ends_at))}` : ''}`),
      tile(owner && 'dur', '⏳', 'Dura', dur ? this._pwDurTxt(dur) : 'Sin hora de fin'),
      tile(owner && max && 'cupo', '🎟️', 'Cupos', max ? `${P.length} de ${max}` : `${P.length}`, bar),
      tile('', ve, 'Quién puede', vt),
    ].join('');
  }
}
