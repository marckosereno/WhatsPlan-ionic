// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — map/pin-palette.js
// Colores de los pines, pensados para el mapa greige: tonos un poco más
// cálidos y apagados que los "neón" de antes, todos con la misma
// luminosidad para que ninguno grite más que otro. Cada pin va con un
// degradado suave (más claro arriba → el color), como los botones
// laterales y los stickers.
//
//  · Si el lugar tiene color elegido en el panel, se respeta el tono: los
//    colores viejos se traducen a su versión de la paleta (naranja →
//    coral, fucsia → frambuesa…).
//  · Si no tiene, se elige por su tipo / categoría.
//  · El rojo NO está: es solo para borrar y el corazón.
//
// Uso: pinColor(place) → { base, light, grad }
//      PIN_PALETTE → para el selector del panel de superusuario
// ════════════════════════════════════════════════════════════════════

export const PIN_PALETTE = [
  { key: 'salud',  label: 'Salud',           base: '#3b6fd8', light: '#5b8def' },
  { key: 'farma',  label: 'Farmacias',       base: '#e0734f', light: '#ef9a78' },
  { key: 'belleza', label: 'Belleza y spa',  base: '#d9668f', light: '#ec97b4' },
  { key: 'comida', label: 'Comida',          base: '#d99a2b', light: '#eec26a' },
  { key: 'cafe',   label: 'Café',            base: '#b07a52', light: '#cfa07c' },
  { key: 'noche',  label: 'Noche',           base: '#7c6bd1', light: '#a99bea' },
  { key: 'natura', label: 'Naturaleza',      base: '#5fa67a', light: '#8fcaa2' },
  { key: 'compras', label: 'Compras',        base: '#3a9aa6', light: '#7cc0c8' },
  { key: 'diversion', label: 'Entretenimiento', base: '#5b63d6', light: '#8f95ea' },
  { key: 'otros',  label: 'Otros',           base: '#5b6270', light: '#8d93a0' },
];
const BY_KEY = Object.fromEntries(PIN_PALETTE.map(c => [c.key, c]));
const BY_BASE = Object.fromEntries(PIN_PALETTE.map(c => [c.base, c]));

// Colores que ya estaban guardados → su tono equivalente de la paleta
const LEGACY = {
  '#f97316': 'farma', '#ea580c': 'farma', '#ef4444': 'farma', '#dc2626': 'farma',
  '#8b5cf6': 'noche', '#7c3aed': 'noche', '#a855f7': 'noche',
  '#ec4899': 'belleza', '#db2777': 'belleza', '#f43f5e': 'belleza',
  '#10b981': 'natura', '#22c55e': 'natura', '#16a34a': 'natura',
  '#3b82f6': 'salud', '#2563eb': 'salud', '#1d4ed8': 'salud', '#0ea5e9': 'compras', '#06b6d4': 'compras', '#14b8a6': 'compras',
  '#eab308': 'comida', '#f59e0b': 'comida', '#facc15': 'comida',
  '#6366f1': 'diversion', '#4f46e5': 'diversion',
  '#64748b': 'otros', '#6b7280': 'otros', '#111827': 'otros',
};

// Tipo de Google → color
const TYPE_KEY = [
  [/dent|doctor|medic|clinic|hospital|physio|chiropract|health|optic|laborator/, 'salud'],
  [/pharma|drugstore/, 'farma'],
  [/beauty|hair|nail|spa|barber|massage|salon|cosmet/, 'belleza'],
  [/cafe|coffee|bakery|tea_house/, 'cafe'],
  [/bar\b|^bar|pub|night_club|brewery|wine|cocktail/, 'noche'],
  [/restaurant|food|taco|pizza|burger|meal|steak|sushi|ice_cream|dessert|deli|diner/, 'comida'],
  [/park|garden|hiking|beach|campground|zoo|nature|plaza_publica/, 'natura'],
  [/store|shop|mall|market|boutique|supermarket/, 'compras'],
  [/cinema|movie|theater|bowling|amusement|museum|gallery|stadium|gym|fitness|club|casino|karaoke/, 'diversion'],
];
// Categoría de WhatsPlan → color
const CAT_KEY = { RESTAURANTS: 'comida', HEALTH: 'salud', SHOPPING: 'compras', ENTERTAINMENT: 'diversion', PARKS: 'natura', WORKSHOPS: 'otros' };

export function pinColor(place) {
  const p = place || {};
  const chosen = String(p.pinBadgeColor || '').toLowerCase();
  let c = BY_BASE[chosen] || BY_KEY[LEGACY[chosen]];
  if (!c && chosen) c = { base: chosen, light: chosen };           // color propio fuera de la paleta: tal cual
  if (!c) {
    const t = String(p.primaryType || '').toLowerCase();
    const hit = TYPE_KEY.find(([re]) => re.test(t));
    c = BY_KEY[hit?.[1] || CAT_KEY[String(p.category || '').toUpperCase()] || 'otros'];
  }
  return { base: c.base, light: c.light, grad: `linear-gradient(160deg, ${c.light}, ${c.base})` };
}
