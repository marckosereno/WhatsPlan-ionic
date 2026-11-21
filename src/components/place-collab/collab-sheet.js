// ═════════════════════════════════════════════════
// WHATSPLAN — place-collab/collab-sheet.js
// Hoja "Tú lo descubres": en vez de la ficha vacía, los lugares que solo traen lo
// básico (los de DENUE: ubicación y teléfono, sin fotos) abren esta hoja después del
// minicard del pin. El lugar y su ubicación los pone WhatsPlan; lo demás lo ponen
// quienes lo visitan: registrar su visita, contar qué vivieron (reseña) o, si es su
// negocio, reclamarlo. "Ver ficha completa" queda a mano.
//
// Uso:
//   isSparsePlace(place) → true si el lugar solo tiene lo básico
//   openCollabSheet(pm, place) → abre la hoja (pm = PlaceModal2; sus hojas de
//     reseña y "¿Es tu negocio?" se reutilizan tal cual)
// Estilos: /styles/place-collab.css (+ las tarjetas .wp-st-opt de plan-steps.css)
// ═════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { ensureCss } from '/src/components/tabs/tab-screen.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  pin:   ico('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>'),
  phone: ico('<path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5.9 5.9l1.3-2 4 1.6V18a2 2 0 0 1-2.2 2A15 15 0 0 1 3 6.2 2 2 0 0 1 5 4Z"/>'),
  clock: ico('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  photo: ico('<rect x="3.5" y="6" width="17" height="13" rx="3"/><circle cx="12" cy="12.5" r="3.2"/><path d="M8.5 6 9.7 4h4.6l1.2 2"/>'),
  here:  ico('<path d="M5 12.5 10 17.5 19 7"/>'),
  star:  ico('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>'),
  store: ico('<path d="M4 9.5 5.5 4h13L20 9.5M4 9.5v10h16v-10M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 19.5v-5h4v5"/>'),
};

// Solo lo básico = viene de DENUE y todavía no tiene fotos (cuando se aprueben fotos, abre la ficha normal)
export function isSparsePlace(p) {
  if (!p) return false;
  const id = String(p.place_id || p.placeId || p.id || '');
  const fotos = (p.photosUrls || p.photos_urls || []).length || p.photoUrl || p.photo_url;
  return id.startsWith('denue_') && !fotos;
}

export function openCollabSheet(pm, place) {
  // mismos ids que usa PlaceModal2, así no se cargan dos veces
  ensureCss('wp-tokens-css', '/styles/tokens.css');
  ensureCss('wp-pm2-steps-css', '/styles/plan-steps.css');
  ensureCss('wp-collab-css', '/styles/place-collab.css');
  const name = place.name || place.displayName || 'Este lugar';
  const dir = place.formattedAddress || place.formatted_address || '';
  const tel = place.phone || place.phone_number || '';
  const giro = Array.isArray(place.types) ? place.types.join(' ') : String(place.types || '');
  const sabemos = tel ? 'la ubicación y el teléfono' : 'la ubicación';

  const html = `<div class="wp-cs">
    <section class="wp-cs-head">
      <h2>${esc(name)}</h2>
      ${giro ? `<small>${esc(giro)}</small>` : ''}
    </section>
    <ul class="wp-cs-know">
      <li><span class="wp-cs-ki">${I.pin}</span><span><b>Ubicación</b><small>${esc(dir || 'Nuevo Progreso')}</small></span></li>
      ${tel ? `<li><span class="wp-cs-ki">${I.phone}</span><span><b>Teléfono</b><small>${esc(tel)}</small></span></li>` : ''}
    </ul>
    <p class="wp-cs-lead"><b>Tú lo descubres, tú lo cuentas.</b> De este lugar solo conocemos ${sabemos}. Lo demás lo pones tú: visítalo y comparte lo que viviste.</p>
    <div class="wp-cs-miss"><span>${I.photo}Fotos</span><span>${I.star}Reseñas</span><span>${I.clock}Horario</span></div>
    <div class="wp-st-opts wp-cs-opts">
      <button type="button" class="wp-st-opt" data-act="here"><span class="wp-st-opt-i">${I.here}</span>
        <span class="wp-st-opt-t"><b>Estuve aquí</b><small>Regístralo a menos de 100 m y gana puntos</small></span></button>
      <button type="button" class="wp-st-opt" data-act="review"><span class="wp-st-opt-i">${I.star}</span>
        <span class="wp-st-opt-t"><b>Escribir una reseña</b><small>Cuenta qué viviste</small></span></button>
      <button type="button" class="wp-st-opt" data-act="claim"><span class="wp-st-opt-i">${I.store}</span>
        <span class="wp-st-opt-t"><b>Soy el dueño</b><small>Pide acceso y verifica tu negocio</small></span></button>
    </div>
    <p class="wp-cs-soon">Pronto: sube fotos y comparte tu momento aquí.</p></div>`;

  const sheet = openSheetPage({
    title: 'Descubre este lugar',
    html,
    foot: '<button type="button" class="wp-cs-full" data-act="full">Ver ficha completa</button>',
    theme: 'explore',
  });

  // Si las hojas de estilo se acaban de pedir, la barra de arriba midió 0: se vuelve a medir
  setTimeout(() => sheet.relayout(), 150);

  // Las hojas de reseña y de dueño son de la ficha (PlaceModal2) y leen pm._place
  const lanzar = (fn) => {
    sheet.close();
    setTimeout(() => {
      try { pm._place = place; pm[fn](); }
      catch (e) { console.error('[Collab] No se pudo abrir', fn, e); pm.show(place); }
    }, 260);
  };
  sheet.root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.dataset.act === 'close') return;
    if (b.dataset.act === 'here') estuveAqui(pm, place, b);
    else if (b.dataset.act === 'review') lanzar('_openReviewModal');
    else if (b.dataset.act === 'claim') lanzar('_openClaimSheet');
    else if (b.dataset.act === 'full') { sheet.close(); setTimeout(() => pm.show(place), 260); }
  });
  return sheet;
}

// Registra la visita con el mismo servicio de la ficha (check_in del servidor valida los 100 m)
async function estuveAqui(pm, place, btn) {
  if (btn.classList.contains('busy') || btn.classList.contains('done')) return;
  btn.classList.add('busy');
  try {
    const { VisitService } = await import('/src/services/VisitService.js');
    if ((await VisitService.permission()) !== 'granted' && !(await VisitService.requestPermission())) {
      pm._showToast('Activa tu ubicación para registrar tu visita');
      return;
    }
    const r = await VisitService.checkIn(place.place_id || place.placeId);
    const pts = r.points ? ` · +${r.points} pts` : '';
    pm._showToast(r.first ? `¡Primera visita!${pts}` : `Visita registrada · ${r.visits} en total${pts}`);
    btn.classList.add('done');
    const t = btn.querySelector('small'); if (t) t.textContent = 'Visita registrada hoy';
  } catch (e) {
    pm._showToast(e?.message || 'No se pudo registrar la visita');
  } finally {
    btn.classList.remove('busy');
  }
}
