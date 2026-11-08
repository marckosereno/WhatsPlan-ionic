// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — map/label-declutter.js
// Orden en el mapa: decide qué pines enseñan su nombre y cuáles solo su
// ícono, para que nunca haya dos textos encimados.
//
//  · Cada pin visible recibe una puntuación: recomendado/evento, planes
//    activos, calificación × reseñas, abierto ahora.
//  · En ese orden se va "poniendo" su etiqueta en pantalla. Si choca con
//    una que ya está, o con el ícono de otro pin, esa se esconde (el pin
//    queda solo con su ícono). Al acercarte hay más espacio y aparecen.
//  · Tope de nombres según zoom, y la 2ª línea (★ 4.5 · Dentista) solo
//    en los más importantes.
//  · Nada de etiquetas pegadas a la barra de estado (franja de arriba).
//
// Uso: declutterLabels(markerEls, map)  → después de pines y clusters
//      typeLabel(place)                → "Dentista", "Farmacia"…
// Estilos: /styles/app.css (.wp-lbl-off, .wp-lbl-nometa, .wp-pin-closed…)
// ════════════════════════════════════════════════════════════════════

const PAD = 3;          // aire alrededor de cada etiqueta (px)
const TOP_SAFE = 64;    // franja de arriba (barra de estado + buscador)

// Cuántos nombres caben según el zoom, y cuántos con 2ª línea
const maxFor = (z) => (z >= 18 ? 22 : z >= 17 ? 14 : z >= 16 ? 9 : 6);
const metaFor = (z) => (z >= 18 ? 8 : z >= 17 ? 5 : 3);

export function pinScore(place, el) {
  const p = place || {};
  let s = 0;
  if (p.featured) s += 1000;
  if (p.pinEventMode || p.isEvent) s += 600;
  s += Math.min(5, el?._wpActs || 0) * 80;                    // planes activos ahí
  const r = parseFloat(p.rating) || 0;
  const n = +(p.userRatingCount || p.user_ratings_total || p.reviews_count || 0);
  s += r * 12 + Math.log10(n + 1) * 18;                        // bueno Y conocido
  if (el?.classList.contains('wp-pin-closed')) s -= 40;        // cerrados al final
  return s;
}

const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const grow = (r, d) => ({ left: r.left - d, top: r.top - d, right: r.right + d, bottom: r.bottom + d });

export function declutterLabels(markerEls, map) {
  if (!markerEls?.length || !map) return;
  const z = map.getZoom();
  const box = map.getContainer().getBoundingClientRect();
  const items = [];
  const icons = [];

  for (const el of markerEls) {
    if (!el?.isConnected || el._wpCulled || !el._wpVisible || el.style.display === 'none') continue;
    const label = el.querySelector('.place-pin-social-extra');
    const icon = el.querySelector('.place-pin-social-body, .place-pin-wrapper, .place-pin-bubble-stack');
    const ir = icon?.getBoundingClientRect();
    if (ir && ir.width) icons.push({ el, r: grow(ir, 1) });
    if (!label) continue;
    // el minicard abierto / pin destacado no se tocan
    if (el.classList.contains('marker-highlighted') || el.querySelector('.minicard-marker-content')) {
      label.classList.remove('wp-lbl-off');
      continue;
    }
    items.push({ el, label, score: pinScore(el._place, el) });
  }
  items.sort((a, b) => b.score - a.score);

  const placed = [];
  const max = maxFor(z), metas = metaFor(z);
  let shown = 0;
  const fits = (it, r) => r.width > 0
    && r.top > box.top + TOP_SAFE && r.bottom < box.bottom && r.left >= box.left + 2 && r.right <= box.right - 2
    && !placed.some(p => hit(grow(r, PAD), p)) && !icons.some(i => i.el !== it.el && hit(grow(r, PAD), i.r));
  for (const it of items) {
    // medir con la 2ª línea según le toque (cambia el alto de la caja)
    it.label.classList.toggle('wp-lbl-nometa', shown >= metas);
    let r = null;
    if (shown < max) {
      // primero de su lado; si no cabe (orilla de la pantalla o choca), del otro
      for (const side of sidesOf(it.label)) {
        setSide(it.label, side);
        const rr = it.label.getBoundingClientRect();
        if (fits(it, rr)) { r = rr; break; }
      }
      if (!r) setSide(it.label, sidesOf(it.label)[0]);
    }
    it.label.classList.toggle('wp-lbl-off', !r);
    if (r) { placed.push(r); shown++; }
  }
}

