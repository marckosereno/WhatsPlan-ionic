// ====================================================================
// WHATSPLAN — app.js
// ORDEN CRÍTICO: loadConfig() → initSupabase() → MapView → UI
// ====================================================================

import { MapView }        from '/src/components/MapView.js';
import { AuthModal }      from '/src/components/AuthModal.js';
import { SuperUserPanel } from '/src/components/SuperUserPanel.js';
import { initSupabase, AuthService, ActivityService, ProfileService } from '/src/services/SupabaseService.js';
import { isSuperUser }    from '/src/services/SuperUserService.js';

window.wpApp = {
  mapView: null, currentUser: null,
  activities: [], superPanel: null, authModal: null,
};

// ── Esperar MapLibre ─────────────────────────────────────────────────
function waitForMapLibre() {
  return new Promise(resolve => {
    if (window.maplibregl) { resolve(); return; }
    const t = setInterval(() => { if (window.maplibregl) { clearInterval(t); resolve(); } }, 50);
  });
}

// ── Cargar config — DEBE completarse antes de initSupabase ───────────
async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const c = await r.json();
    window.__SUPABASE_URL__      = c.supabaseUrl      || '';
    window.__SUPABASE_ANON_KEY__ = c.supabaseAnonKey  || '';
    console.log('✅ Config cargada');
  } catch(e) {
    console.warn('⚠️ /api/config fallo:', e.message);
  }
}

// ── TopBar ───────────────────────────────────────────────────────────
function setupTopBar(authModal) {
  const btn = document.getElementById('topbar-auth-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (window.wpApp.currentUser) _showProfileMenu();
    else authModal.show();
  });
}

async function _updateTopBar(user) {
  const btn    = document.getElementById('topbar-auth-btn');
  const avatar = document.getElementById('topbar-avatar');
  const initEl = document.getElementById('topbar-initials');
  if (!btn) return;

  if (user) {
    btn.classList.add('logged-in');
    try {
      const profile = await ProfileService.getProfile(user.id);
      if (profile?.avatar_url && avatar) {
        avatar.src = profile.avatar_url;
        avatar.style.display = '';
        if (initEl) initEl.style.display = 'none';
      } else if (initEl) {
        const name = profile?.name || user.email || '?';
        initEl.textContent = name.charAt(0).toUpperCase();
        if (avatar) avatar.style.display = 'none';
      }
    } catch(_) {
      if (initEl) initEl.textContent = (user.email || '?').charAt(0).toUpperCase();
    }
  } else {
    btn.classList.remove('logged-in');
    if (avatar) avatar.style.display = 'none';
    if (initEl) { initEl.style.display = ''; initEl.textContent = '👤'; }
  }
}

function _showProfileMenu() {
  document.getElementById('profile-menu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'profile-menu';
  menu.style.cssText = `
    position:fixed;top:60px;right:12px;z-index:2000;
    background:white;border-radius:14px;overflow:hidden;
    box-shadow:0 8px 24px rgba(0,0,0,0.15);min-width:160px;
    font-family:'Inter Tight',system-ui,sans-serif;`;
  const item = document.createElement('div');
  item.textContent = '🚪 Cerrar sesión';
  item.style.cssText = 'padding:14px 18px;font-size:14px;font-weight:600;cursor:pointer;color:#ef4444;';
  item.addEventListener('click', async () => { await AuthService.logout(); menu.remove(); });
  menu.appendChild(item);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 100);
  document.body.appendChild(menu);
}

// ── SuperUserPanel ───────────────────────────────────────────────────
function mountSuperPanel(mv) {
  if (window.wpApp.superPanel) return;
  const sp = new SuperUserPanel(mv, {
    onLandmarksUpdated: (items) => mv._renderLandmarks(items),
  });
  sp.mount();
  window.wpApp.superPanel = sp;
  console.log('✅ SuperUserPanel montado');
}

