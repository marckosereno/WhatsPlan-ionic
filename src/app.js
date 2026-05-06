// ====================================================================
// WHATSPLAN — app.js
// Init principal: mapa + panel + categorías
// ====================================================================

// ── Configuración ───────────────────────────────────────────────────
const CENTER = [-98.005, 26.064]; // [lng, lat] Nuevo Progreso
const ZOOM   = 15;
const TILES  = 'https://tiles.openfreemap.org/styles/liberty';

// ── Mapa ────────────────────────────────────────────────────────────
const map = new maplibregl.Map({
  container: 'map',
  style: TILES,
  center: CENTER,
  zoom: ZOOM,
  attributionControl: false
});

map.addControl(
  new maplibregl.NavigationControl({ showCompass: false }),
  'top-right'
);

map.addControl(
  new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true
  }),
  'top-right'
);

map.on('load', () => {
  console.log('✅ WhatsPlan — mapa listo');
});

// ── Categorías — toggle activo ───────────────────────────────────────
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const isActive = btn.classList.contains('active');
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    if (!isActive) btn.classList.add('active');
  });
});
