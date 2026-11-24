// ═════════════════════════════════════════════════
// place-social.js — "Quién ha estado aquí": lo social de la ficha (estilo Bump).
// Visitas, personas, tus amigos que fueron y quienes más han ido, + las acciones para sumar al lugar
// (Estuve aquí, reseña, soy el dueño). Todo sale de nuestros datos (place_visits), nada de Google.
// Uso: mountPlaceSocial(pm, place, host)  (pm = PlaceModal2; host = <div id="wp-pm2-social">)
// SQL: supabase/50_ficha_social.sql (place_social). Estilos: styles/place-collab.css (.wp-ps*)
// ═════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { ensureCss } from '/src/components/tabs/tab-screen.js';
import { estuveAqui } from '/src/components/place-collab/collab-sheet.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ini = (n) => esc((String(n || '?').replace(/^@/, '').trim()[0] || '?').toUpperCase());
const face = (p, cls = '') => p.avatar
  ? `<img class="wp-ps-av ${cls}" src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'wp-ps-av ${cls}',textContent:'${ini(p.nombre)}'}))">`
  : `<span class="wp-ps-av ${cls}">${ini(p.nombre)}</span>`;
const fecha = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } };
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

async function cargar(placeId) {
  try {
    const { data, error } = await getSupabase().rpc('place_social', { p_place_id: String(placeId) });
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.warn('[place-social]', e?.message || e);
    return null;   // sin el SQL 50 o sin red: se muestran solo las acciones
  }
}

function pintar(host, s) {
  const personas = s?.personas || 0;
  const visitas = s?.visitas || 0;
  let cuerpo;
  if (!personas) {
    cuerpo = `<p class="wp-ps-vacio"><b>Nadie ha registrado una visita todavía.</b><br>Sé el primero en descubrir este lugar y contar lo que viviste.</p>`;
  } else {
    const amigos = s.amigos || [];
    const top = s.top || [];
    cuerpo = `
      <div class="wp-ps-stats">
        <div><b>${visitas}</b><small>${visitas === 1 ? 'visita' : 'visitas'}</small></div>
        <div><b>${personas}</b><small>${personas === 1 ? 'persona' : 'personas'}</small></div>
        ${s.mias ? `<div class="wp-ps-me"><b>${s.mias}</b><small>${s.mias === 1 ? 'vez tuya' : 'veces tuyas'}</small></div>` : ''}
      </div>
      ${s.ultima ? `<p class="wp-ps-ult">Última visita: ${esc(fecha(s.ultima))}</p>` : ''}
      ${amigos.length ? `<div class="wp-ps-sec"><h4>Tus amigos que han ido</h4>
        <div class="wp-ps-friends">${amigos.map((a) => `<span class="wp-ps-fr">${face(a)}<small>${esc(a.nombre)}${a.visitas > 1 ? ` · ${a.visitas}` : ''}</small></span>`).join('')}</div></div>` : ''}
      ${top.length ? `<div class="wp-ps-sec"><h4>Los que más han ido</h4>
        <ol class="wp-ps-top">${top.map((t, i) => `<li class="${t.yo ? 'yo' : ''}"><span class="wp-ps-rk">${i + 1}</span>${face(t)}<span class="wp-ps-nm">${t.yo ? 'Tú' : esc(t.nombre)}</span><span class="wp-ps-n">${plural(t.visitas, 'visita', 'visitas')}</span></li>`).join('')}</ol></div>` : ''}`;
  }
  host.innerHTML = `
    <h3 class="wp-ps-h">Quién ha estado aquí</h3>
    ${cuerpo}
    <div class="wp-ps-acts">
      <button type="button" class="wp-ps-act main" data-act="here"><b>Estuve aquí</b><small>Regístralo a menos de 100 m y gana puntos</small></button>
      <button type="button" class="wp-ps-act" data-act="review"><b>Cuenta qué viviste</b><small>Escribe una reseña</small></button>
      <button type="button" class="wp-ps-act" data-act="claim"><b>Soy el dueño</b><small>Verifica tu negocio</small></button>
    </div>`;
}

export async function mountPlaceSocial(pm, place, host) {
  if (!host) return;
  const placeId = place.place_id || place.placeId;
  if (!placeId) { host.style.display = 'none'; return; }
  ensureCss('wp-tokens-css', '/styles/tokens.css');
  ensureCss('wp-collab-css', '/styles/place-collab.css');
  host.style.display = '';
  host.classList.add('wp-ps');
  host.innerHTML = '<div class="wp-ps-skel"></div>';
  const vigente = () => pm._place === place;

  const refrescar = async () => { const s = await cargar(placeId); if (vigente()) pintar(host, s); };
  const s0 = await cargar(placeId);
  if (!vigente()) return;
  pintar(host, s0);

  host.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'here') { await estuveAqui(pm, place, b); refrescar(); }
    else if (b.dataset.act === 'review') { pm._place = place; pm._openReviewModal(); }
    else if (b.dataset.act === 'claim') { pm._place = place; pm._openClaimSheet(); }
  };
}
