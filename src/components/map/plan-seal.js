// Avatar de quien organiza el plan, en forma de sello (.wp-seal), para el pin del plan en el mapa.
// Los perfiles se toman de la caché de la ficha y los que falten se piden una sola vez.
import { getSupabase } from '/src/services/SupabaseService.js';
import { getAvatarUrl } from '/src/services/AvatarService.js';

const cache = () => (window.wpApp?.placeModal?._profCache || (window.__wpSealCache = window.__wpSealCache || new Map()));
const urlOf = (p) => (p && (p.avatar_url || getAvatarUrl(p.name || p.username || 'user'))) || '';

function put(el, p) {
  const u = urlOf(p);
  if (u) el.style.backgroundImage = `url("${String(u).replace(/"/g, '%22')}")`;
}

// Pinta los sellos .wp-pin-seal[data-uid] que haya dentro de root
export function paintSeals(root) {
  const els = [...root.querySelectorAll('.wp-pin-seal[data-uid]')];
  const c = cache(), miss = [];
  els.forEach(el => { const p = c.get(el.dataset.uid); if (p) put(el, p); else miss.push(el.dataset.uid); });
  const ids = [...new Set(miss)];
  if (!ids.length) return;
  getSupabase().from('profiles').select('id, name, username, avatar_url').in('id', ids).then(({ data }) => {
    (data || []).forEach(p => c.set(p.id, p));
    els.forEach(el => { const p = c.get(el.dataset.uid); if (p) put(el, p); });
  }).catch(() => {});
}
