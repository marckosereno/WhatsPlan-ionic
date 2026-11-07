// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan-hero.js
// Parte de arriba de "Tu plan" (my-plan.js), inspirada en una ficha de
// viaje:
//  · Tira de lugares del plan (fotos): la elegida al centro, más grande
//    y con aro; al tocar otra, la tarjeta principal muestra ese lugar.
//  · Tarjeta principal blanca: foto grande del lugar con la cuenta
//    regresiva encima, nombre del plan, lugar y horario, las caras de
//    quién va (+ invitar) y una cápsula con dura · cupos.
//  · Renglones de datos (etiqueta gris · valor a la derecha, con líneas
//    finas): estado, hora, dura, cupos, quién puede; "Más info" abre
//    reglas y nota. Los que puede cambiar quien organiza llevan flecha.
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (.wp-mp-strip,
// .wp-mp-hero, .wp-mp-rows)
// ════════════════════════════════════════════════════════════════════
import { photoSmall } from '/src/utils/photo-url.js';

const VIS = { public: 'Cualquiera', followers: 'Mis seguidores', invited: 'Solo invitados' };
const PASTEL = ['#bfdbfe', '#fde68a', '#ddd6fe', '#fecdd3', '#bbf7d0', '#fed7aa'];
const ARROW = '<svg class="wp-mp-go" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const DOWN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';

export class MyPlanHero {
  // Lugares del plan en orden: [{ id, name, at, emoji, photo }]
  _mpStops(a) {
    const t0 = new Date(a.scheduled_at), p = this._place || {};
    const main = photoSmall((p.photosUrls && p.photosUrls[0]) || p.photoUrl || p.photo_url || '') || (p.photosUrls?.[0] || p.photoUrl || '');
    return [{ id: a.place_id, name: a.place_name || this._placeInfo().name, at: t0, emoji: this._planEmoji(a.type), photo: main },
      ...(Array.isArray(a.stops) ? a.stops : []).map(x => ({ id: x.place_id, name: x.name, at: new Date(t0.getTime() + (x.after || 0) * 60000),
        emoji: x.emoji || this._stopEmoji(x.cat), photo: '', custom: !!x.custom, note: x.note }))];
  }

  _mpPhoto(s, i, cls = '') {
    return `<i class="wp-mp-ph ${cls}" data-pid="${this._esc(s.id || '')}" style="--bg:${PASTEL[i % PASTEL.length]}${s.photo ? `;background-image:url('${this._esc(s.photo)}')` : ''}">${s.photo ? '' : `<span>${s.emoji}</span>`}</i>`;
  }

  // Tira de fotos de los lugares (solo si hay más de uno)
  _mpStrip(stops) {
    if (stops.length < 2) return '';
    return `<div class="wp-mp-strip">${stops.map((s, i) => `<button type="button" class="wp-mp-sp${i === 0 ? ' on' : ''}" data-a="pick" data-i="${i}" aria-label="${this._esc(s.name)}">${this._mpPhoto(s, i)}</button>`).join('')}</div>`;
  }

  _mpHero(a, owner, stops) {
    const P = a.participants || [], max = a.max_participants || 0, s = stops[0];
    const dur = a.ends_at ? this._pwDurTxt(Math.round((new Date(a.ends_at) - new Date(a.scheduled_at)) / 60000)) : '';
    const end = a.ends_at ? ` → ${this._hhmm(new Date(a.ends_at))}` : '';
    return `<section class="wp-mp-hero">
        <div class="wp-mp-hero-ph">${this._mpPhoto(s, 0, 'big')}${this._mpCountdown(a)}</div>
        <div class="wp-mp-hero-t">
          <b>${this._esc(a.title)}</b>
          <small class="wp-mp-hero-place">${this._esc(s.name)}</small>
          <small>${this._esc(this._planWhen(a.scheduled_at))}${end}</small>
          <span class="wp-mp-hero-faces">${P.slice(0, 4).map(id => this._planFace(id)).join('')}${owner ? '<button type="button" class="wp-mp-hero-add" data-a="invite" aria-label="Invitar">+</button>' : ''}</span>
          <span class="wp-mp-caps">${dur ? `<span>⏳ ${dur}</span><i></i>` : ''}<span>🎟️ ${max ? `${P.length} de ${max}` : P.length}</span></span>
        </div>
      </section>`;
  }

  // Al tocar un lugar de la tira, la tarjeta muestra ese lugar
  _mpPick(ctx, i) {
    const s = ctx.stops[i]; if (!s) return;
    ctx.root.querySelectorAll('.wp-mp-sp').forEach((b, k) => b.classList.toggle('on', k === i));
    const ph = ctx.root.querySelector('.wp-mp-hero-ph .wp-mp-ph');
    ph.outerHTML = this._mpPhoto(s, i, 'big swap');
    ctx.root.querySelector('.wp-mp-hero-place').textContent = i ? `${s.name} · ${this._hhmm(s.at)}` : s.name;
    this._haptic?.('light');
  }

  _mpRows(a, owner) {
    const P = a.participants || [], max = a.max_participants || 0;
    const now = Date.now(), t0 = new Date(a.scheduled_at).getTime(), live = t0 <= now && (!a.ends_at || now < new Date(a.ends_at).getTime());
    const dur = a.ends_at ? this._pwDurTxt(Math.round((new Date(a.ends_at) - new Date(a.scheduled_at)) / 60000)) : 'Sin hora de fin';
    const row = (k, v, act, more = false) => act
      ? `<button type="button" class="wp-mp-row${more ? ' more' : ''}" data-a="${act}"><span>${k}</span><b>${v}${ARROW}</b></button>`
      : `<div class="wp-mp-row${more ? ' more' : ''}"><span>${k}</span><b>${v}</b></div>`;
    const rules = this._planRulesHtml(a, 'wp-mp-rules');
    return `<div class="wp-mp-rows">
        ${row('Estado', live ? '<i class="wp-mp-dot"></i>En curso' : this._planFull(a) ? 'Completo' : 'Activo')}
        ${row('Hora', `${this._hhmm(new Date(a.scheduled_at))}${a.ends_at ? ` → ${this._hhmm(new Date(a.ends_at))}` : ''}`, owner && 'time')}
        ${row('Dura', dur, owner && 'dur')}
        ${row('Cupos', max ? `${P.length} de ${max}` : `${P.length}`, owner && max && 'cupo', true)}
        ${row('Quién puede', VIS[a.visibility] || VIS.public, '', true)}
        ${rules ? `<div class="wp-mp-row more col"><span>Reglas</span>${rules}</div>` : ''}
        ${a.note ? `<div class="wp-mp-row more col"><span>Nota</span><p>${this._esc(a.note)}</p></div>` : ''}
        <button type="button" class="wp-mp-moreinfo" data-a="more"><span>Más info</span>${DOWN}</button>
      </div>`;
  }
}
