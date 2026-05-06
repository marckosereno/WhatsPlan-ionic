// ====================================================================
// WHATSPLAN — app.js v2
// ====================================================================

import { MapView } from '/src/components/MapView.js';
import { initSupabase, AuthService, ActivityService } from '/src/services/SupabaseService.js';

window.wpApp = {
  mapView:     null,
  currentUser: null,
  activities:  [],
};

// Esperar a que maplibregl esté disponible en window
function waitForMapLibre() {
  return new Promise((resolve) => {
    if (window.maplibregl) { resolve(); return; }
    const check = setInterval(() => {
      if (window.maplibregl) { clearInterval(check); resolve(); }
    }, 50);
  });
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    window.__SUPABASE_URL__      = cfg.supabaseUrl      || '';
    window.__SUPABASE_ANON_KEY__ = cfg.supabaseAnonKey  || '';
  } catch (e) {
    console.warn('⚠️ /api/config no disponible');
  }
}

function setupAuth() {
  initSupabase();
  AuthService.onAuthChange((event, user) => {
    window.wpApp.currentUser = user;
    console.log('Auth:', event, user?.email || 'sin sesión');
  });
}

function setupCategories(mv) {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId    = btn.dataset.id;
      const isActive = btn.classList.contains('active');
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      if (isActive) {
        mv._clearPlaceMarkers();
        mv.currentCatId = null;
        return;
      }
      btn.classList.add('active');
      mv.loadCategory(catId);
    });
  });
}

function setupActivitySubscription(mv) {
  ActivityService.subscribeToActivities(async () => {
    try {
      const acts = await ActivityService.getActiveActivities();
      window.wpApp.activities = acts;
      mv.updateActivities(acts);
    } catch (_) {}
  });
}

(async () => {
  // 1. Esperar MapLibre — crítico, sin esto el mapa queda negro
  await waitForMapLibre();

  // 2. Cargar config y Supabase en paralelo (no bloquean el mapa)
  loadConfig().then(() => {
    setupAuth();
  });

  // 3. Mapa — ya sabemos que maplibregl está disponible
  const mv = new MapView();
  window.wpApp.mapView = mv;

  mv.onPlaceSelect = (place) => {
    console.log('📍 Lugar seleccionado:', place.name);
    // TODO Fase 5: PlaceSheet.open(place)
  };

  // 4. Categorías y suscripción
  setupCategories(mv);
  setupActivitySubscription(mv);

  console.log('✅ WhatsPlan iniciado');
})();