// ── Categorías ───────────────────────────────────────────────────────
function setupCategories(mv) {
  document.querySelectorAll('.category-footer-chip').forEach(chip => {
    chip.querySelectorAll('*').forEach(el => el.style.pointerEvents = 'none');
    chip.addEventListener('click', async (e) => {
      e.stopPropagation();
      const menuKey  = chip.dataset.menuKey;
      const isActive = chip.classList.contains('active');
      document.querySelectorAll('.category-footer-chip').forEach(c => c.classList.remove('active'));
      if (isActive) { mv._clearPlaceMarkers(); mv.currentCatId = null; return; }
      chip.classList.add('active');
      const counter = document.getElementById('map-results-count');
      if (counter) counter.textContent = 'Cargando...';
      await mv.loadCategory(menuKey);
      if (counter) counter.textContent = `${mv.allPlaces.length} lugares`;
    });
  });
}

// ── Búsqueda simple (sin SearchOverlay por ahora) ────────────────────
function setupSearch(mv) {
  const panelInput = document.getElementById('map-search-global-input');
  if (!panelInput) return;
  panelInput.readOnly = false;
  panelInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const counter = document.getElementById('map-results-count');
    if (!q) {
      // Restaurar todos los markers
      mv.markerEls.forEach(el => el.style.display = '');
      if (counter) counter.textContent = `${mv.allPlaces.length} lugares`;
      return;
    }
    // Filtro simple: ocultar markers que no coinciden
    mv.allPlaces.forEach((place, i) => {
      const match = (place.name || '').toLowerCase().includes(q)
        || (place.formattedAddress || place.formatted_address || '').toLowerCase().includes(q);
      const el = mv.markerEls[i];
      if (el) el.style.display = match ? '' : 'none';
    });
    const visible = mv.allPlaces.filter(p =>
      (p.name || '').toLowerCase().includes(q)).length;
    if (counter) counter.textContent = `${visible} resultados`;
  });
}

// ── Actividades realtime ─────────────────────────────────────────────
function setupActivitySubscription(mv) {
  try {
    ActivityService.subscribeToActivities(async () => {
      try {
        const acts = await ActivityService.getActiveActivities();
        window.wpApp.activities = acts;
        mv.updateActivities(acts);
      } catch(_) {}
    });
  } catch(_) {}
}

// ════════════════════════════════════════════════════════════════════
// MAIN — orden estricto
// ════════════════════════════════════════════════════════════════════
(async () => {
  try {
    console.log('🚀 WhatsPlan iniciando...');

    // 1. MapLibre — sin esto mapa en blanco
    await waitForMapLibre();
    console.log('✅ MapLibre listo');

    // 2. Config — DEBE ir antes de initSupabase
    await loadConfig();
console.log('URL:', window.__SUPABASE_URL__);      // ← agregar
console.log('KEY:', window.__SUPABASE_ANON_KEY__?.substring(0,10)); 

    // 3. Supabase — ahora sí tiene las vars
    initSupabase();

    // 4. Auth listener
    AuthService.onAuthChange(async (event, user) => {
      console.log('🔐 Auth:', event, user?.email || 'sin sesión');
      window.wpApp.currentUser = user;
      _updateTopBar(user);
      if (user && isSuperUser(user.id)) mountSuperPanel(window.wpApp.mapView);
      if (!user && window.wpApp.superPanel) {
        window.wpApp.superPanel.unmount();
        window.wpApp.superPanel = null;
      }
    });

    // 5. Mapa
    console.log('🗺️ Creando MapView...');
    const mv = new MapView();
    window.wpApp.mapView = mv;
    mv.onPlaceSelect = (place) => console.log('📍 PlaceSheet TODO:', place.name);
    console.log('✅ MapView creado');

    // 6. Auth modal
    const authModal = new AuthModal({
      onAuthSuccess: (user) => {
        window.wpApp.currentUser = user;
        _updateTopBar(user);
        if (isSuperUser(user?.id)) mountSuperPanel(mv);
      },
    });
    window.wpApp.authModal = authModal;

    // 7. UI
    setupTopBar(authModal);
    setupCategories(mv);
    setupSearch(mv);
    setupActivitySubscription(mv);

    console.log('✅ WhatsPlan listo');
  } catch(err) {
    console.error('❌ Error crítico en init:', err.message, err.stack);
  }
})();
