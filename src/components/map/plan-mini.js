// ═════════════════════════════════════════════
// WHATSPLAN — map/plan-mini.js
// Cara del minimodal de un pin de plan: el emoji del plan (con contorno e inclinado) a la
// izquierda, el título a la derecha y arriba un badge chico (como el de los clusters) con el total de paradas.
// Se aplica sobre el minicard de MapView.
// Estilos: /styles/plan-mini.css
// ═════════════════════════════════════════════
export function decoratePlanMini(wrapper, a, emoji) {
  const card = wrapper?.querySelector('.minicard-marker-content');
  if (!card) return;
  card.removeAttribute('style');
  card.className = 'minicard-marker-content wp-pmini';
  card.textContent = '';
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); e.className = cls; e.textContent = txt; return e; };
  const n = 1 + (Array.isArray(a.stops) ? a.stops.length : 0);   // el lugar principal + las paradas que se agregaron
  card.appendChild(mk('span', 'wp-pmini-emo', emoji || '🎉'));
  card.appendChild(mk('div', 'wp-pmini-n', `${n} ${n === 1 ? 'parada' : 'paradas'}`));
  card.appendChild(mk('div', 'wp-pmini-t', a.title || 'Plan'));
}
