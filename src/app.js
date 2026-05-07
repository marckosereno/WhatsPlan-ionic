// ====================================================================
// WHATSPLAN — app.js
// ====================================================================

import { MapView }        from '/src/components/MapView.js';
import { initSupabase, AuthService, ActivityService } from '/src/services/SupabaseService.js';

window.wpApp = { mapView: null, currentUser: null, activities: [] };

// ── 1. Esperar MapLibre ──────────────────────────────────────────────
function waitForMapLibre() {
  return new Promise(resolve => {
    if (window.maplibregl) { resolve(); return; }
    const t = setInterval(() => { if (window.maplibregl) { clearInterval(t); resolve(); } }, 50);
  });
}

// ── 2. Cargar credenciales Supabase desde /api/config ───────────────
async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const c = await r.json();
    window.__SUPABASE_URL__      = c.supabaseUrl      || '';
    window.__SUPABASE_ANON_KEY__ = c.supabaseAnonKey  || '';
  } catch(e) { console.warn('⚠️ /api/config no disponible'); }
}

// ── 3. Conectar chips de categoría al MapView ────────────────────────
// Los chips tienen data-menu-key="RESTAURANTS" igual que la PWA original
function setupCategories(mv) {
  document.querySelectorAll('.category-footer-chip').forEach(chip => {
    // Quitar pointer-events en los hijos para que el click siempre llegue al chip
    chip.querySelectorAll('*').forEach(el => el.style.pointerEvents = 'none');

    chip.addEventListener('click', async (e) => {
      e.stopPropagation();

      const menuKey  = chip.dataset.menuKey;  // ← data-menu-key="RESTAURANTS"
      const isActive = chip.classList.contains('active');

      // Toggle off
      document.querySelectorAll('.category-footer-chip').forEach(c => c.classList.remove('active'));
      if (isActive) {
        mv._clearPlaceMarkers();
        mv.currentCatId = null;
        return;
      }

      chip.classList.add('active');
      // Actualizar contador mientras carga
      const counter = document.getElementById('map-results-count');
      if (counter) counter.textContent = 'Cargando...';

      await mv.loadCategory(menuKey);  // ← pasa el menuKey directamente

      if (counter) counter.textContent = `${mv.allPlaces.length} lugares`;
    });
  });
}

// ── 4. Suscripción realtime de actividades ───────────────────────────
function setupActivitySubscription(mv) {
  ActivityService.subscribeToActivities(async () => {
    try {
      const acts = await ActivityService.getActiveActivities();
      window.wpApp.activities = acts;
      mv.updateActivities(acts);
    } catch(_) {}
  });
}

// ── MAIN ─────────────────────────────────────────────────────────────
(async () => {
  await waitForMapLibre();

  // Config y auth en paralelo, no bloquean el mapa
  loadConfig().then(() => {
    initSupabase();
    AuthService.onAuthChange((event, user) => {
      window.wpApp.currentUser = user;
    });
  });

  const mv = new MapView();
  window.wpApp.mapView = mv;

  mv.onPlaceSelect = (place) => {
    console.log('📍 Lugar seleccionado:', place.name);
    // TODO Fase 5: PlaceSheet.open(place)
  };

  setupCategories(mv);
  setupActivitySubscription(mv);

  console.log('✅ WhatsPlan listo');
})();
