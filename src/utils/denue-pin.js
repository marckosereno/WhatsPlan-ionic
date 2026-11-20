// ═════════════════════════════════════════════════
// WHATSPLAN — utils/denue-pin.js
// Emoji y tipo de color del pin de los lugares de DENUE (custom_places con source 'denue').
// No traen foto ni estilo propio: el emoji sale de su subcategoría y el color lo da
// pinColor() (map/pin-palette.js) a partir de primaryType o de la categoría.
//   denuePinProps(row) → { pinEmoji, primaryType }
// Emojis normales (nada de la lista prohibida de la app: 📍 📌 🎯 🗺️ ✅ ❌ …).
// ═════════════════════════════════════════════════
const POR_SUB = {
  taco:      ['🌮', 'taco_restaurant'],
  mexican:   ['🍽️', 'mexican_restaurant'],
  seafood:   ['🦐', 'seafood_restaurant'],
  burger:    ['🍔', 'hamburger_restaurant'],
  cafe:      ['☕', 'cafe'],
  snack:     ['🥐', 'food'],
  bar:       ['🍻', 'bar'],
  dental:    ['🦷', 'dentist'],
  medico:    ['🩺', 'doctor'],
  optica:    ['👓', 'optician'],
  salon:     ['💇', 'beauty_salon'],
  spa:       ['💆', 'spa'],
  ropa:      ['👗', 'clothing_store'],
  souvenir:  ['🧺', 'gift_shop'],
  joyeria:   ['💍', 'jewelry_store'],
  vinos:     ['🍷', 'liquor_store'],
  atraccion: ['🎡', 'tourist_attraction'],
  hotel:     ['🏨', 'hotel'],
  plaza:     ['⛲', 'plaza_publica'],
  parque:    ['🌳', 'park'],
  mecanico:  ['🔧', ''],
  servicio:  ['🧼', ''],
};
const POR_CAT = { RESTAURANTS: '🍴', HEALTH: '🩺', SHOPPING: '🛍️', ENTERTAINMENT: '🎉', PARKS: '🌳', WORKSHOPS: '🔧' };

export function denuePinProps(row) {
  const sub = String(row?.subcategory_tags || '').split(',')[0].trim();
  const hit = POR_SUB[sub];
  return {
    pinEmoji: hit ? hit[0] : (POR_CAT[row?.category] || '🛍️'),
    primaryType: hit ? hit[1] : '',
  };
}
