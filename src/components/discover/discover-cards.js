// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — discover/discover-cards.js
// Las tarjetas de Discover (discover.js): plan, persona, fila de ranking,
// lugar y la caja de cada sección. Todo regresa HTML; esc() limpia texto.
// ════════════════════════════════════════════════════════════════════
import { photoSmall } from '/src/utils/photo-url.js';

const I = (d, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const SEARCH_IC = I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 18);
export const MAP_IC = I('<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>', 14);
const CAL = I('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>', 13);
const STAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8Z"/></svg>';

const initial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();
// Cara redonda: la foto, o la inicial si no hay / no carga
export const face = (name, url, cls = '') => `<span class="wp-dc-av ${cls}"${url ? ` style="background-image:url('${String(url).replace(/'/g, '%27')}')"` : ''}><b>${url ? '' : initial(name)}</b></span>`;

function when(iso) {
  const d = new Date(iso), n = new Date(), day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(n)) / 864e5);
  const hm = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/[\s.]/g, '').toLowerCase().replace(/(am|pm)$/, ' $1');
  const wd = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '').replace(/^./, (c) => c.toUpperCase());
  return `${diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : wd} · ${hm}`;
}

export const planCard = (a, esc) => `<button type="button" class="wp-dc-card plan" data-plan="${esc(a.id)}">
  <span class="wp-dc-when">${CAL}${esc(when(a.scheduled_at))}</span>
  <b class="wp-dc-t">${esc(a.title || 'Plan')}</b>
  <small class="wp-dc-s">${esc(a.place_name || '')}</small>
  <span class="wp-dc-foot">${face(a.creator_name, a.creator_avatar, 'sm')}<span class="wp-dc-by">${esc(a.creator_name || '')}</span>
    <span class="wp-dc-count">${a.going || 0}${a.max_participants ? `/${a.max_participants}` : ''}</span></span>
</button>`;

export const personCard = (p, esc, withFollow = false) => `<div class="wp-dc-card person" data-uid="${esc(p.id)}" data-name="${esc(p.name || '')}" data-av="${esc(p.avatar_url || '')}" role="button" tabindex="0">
  ${face(p.name, p.avatar_url)}
  <b class="wp-dc-t">${esc(p.name || 'Alguien')}</b>
  <small class="wp-dc-s">${p.username ? '@' + esc(p.username) : ''}</small>
  ${p.i_follow ? '<span class="wp-dc-done">Siguiendo</span>' : `<span class="wp-dc-follow" role="button" data-follow="${esc(p.id)}">Seguir</span>`}
</div>`;

export const rankRow = (r, i, esc) => `<div class="wp-dc-row" data-uid="${esc(r.user_id)}" data-name="${esc(r.name || '')}" data-av="${esc(r.avatar_url || '')}" role="button" tabindex="0">
  <i class="wp-dc-pos${i < 3 ? ' top' : ''}">${i + 1}</i>${face(r.name, r.avatar_url, 'sm')}
  <span class="wp-dc-rt"><b>${esc(r.is_me ? 'Tú' : r.name || 'Alguien')}</b><small>${r.places != null ? `${r.places} lugares` : ''}${r.level ? ` · nivel ${r.level}` : ''}</small></span>
  <span class="wp-dc-pts">${Number(r.points || 0).toLocaleString('es-MX')} pts</span>
</div>`;

export function placeCard(p, esc, idx, strip = false) {
  const raw = p.photoUrl || p.photo_url || (p.photosUrls && p.photosUrls[0]) || null;
  const ph = raw ? photoSmall(raw) : null;
  return `<button type="button" class="wp-dc-card place${strip ? '' : ' wide'}" data-place="${esc(p.place_id || p.id)}">
    <span class="wp-dc-ph"${ph ? ` style="background-image:url('${String(ph).replace(/'/g, '%27')}')"` : ''}></span>
    <b class="wp-dc-t">${esc(p.name)}</b>
    <small class="wp-dc-s">${p.rating ? `<span class="wp-dc-rate">${STAR}${Number(p.rating).toFixed(1)}</span>` : ''}${esc(p.categoryLabel || p.type_label || '')}</small>
  </button>`;
}

export function section(title, inner, { strip = false, list = false } = {}) {
  return `<section class="wp-dc-sec"><h3>${title}</h3>${strip ? `<div class="wp-dc-strip"><div class="wp-dc-track">${inner}</div></div>` : `<div class="wp-dc-list">${inner}</div>`}</section>`;
}

export const emptyBox = (t, s) => `<div class="wp-dc-empty"><i>${SEARCH_IC}</i><b>${t}</b><span>${s}</span></div>`;
