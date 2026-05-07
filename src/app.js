// ====================================================================
// WHATSPLAN — app.js
// Init: mapa + Auth + TopBar + SuperUserPanel + categorías + búsqueda
// ====================================================================

import { MapView }          from '/src/components/MapView.js';
import { SearchOverlay }    from '/src/components/SearchOverlay.js';
import { AuthModal }        from '/src/components/AuthModal.js';
import { SuperUserPanel }   from '/src/components/SuperUserPanel.js';
import { initSupabase, AuthService, ActivityService, ProfileService } from '/src/services/SupabaseService.js';
import { isSuperUser }      from '/src/services/SuperUserService.js';

window.wpApp = {
  mapView:      null,
  currentUser:  null,
  activities:   [],
  search:       null,
  authModal:    null,
  superPanel:   null,
};

// ── Helpers ──────────────────────────────────────────────────────────
function waitForMapLibre() {
  return new Promise(resolve => {
    if (window.maplibregl) { resolve(); return; }
    const t = setInterval(() => { if (window.maplibregl) { clearInterval(t); resolve(); } }, 50);
  });
}

async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const c = await r.json();
    window.__SUPABASE_URL__      = c.supabaseUrl      || '';
    window.__SUPABASE_ANON_KEY__ = c.supabaseAnonKey  || '';
  } catch(e) { console.warn('⚠️ /api/config no disponible'); }
}

// ── TopBar: avatar + botón auth ──────────────────────────────────────
function setupTopBar(authModal) {
  const bar = document.getElementById('topbar');
  if (!bar) return;

  const btn = document.getElementById('topbar-auth-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (window.wpApp.currentUser) {
        // Si ya está logueado → menú de perfil simple
        _showProfileMenu();
      } else {
        authModal.show();
      }
    });
  }
}

function _updateTopBar(user) {
  const btn    = document.getElementById('topbar-auth-btn');
  const avatar = document.getElementById('topbar-avatar');
  const initEl = document.getElementById('topbar-initials');

  if (!btn) return;

  if (user) {
    // Mostrar avatar o iniciales
    ProfileService.getProfile(user.id).then(profile => {
      if (profile?.avatar_url && avatar) {
        avatar.src = profile.avatar_url;
        avatar.style.display = '';
        if (initEl) initEl.style.display = 'none';
      } else if (initEl) {
        const name = profile?.name || user.email || '?';
        initEl.textContent = name.charAt(0).toUpperCase();
        initEl.style.display = '';
        if (avatar) avatar.style.display = 'none';
      }
    }).catch(() => {
      if (initEl) {
        initEl.textContent = (user.email || '?').charAt(0).toUpperCase();
        initEl.style.display = '';
      }
    });
    btn.classList.add('logged-in');
  } else {
    btn.classList.remove('logged-in');
    if (avatar)  { avatar.style.display = 'none'; }
    if (initEl)  { initEl.style.display = ''; initEl.textContent = '👤'; }
  }
}

function _showProfileMenu() {
  // Menú simple de perfil — más adelante se expande
  const existing = document.getElementById('profile-menu');
  if (existing) { existing.remove(); return; }

  const menu = document.createElement('div');
  menu.id = 'profile-menu';
  menu.innerHTML = `
    <div class="profile-menu-item" id="pm-logout">🚪 Cerrar sesión</div>`;
  menu.style.cssText = `
    position:fixed; top:60px; right:12px; z-index:2000;
    background:white; border-radius:14px; overflow:hidden;
    box-shadow:0 8px 24px rgba(0,0,0,0.15);
    min-width:160px; font-family:'Inter Tight',system-ui,sans-serif;`;

  const item = menu.querySelector('#pm-logout');
  item.style.cssText = 'padding:14px 18px;font-size:14px;font-weight:600;cursor:pointer;color:#ef4444;';
  item.addEventListener('click', async () => {
    await AuthService.logout();
    menu.remove();
  });

  // Cerrar al tocar fuera
  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 100);

  document.body.appendChild(menu);
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

// ── Búsqueda ─────────────────────────────────────────────────────────
function setupSearch(mv) {
  const search = new SearchOverlay({
    getAllPlaces:      () => mv.allPlaces,
    onResultClick:    (place) => {
      const lat = place.location?.lat ?? place.lat;
      const lng = place.location?.lng ?? place.lng;
      if (!lat || !lng) return;
      const idx = mv.allPlaces.indexOf(place);
      mv.map.flyTo({ center: [lng, lat], zoom: 17, duration: 400 });
      if (idx !== -1) {
        const rawPhoto = place.photoUrl || place.photo_url || place.photosUrls?.[0] || null;
        mv._showMiniCard(place, idx, rawPhoto);
      }
    },
    onClose:           () => {
      const counter = document.getElementById('map-results-count');
      if (counter) counter.textContent = mv.allPlaces.length > 0 ? `${mv.allPlaces.length} lugares` : '';
    },
    getCurrentCatIcon: () => mv.currentCatData?.icon || '💎',
  });
  window.wpApp.search = search;

  const panelInput = document.getElementById('map-search-global-input');
  const panelBar   = document.getElementById('map-search-global-bar');
  if (panelInput) {
    panelInput.readOnly = true;
    const trigger = () => {
      if (search.active) return;
      panelBar?.classList.add('launching');
      setTimeout(() => { panelBar?.classList.remove('launching'); search.activate(); }, 120);
    };
    panelInput.addEventListener('click',    trigger);
    panelInput.addEventListener('focus',    () => { panelInput.blur(); trigger(); });
    panelInput.addEventListener('touchend', (e) => { e.preventDefault(); trigger(); });
  }
}

// ── Actividades realtime ─────────────────────────────────────────────
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

  await loadConfig();
  initSupabase();

  // ── Auth modal ──────────────────────────────────────────────────
  const authModal = new AuthModal({
    onAuthSuccess: (user) => {
      window.wpApp.currentUser = user;
      _updateTopBar(user);
      // Montar SuperUserPanel si es superusuario
      if (isSuperUser(user?.id) && !window.wpApp.superPanel) {
        const sp = new SuperUserPanel(window.wpApp.mapView, {
          onLandmarksUpdated: (items) => window.wpApp.mapView._renderLandmarks(items),
        });
        sp.mount();
        window.wpApp.superPanel = sp;
      }
    },
  });
  window.wpApp.authModal = authModal;

  // ── Auth listener ───────────────────────────────────────────────
  AuthService.onAuthChange(async (event, user) => {
    window.wpApp.currentUser = user;
    _updateTopBar(user);

    if (user && isSuperUser(user.id) && !window.wpApp.superPanel) {
      const sp = new SuperUserPanel(window.wpApp.mapView, {
        onLandmarksUpdated: (items) => window.wpApp.mapView?._renderLandmarks(items),
      });
      sp.mount();
      window.wpApp.superPanel = sp;
    }
    if (!user && window.wpApp.superPanel) {
      window.wpApp.superPanel.unmount();
      window.wpApp.superPanel = null;
    }
  });

  // ── Mapa ────────────────────────────────────────────────────────
  const mv = new MapView();
  window.wpApp.mapView = mv;
  mv.onPlaceSelect = (place) => {
    console.log('📍 PlaceSheet:', place.name);
    // TODO Fase 5
  };

  setupTopBar(authModal);
  setupCategories(mv);
  setupSearch(mv);
  setupActivitySubscription(mv);

  console.log('✅ WhatsPlan listo');
})();
