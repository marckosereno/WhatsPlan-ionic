// ====================================================================
// WHATSPLAN — app.js v2
// Init: carga config → Supabase → MapView → categorías
// ====================================================================

import { MapView } from '/src/components/MapView.js';
import { initSupabase, AuthService, ActivityService } from '/src/services/SupabaseService.js';

// ── Estado global ────────────────────────────────────────────────────
window.wpApp = {
  mapView:      null,
  currentUser:  null,
  activities:   [],
};

// ── 1. Cargar credenciales desde /api/config ─────────────────────────
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    window.__SUPABASE_URL__      = cfg.supabaseUrl      || '';
    window.__SUPABASE_ANON_KEY__ = cfg.supabaseAnonKey  || '';
  } catch (e) {
    console.warn('⚠️ /api/config no disponible — Supabase no iniciará');
  }
}

// ── 2. Init Supabase + listener de auth ──────────────────────────────
function setupAuth() {
  initSupabase();

  AuthService.onAuthChange((event, user) => {
    window.wpApp.currentUser = user;
    console.log('Auth:', event, user?.email || 'sin sesión');
    // TODO Fase 8: actualizar avatar en topbar
  });
}

// ── 3. Init MapView ──────────────────────────────────────────────────
function setupMap() {
  const mv = new MapView();
  window.wpApp.mapView = mv;

  // Callback cuando el usuario toca un pin → Fase 5 abrirá PlaceSheet
  mv.onPlaceSelect = (place) => {
    console.log('📍 Lugar seleccionado:', place.name);
    // TODO Fase 5: PlaceSheet.open(place)
  };

  return mv;
}

// ── 4. Conectar botones de categoría ────────────────────────────────
function setupCategories(mv) {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId   = btn.dataset.id;
      const isActive = btn.classList.contains('active');

      // Toggle
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));

      if (isActive) {
        // Deseleccionar — limpiar markers
        mv._clearPlaceMarkers();
        mv.currentCatId = null;
        return;
      }

      btn.classList.add('active');
      mv.loadCategory(catId);
    });
  });
}

// ── 5. Suscribirse a actividades en tiempo real ──────────────────────
function setupActivitySubscription(mv) {
  ActivityService.subscribeToActivities(async () => {
    try {
      const acts = await ActivityService.getActiveActivities();
      window.wpApp.activities = acts;
      mv.updateActivities(acts);
    } catch (_) {}
  });
}

// ── MAIN ─────────────────────────────────────────────────────────────
(async () => {
  await loadConfig();
  setupAuth();
  const mv = setupMap();
  setupCategories(mv);
  setupActivitySubscription(mv);

  console.log('✅ WhatsPlan iniciado');
})();
