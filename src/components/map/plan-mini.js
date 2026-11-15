// ═════════════════════════════════════════════
// WHATSPLAN — map/plan-mini.js
// Cara del minimodal de un pin de plan: el emoji pasa a la esquina como sticker con
// contorno, a la izquierda ese mismo emoji (en lugar del avatar), luego el título y arriba
// las caritas de quienes van (+N). Se aplica sobre el minicard de MapView.
// Estilos: /styles/plan-mini.css
// ═════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { getAvatarUrl } from '/src/services/AvatarService.js';

const MAX_FACES = 3;

function face(cls, p) {
  const i = document.createElement('i');
  i.className = cls;
  const u = (p && p.avatar_url) || getAvatarUrl((p && (p.name || p.username)) || 'user');
  i.style.backgroundImage = `url("${String(u).replace(/"/g, '%22')}")`;
  return i;
}

function paint(card, a, cache) {
  const box = card.querySelector('.wp-pmini-faces');
  if (!box) return;
  box.textContent = '';
  const P = a.participants || [];
  P.slice(0, MAX_FACES).forEach(id => box.appendChild(face('wp-pmini-f', cache.get(id))));
  if (P.length > MAX_FACES) {
    const n = document.createElement('b');
    n.className = 'wp-pmini-n';
    n.textContent = `+${P.length - MAX_FACES}`;
    box.appendChild(n);
  }
}

export function decoratePlanMini(wrapper, a, emoji) {
  const card = wrapper?.querySelector('.minicard-marker-content');
  if (!card) return;
  card.removeAttribute('style');
  card.className = 'minicard-marker-content wp-pmini';
  card.textContent = '';
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); e.className = cls; if (txt != null) e.textContent = txt; return e; };
  card.appendChild(mk('span', 'wp-pmini-emo', emoji || '🎉'));
  card.appendChild(mk('div', 'wp-pmini-faces'));
  card.appendChild(mk('div', 'wp-pmini-t', a.title || 'Plan'));

  const cache = window.wpApp?.placeModal?._profCache || new Map();
  paint(card, a, cache);
  const need = [...new Set((a.participants || []).slice(0, MAX_FACES))].filter(id => id && !cache.has(id));
  if (!need.length) return;
  getSupabase().from('profiles').select('id, name, username, avatar_url').in('id', need).then(({ data }) => {
    (data || []).forEach(p => cache.set(p.id, p));
    if (card.isConnected) paint(card, a, cache);
  }).catch(() => {});
}
