// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan-hero.js
// Parte de arriba de "Tu plan" (my-plan.js), inspirada en una ficha de
// viaje:
//  · Tira de lugares del plan (fotos) repartida a lo ancho (2 → izquierda
//    y derecha; 3 → izquierda, centro y derecha) unida por un camino
//    punteado ondulado. Al tocar un lugar, la tarjeta muestra SUS datos:
//    foto, a qué hora llegan, cuánto tiempo ahí, qué van a hacer y la
//    nota que se puso al armar el plan.
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
    const list = [{ id: a.place_id, name: a.place_name || this._placeInfo().name, at: t0, emoji: this._planEmoji(a.type), photo: main },
      ...(Array.isArray(a.stops) ? a.stops : []).map(x => ({ id: x.place_id, name: x.name, at: new Date(t0.getTime() + (x.after || 0) * 60000),
        emoji: x.emoji || this._stopEmoji(x.cat), act: x.act, photo: '', custom: !!x.custom, note: x.note, address: x.address }))];
    // cuánto tiempo en cada lugar: hasta la siguiente parada (el primero, hasta que termina el plan)
    list.forEach((s, i) => {
      const next = list[i + 1]?.at || (i === 0 && a.ends_at ? new Date(a.ends_at) : null);
      s.mins = next ? Math.max(0, Math.round((next - s.at) / 60000)) : 0;
    });
    if (list.length > 1 && a.ends_at) list[0].mins = Math.round((new Date(a.ends_at) - t0) / 60000);
    return list;
  }

  _mpPhoto(s, i, cls = '') {
    return `<i class="wp-mp-ph ${cls}" data-pid="${this._esc(s.id || '')}" style="--bg:${PASTEL[i % PASTEL.length]}${s.photo ? `;background-image:url('${this._esc(s.photo)}')` : ''}">${s.photo ? '' : `<span>${s.emoji}</span>`}</i>`;
  }

  // Tira de fotos de los lugares (solo si hay más de uno), repartida a lo
  // ancho y unida por un camino punteado que ondula (arriba / abajo)
  _mpStrip(stops) {
    if (stops.length < 2) return '';
    const path = (k) => `<span class="wp-mp-path" aria-hidden="true"><svg viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d="${k % 2 ? 'M2 14 C 26 40, 44 40, 52 22 S 78 2, 98 26' : 'M2 26 C 26 0, 44 0, 52 18 S 78 38, 98 14'}" vector-effect="non-scaling-stroke"/></svg></span>`;
    return `<div class="wp-mp-strip">${stops.map((s, i) => `${i ? path(i) : ''}<button type="button" class="wp-mp-sp${i === 0 ? ' on' : ''}" data-a="pick" data-i="${i}" aria-label="${this._esc(s.name)}">${this._mpPhoto(s, i)}</button>`).join('')}</div>`;
  }

  // Datos del lugar elegido para la tarjeta (el primero = el plan)
  _mpStopInfo(a, s, i) {
    const dur = s.mins ? this._pwDurTxt(s.mins) : '';
    if (i === 0) return {
      when: `${this._planWhen(a.scheduled_at)}${a.ends_at ? ` → ${this._hhmm(new Date(a.ends_at))}` : ''}`,
      caps: `${dur ? `<span>⏳ ${dur}</span><i></i>` : ''}<span>🎟️ ${a.max_participants ? `${(a.participants || []).length} de ${a.max_participants}` : (a.participants || []).length}</span>`,
      note: '',
    };
    return {
      when: `Parada ${i + 1} · llegan ${this._hhmm(s.at)}`,
      caps: `<span>${s.emoji} ${this._esc(s.act ? this._mpActLabel(s.act) : s.custom ? 'Lugar propio' : 'Parada')}</span>${dur ? `<i></i><span>⏳ ${dur}</span>` : ''}`,
      note: s.note || s.address || '',
    };
  }

  _mpActLabel(key) {
    const t = (this._actTypes || []).find(x => x.key === key);
    return t?.label || String(key).replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
  }

  _mpHero(a, owner, stops) {
    const P = a.participants || [], s = stops[0], info = this._mpStopInfo(a, s, 0);
    return `<section class="wp-mp-hero">
        <div class="wp-mp-hero-ph">${this._mpPhoto(s, 0, 'big')}${this._mpCountdown(a)}</div>
        <div class="wp-mp-hero-t">
          <b>${this._esc(a.title)}</b>
          <small class="wp-mp-hero-place">${this._esc(s.name)}</small>
          <small class="wp-mp-hero-when">${this._esc(info.when)}</small>
          <em class="wp-mp-hero-note" hidden></em>
          <span class="wp-mp-hero-faces">${P.slice(0, 4).map(id => this._planFace(id)).join('')}${owner ? '<button type="button" class="wp-mp-hero-add" data-a="invite" aria-label="Invitar">+</button>' : ''}</span>
          <span class="wp-mp-caps">${info.caps}</span>
        </div>
      </section>`;
  }

  // Al tocar un lugar de la tira, la tarjeta muestra los datos de ESE lugar
  _mpPick(ctx, i) {
    const s = ctx.stops[i]; if (!s) return;
    const $ = (q) => ctx.root.querySelector(q), info = this._mpStopInfo(ctx.a, s, i);
    ctx.root.querySelectorAll('.wp-mp-sp').forEach((b, k) => b.classList.toggle('on', k === i));
    $('.wp-mp-hero-ph .wp-mp-ph').outerHTML = this._mpPhoto(s, i, 'big swap');
    $('.wp-mp-hero-place').textContent = s.name;
    $('.wp-mp-hero-when').textContent = info.when;
    $('.wp-mp-caps').innerHTML = info.caps;
    const note = $('.wp-mp-hero-note');
    note.hidden = !info.note; note.textContent = info.note ? `“${info.note}”` : '';
    const t = $('.wp-mp-hero-t'); t.classList.remove('swap'); void t.offsetWidth; t.classList.add('swap');
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