// ── Lado de la etiqueta (derecha ↔ izquierda del pin) ────────────────
// El pin trae su lado del panel (pinLabelPosition) en el transform; se
// guarda el original y se puede voltear al otro lado.
function sidesOf(label) {
  if (!label._wpT0) {
    const t = label.style.transform || '';
    const right = t.match(/^translate\((-?[\d.]+)px,\s*-50%\)$/);
    const left = t.match(/^translate\(calc\(-100% - (-?[\d.]+)px\),\s*-50%\)$/);
    label._wpT0 = t;
    label._wpOff = right ? +right[1] : left ? +left[1] : null;
    label._wpSide0 = right ? 'right' : left ? 'left' : 'fixed';
  }
  const s0 = label._wpSide0;
  return s0 === 'right' ? ['right', 'left'] : s0 === 'left' ? ['left', 'right'] : ['fixed'];
}

function setSide(label, side) {
  if (side === 'fixed' || label._wpSide === side) return;
  label._wpSide = side;
  const off = label._wpOff;
  label.style.transform = side === 'right' ? `translate(${off}px, -50%)` : `translate(calc(-100% - ${off}px), -50%)`;
  label.style.alignItems = side === 'right' ? 'flex-start' : 'flex-end';
  const txt = label.lastElementChild;
  if (txt) txt.style.textAlign = side === 'right' ? 'left' : 'right';
}

// ── Tipo del lugar en español (Google trae "dental_clinic") ─────────
const TYPES = {
  dentist: 'Dentista', dental_clinic: 'Dentista', pharmacy: 'Farmacia', drugstore: 'Farmacia',
  doctor: 'Doctor', medical_clinic: 'Clínica', medical_center: 'Clínica', medical_lab: 'Laboratorio',
  hospital: 'Hospital', physiotherapist: 'Fisioterapia', chiropractor: 'Quiropráctico',
  beauty_salon: 'Salón de belleza', hair_salon: 'Estética', hair_care: 'Estética', barber_shop: 'Barbería',
  nail_salon: 'Uñas', spa: 'Spa', massage: 'Masajes', gym: 'Gimnasio', fitness_center: 'Gimnasio',
  restaurant: 'Restaurante', mexican_restaurant: 'Comida mexicana', taco_restaurant: 'Tacos',
  seafood_restaurant: 'Mariscos', pizza_restaurant: 'Pizza', hamburger_restaurant: 'Hamburguesas',
  fast_food_restaurant: 'Comida rápida', steak_house: 'Cortes', sushi_restaurant: 'Sushi',
  cafe: 'Café', coffee_shop: 'Café', bakery: 'Panadería', ice_cream_shop: 'Helados', dessert_shop: 'Postres',
  bar: 'Bar', night_club: 'Antro', pub: 'Bar', brewery: 'Cervecería',
  store: 'Tienda', clothing_store: 'Ropa', shoe_store: 'Zapatería', shopping_mall: 'Plaza',
  supermarket: 'Súper', grocery_store: 'Abarrotes', convenience_store: 'Tiendita',
  park: 'Parque', tourist_attraction: 'Atracción', museum: 'Museo', movie_theater: 'Cine',
  church: 'Iglesia', school: 'Escuela', hotel: 'Hotel', lodging: 'Hotel', car_wash: 'Autolavado',
  car_repair: 'Taller', gas_station: 'Gasolinera', veterinary_care: 'Veterinaria', pet_store: 'Mascotas',
};

export function typeLabel(place) {
  const t = String(place?.primaryType || place?.category || '').trim();
  if (!t) return '';
  if (TYPES[t.toLowerCase()]) return TYPES[t.toLowerCase()];
  if (t === t.toUpperCase()) return '';                       // clave interna ("HEALTH"): mejor nada
  const s = t.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
