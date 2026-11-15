// ═════════════════════════════════════════════
// WHATSPLAN — plan-pin-card.js
// Tarjeta de vista previa al tocar un pin de plan en el mapa: emoji, título,
// cuándo, lugar y cupo, con "Ver plan" (abre el plan completo igual que en
// Planes). Si hay varios planes en el mismo punto, muestra una lista corta.
// Estilos: /styles/plan-pin-card.css
// ═════════════════════════════════════════════
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let card = null;

export function closePlanPinCard() {
  if (!card) return;
  const c = card; card = null;
  c.classList.remove('on');
  setTimeout(() => c.remove(), 220);
}

function rowHtml(pm, a, i) {
  const P = a.participants || [], max = a.max_participants || 0;
  const when = a.scheduled_at ? pm._planWhen(a.scheduled_at) : '';
  return `<div class="wp-ppc-row">
    <i class="wp-ppc-emo">${pm._planEmoji(a.type)}</i>
    <span class="wp-ppc-t"><b>${esc(a.title || 'Plan')}</b>
      <small>${esc([when, a.place_name].filter(Boolean).join(' · '))}</small>
      <small>👥 ${P.length}${max ? `/${max}` : ''}</small></span>
    <button type="button" class="wp-ppc-go" data-i="${i}">Ver plan</button>
  </div>`;
}

export function showPlanPinCard(group) {
  const pm = window.wpApp?.placeModal;
  if (!pm || !group?.length) return;
  closePlanPinCard();
  const c = document.createElement('div');
  c.className = 'wp-ppc';
  c.innerHTML = `<button type="button" class="wp-ppc-x" aria-label="Cerrar">✕</button>
    ${group.length > 1 ? `<div class="wp-ppc-h">${group.length} planes aquí</div>` : ''}
    <div class="wp-ppc-list">${group.map((a, i) => rowHtml(pm, a, i)).join('')}</div>`;
  c.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('.wp-ppc-x')) return closePlanPinCard();
    const go = e.target.closest('.wp-ppc-go');
    if (!go) return;
    const a = group[+go.dataset.i];
    closePlanPinCard();
    setTimeout(() => window.wpApp?.plansTab?._openPlan?.(a), 230);
  });
  document.body.appendChild(c);
  card = c;
  requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('on')));
  // tocar el mapa (fuera de la tarjeta) la cierra
  const map = window.wpApp?.mapView?.getMap?.();
  map?.once?.('click', closePlanPinCard);
}
