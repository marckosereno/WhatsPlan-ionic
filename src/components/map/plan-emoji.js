// Emoji de un plan según su tipo, sin depender de que la ficha (placeModal) ya exista:
// los pines de plan se dibujan al arrancar, antes de que cargue. Los tipos con emoji propio
// (ACTIVITY_TYPES) se cargan aparte; al llegar avisan para repintar los pines.
const GENERIC = { food: '🍔', drinks: '☕', hangout: '🎉', explore: '🚀', shop: '🛍️', music: '🎵', sport: '🏃', photo: '📸', spa: '💆' };
let types = [];
const waiting = [];

import('/src/components/ActivityModal.js').then(m => {
  types = Array.isArray(m.ACTIVITY_TYPES) ? m.ACTIVITY_TYPES : [];
  waiting.splice(0).forEach(cb => { try { cb(); } catch (_) {} });
}).catch(() => {});

export function planEmoji(t) {
  return types.find(x => x.key === t)?.emoji || GENERIC[t] || '🎉';
}
export function onPlanEmojiReady(cb) { if (types.length) cb(); else waiting.push(cb); }
