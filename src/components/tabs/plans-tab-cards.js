// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — tabs/plans-tab-cards.js
// Tarjeta de un plan en la pestaña Planes (plans-tab.js), con la foto de
// protagonista (como un feed):
//  · Foto del lugar arriba; encima, la insignia de cuándo ("Hoy · 7 pm" o
//    "Ahora") a la izquierda y guardar a la derecha; abajo a la izquierda
//    "3 lugares" si tiene paradas.
//  · Abajo: el tipo de plan y la distancia en una cápsula chiquita, el
//    nombre, el lugar y quién organiza, las caritas de quién va y el
//    botón del caso (Unirme · Responder · Tu plan · Vas · Lleno).
// Usa los ayudantes de la ficha (pm: PlaceModal2) para caras y horas.
// Estilos: /styles/tabs.css (.wp-pt-card)
// ════════════════════════════════════════════════════════════════════
const MARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M6.5 4.5h11v15.5l-5.5-3.8-5.5 3.8z"/></svg>';
export const TYPES = {
  food: 'Comida', drinks: 'Café y bebidas', hangout: 'Pasar el rato', explore: 'Explorar', shop: 'Compras',
  music: 'Música', sport: 'Deporte', photo: 'Fotos', spa: 'Relax',
};
const PASTEL = ['#bfdbfe', '#fde68a', '#ddd6fe', '#fecdd3', '#bbf7d0', '#fed7aa'];

// De quién es el plan, para ti
export function planKind(a, me) {
  if (a.creator_id === me) return 'own';
  if ((a.participants || []).includes(me)) return 'go';
  if ((a.invited || []).includes(me) && !(a.declined || []).includes(me)) return 'inv';
  return 'other';
}

function cta(pm, a, k) {
  if (k === 'own') return '<span class="wp-pt-cta soft">Tu plan</span>';
  if (k === 'go') return '<span class="wp-pt-cta soft">Vas</span>';
  if (k === 'inv') return '<span class="wp-pt-cta">Responder</span>';
  return pm._planFull(a) ? '<span class="wp-pt-cta soft">Lleno</span>' : '<span class="wp-pt-cta">Unirme</span>';
}

function when(pm, a) {
  const t0 = new Date(a.scheduled_at), now = Date.now(), end = pm._mpEndAt(a);
  if (t0 <= now && (!end || now < end)) return '<b class="wp-pt-when live"><i></i>Ahora</b>';
  return `<b class="wp-pt-when">${pm._phDayLabel(t0)} · ${pm._hhmm(t0)}</b>`;
}

// ctx: { me, saved: Set, photo, km }
export function cardHtml(pm, a, i, ctx) {
  const k = planKind(a, ctx.me), P = a.participants || [], max = a.max_participants || 0;
  const n = 1 + (Array.isArray(a.stops) ? a.stops.length : 0);
  const on = ctx.saved.has(a.id);
  const photo = ctx.photo
    ? `<i class="wp-pt-img" style="background-image:url('${pm._esc(ctx.photo)}')"></i>`
    : `<i class="wp-pt-img none" style="--bg:${PASTEL[i % PASTEL.length]}"><span>${pm._planEmoji(a.type)}</span></i>`;
  const kind = [`${pm._planEmoji(a.type)} ${TYPES[a.type] || 'Plan'}`, ctx.km != null ? (ctx.km < 1 ? `${Math.max(50, Math.round(ctx.km * 20) * 50)} m` : `${ctx.km.toFixed(1)} km`) : ''].filter(Boolean).join(' · ');
  const who = k === 'own' ? 'Tú organizas' : `organiza ${pm._phName(a.creator_id)}`;
  const count = max ? `${P.length} de ${max} van` : `Van ${P.length}`;
  return `<article class="wp-pt-card ${k}" data-i="${i}" role="button" tabindex="0">
      <div class="wp-pt-ph">${photo}${when(pm, a)}
        <button type="button" class="wp-pt-save${on ? ' on' : ''}" data-save aria-label="${on ? 'Quitar de guardados' : 'Guardar'}">${MARK}</button>
        ${n > 1 ? `<span class="wp-pt-n">${n} lugares</span>` : ''}
      </div>
      <div class="wp-pt-body">
        <small class="wp-pt-kind">${pm._esc(kind)}</small>
        <b class="wp-pt-title">${pm._esc(a.title || 'Plan')}</b>
        <span class="wp-pt-where">${pm._esc(a.place_name || '')}${a.place_name ? ' · ' : ''}${who}</span>
        <div class="wp-pt-foot">
          <span class="wp-pt-faces">${P.slice(0, 3).map(id => pm._planFace(id)).join('')}${P.length > 3 ? `<em>+${P.length - 3}</em>` : ''}</span>
          <span class="wp-pt-count">${count}</span>
          ${cta(pm, a, k)}
        </div>
      </div>
    </article>`;
}

export function skeletonHtml() {
  return '<div class="wp-pt-sk"><i></i><b></b><b class="s"></b></div>'.repeat(2);
}
