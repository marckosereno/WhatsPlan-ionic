// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — tabs/tab-cache.js
// Planes y Social sin internet: lo último que se cargó se guarda en el
// teléfono (localStorage, por usuario), así al abrir una sección sin
// conexión se ve la lista de antes con un aviso, en vez de una pantalla
// vacía o rota. Si nunca se cargó, sale el aviso "Sin conexión" con
// botón para reintentar. Al volver el internet se recarga sola.
//
// Uso: cacheGet('plans:explore') / cacheSet('plans:explore', data)
//      netError(e)               → true si falló por la red
//      withTimeout(promise, ms)  → rechaza si tarda (red colgada)
//      offlineNote(hasCache)     → HTML del aviso (estilos en tabs.css)
//      whenOnline(cb)            → cb una vez al regresar la conexión
// ════════════════════════════════════════════════════════════════════
const PREFIX = 'wpTabCache:';

const uid = () => window.wpApp?.currentUser?.id || 'anon';

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${uid()}:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export function cacheSet(key, data) {
  try { localStorage.setItem(`${PREFIX}${uid()}:${key}`, JSON.stringify({ at: Date.now(), data })); }
  catch (_) {}   // lleno o bloqueado: no pasa nada, solo no se guarda
}

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// ¿El error es de red (sin internet / colgada) y no de otra cosa?
export const netError = (e) => isOffline() || /fetch|network|timeout|offline|load failed/i.test(String(e?.message || e));

export function withTimeout(p, ms = 9000) {
  if (isOffline()) return Promise.reject(new Error('offline'));
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

// Perfiles mínimos de una lista (para pintar caras/nombres sin red)
export function peopleOf(pm, ids) {
  const out = [];
  new Set(ids).forEach(id => { const p = pm?._profCache?.get(id); if (p) out.push({ id: p.id, name: p.name, username: p.username, avatar_url: p.avatar_url }); });
  return out;
}
export function restorePeople(pm, people) {
  if (!pm || !people?.length) return;
  pm._profCache = pm._profCache || new Map();
  people.forEach(p => { if (p?.id && !pm._profCache.has(p.id)) pm._profCache.set(p.id, p); });
}

const WIFI = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><circle cx="12" cy="20" r="0.6" fill="currentColor"/></svg>';

// hasCache: hay lista guardada → aviso chico arriba; si no → aviso grande
export function offlineNote(hasCache) {
  return hasCache
    ? `<div class="wp-off-bar">${WIFI}<span>Sin conexión · lo último que viste</span><button type="button" data-retry>Reintentar</button></div>`
    : `<div class="wp-off-box"><i>${WIFI}</i><b>Sin conexión</b><span>Revisa tu internet. En cuanto vuelva, esto se carga solo.</span><button type="button" class="wp-pt-cta" data-retry>Reintentar</button></div>`;
}

export function whenOnline(cb) {
  const h = () => { window.removeEventListener('online', h); cb(); };
  window.addEventListener('online', h);
  return () => window.removeEventListener('online', h);
}
