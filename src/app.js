// ====================================================================
// WHATSPLAN — app.js
// ====================================================================

import { MapView }          from '/src/components/MapView.js';
import { AuthModal }        from '/src/components/AuthModal.js';
import { SuperUserPanel }   from '/src/components/SuperUserPanel.js';
import { SubcategoryRow }   from '/src/components/SubcategoryRow.js';
import { initSupabase, AuthService, ActivityService, ProfileService } from '/src/services/SupabaseService.js';
import { isSuperUser }      from '/src/services/SuperUserService.js';

window.wpApp = {
  mapView: null, currentUser: null,
  activities: [], superPanel: null,
  authModal: null, subcatRow: null,
  _cachedAvatarUrl: '',
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
    console.log('✅ Config cargada');
  } catch(e) { console.warn('⚠️ /api/config fallo:', e.message); }
}

// ── Avatar ────────────────────────────────────────────────────────────
async function renderAuthButton(user) {
  const btn = document.getElementById('topbar-auth-btn');
  if (!btn) return;
  if (!user) {
    btn.style.border = '2px solid rgba(255,255,255,0.6)';
    btn.innerHTML = `<img src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Bust+in+silhouette/3D/bust_in_silhouette_3d.png"
      style="width:26px;height:26px;object-fit:contain;opacity:0.7;" onerror="this.outerHTML='👤'">`;
    return;
  }
  let avatarUrl = window.wpApp._cachedAvatarUrl || user?.user_metadata?.avatar_url || '';
  if (!avatarUrl) {
    try {
      const profile = await ProfileService.getProfile(user.id);
      if (profile?.avatar_url) { avatarUrl = profile.avatar_url; window.wpApp._cachedAvatarUrl = avatarUrl; }
    } catch(_) {}
  }
  if (avatarUrl) {
    btn.style.border = '2px solid rgba(255,255,255,0.7)';
    btn.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;overflow:hidden;">
      <img src="${avatarUrl}?cb=${Date.now()}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">
    </div>`;
  } else {
    btn.style.border = '2.5px dashed #a78bfa';
    btn.innerHTML = `
      <img src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Ghost/3D/ghost_3d.png"
        style="width:26px;height:26px;object-fit:contain;" onerror="this.outerHTML='👻'">
      <span style="position:absolute;bottom:-6px;right:-4px;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:white;border-radius:50%;width:16px;height:16px;font-size:9px;font-weight:800;line-height:16px;text-align:center;border:1.5px solid white;box-shadow:0 1px 4px rgba(124,58,237,0.4);">+</span>`;
  }
}

// ── Topbar ────────────────────────────────────────────────────────────
function setupTopBar(authModal) {
  const btn = document.getElementById('topbar-auth-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (window.wpApp.currentUser) _showProfileMenu();
    else authModal.show();
  });
}

function _showProfileMenu() {
  document.getElementById('profile-menu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'profile-menu';
  menu.style.cssText = 'position:fixed;top:64px;right:12px;z-index:2000;background:white;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15);min-width:160px;font-family:"Inter Tight",system-ui,sans-serif;';
  const user = window.wpApp.currentUser;
  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario';
  menu.innerHTML = `
    <div style="padding:14px 16px 10px;border-bottom:1px solid #f3f4f6;">
      <div style="font-size:13px;font-weight:700;color:#111;">${name}</div>
      <div style="font-size:11px;color:#9ca3af;">${user?.email || ''}</div>
    </div>
    <div id="pm-logout" style="padding:13px 16px;font-size:14px;font-weight:600;cursor:pointer;color:#ef4444;">🚪 Cerrar sesión</div>`;
  menu.querySelector('#pm-logout').addEventListener('click', async () => {
    await AuthService.logout(); window.wpApp._cachedAvatarUrl = ''; menu.remove();
  });
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 100);
  document.body.appendChild(menu);
}

// ── SuperUserPanel ────────────────────────────────────────────────────
function mountSuperPanel(mv) {
  if (window.wpApp.superPanel) return;
  const sp = new SuperUserPanel(mv, {
    onLandmarksUpdated: (items) => mv._renderLandmarks(items),
  });
  sp.mount();
  window.wpApp.superPanel = sp;
  console.log('✅ SuperUserPanel montado');
}

// ── Categorías + SubcategoryRow ───────────────────────────────────────
function setupCategories(mv) {
  // SubcategoryRow — necesita el map para GPS/Live
  const subcatRow = new SubcategoryRow({
    map: mv.getMap(),
    onSubcatSelect: (value) => {
      const counter = document.getElementById('map-results-count');
      if (value === 'all') {
        mv.markerEls.forEach(el => el.style.display = '');
        if (counter) counter.textContent = `${mv.allPlaces.length} lugares`;
        return;
      }
      let visible = 0;
      mv.allPlaces.forEach((place, i) => {
        const types = (place.types || []).join(' ').toLowerCase();
        const name  = (place.name  || '').toLowerCase();
        const match = types.includes(value) || name.includes(value);
        if (mv.markerEls[i]) mv.markerEls[i].style.display = match ? '' : 'none';
        if (match) visible++;
      });
      if (counter) counter.textContent = `${visible} lugares`;
    },
  });
  window.wpApp.subcatRow = subcatRow;

  // Chips de categoría principal
  document.querySelectorAll('.category-footer-chip').forEach(chip => {
    chip.querySelectorAll('*').forEach(el => el.style.pointerEvents = 'none');
    chip.addEventListener('click', async (e) => {
      e.stopPropagation();
      const menuKey  = chip.dataset.menuKey;
      const isActive = chip.classList.contains('active');
      document.querySelectorAll('.category-footer-chip').forEach(c => c.classList.remove('active'));
      if (isActive) {
        mv._clearPlaceMarkers(); mv.currentCatId = null;
        subcatRow.hide();
        const counter = document.getElementById('map-results-count');
        if (counter) counter.textContent = '';
        return;
      }
      chip.classList.add('active');
      subcatRow.showLoading(menuKey);
      const counter = document.getElementById('map-results-count');
      if (counter) counter.textContent = 'Cargando...';
      await mv.loadCategory(menuKey);
      if (counter) counter.textContent = `${mv.allPlaces.length} lugares`;
      subcatRow.showSubcats(menuKey);
    });
  });
}

// ── Búsqueda ──────────────────────────────────────────────────────────
function setupSearch(mv) {
  const input = document.getElementById('map-search-global-input');
  if (!input) return;
  input.readOnly = false;
  input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const counter = document.getElementById('map-results-count');
    if (!q) {
      mv.markerEls.forEach(el => el.style.display = '');
      if (counter) counter.textContent = mv.allPlaces.length > 0 ? `${mv.allPlaces.length} lugares` : '';
      return;
    }
    mv.allPlaces.forEach((place, i) => {
      const match = (place.name || '').toLowerCase().includes(q)
        || (place.formattedAddress || place.formatted_address || '').toLowerCase().includes(q);
      if (mv.markerEls[i]) mv.markerEls[i].style.display = match ? '' : 'none';
    });
    const visible = mv.allPlaces.filter(p => (p.name||'').toLowerCase().includes(q)).length;
    if (counter) counter.textContent = `${visible} resultados`;
  });
}

// ── Actividades ───────────────────────────────────────────────────────
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
// MAIN
// ════════════════════════════════════════════════════════════════════
(async () => {
  try {
    console.log('🚀 WhatsPlan iniciando...');
    await waitForMapLibre();
    console.log('✅ MapLibre listo');

    await loadConfig();
    initSupabase();

    AuthService.onAuthChange(async (event, user) => {
      console.log('🔐 Auth:', event, user?.email || 'sin sesión');
      window.wpApp.currentUser = user;
      await renderAuthButton(user);
      if (user && isSuperUser(user.id)) mountSuperPanel(window.wpApp.mapView);
      if (!user && window.wpApp.superPanel) {
        window.wpApp.superPanel.unmount();
        window.wpApp.superPanel = null;
        window.wpApp._cachedAvatarUrl = '';
      }
    });

    console.log('🗺️ Creando MapView...');
    const mv = new MapView();
    window.wpApp.mapView = mv;
    mv.onPlaceSelect = (place) => console.log('📍 PlaceSheet TODO:', place.name);
    console.log('✅ MapView creado');

    // SubcategoryRow necesita el mapa listo — esperar el evento load
    mv.getMap().on('load', () => {
      setupCategories(mv);
    });

    const authModal = new AuthModal({
      onAuthSuccess: async (user) => {
        window.wpApp.currentUser = user;
        await renderAuthButton(user);
        if (isSuperUser(user?.id)) mountSuperPanel(mv);
      },
    });
    window.wpApp.authModal = authModal;

    setupTopBar(authModal);
    setupSearch(mv);
    setupActivitySubscription(mv);
    renderAuthButton(null);

    console.log('✅ WhatsPlan listo');
  } catch(err) {
    console.error('❌ Error crítico:', err.message, err.stack);
  }
})();
