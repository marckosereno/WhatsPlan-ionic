// WHATSPLAN — app.js
import { MapView }          from '/src/components/MapView.js';
import { AuthModal }        from '/src/components/AuthModal.js';
import { SuperUserPanel }   from '/src/components/SuperUserPanel.js';
import { SubcategoryRow }   from '/src/components/SubcategoryRow.js';
import { initSupabase, AuthService, ActivityService, ProfileService } from '/src/services/SupabaseService.js';
import { isSuperUser }      from '/src/services/SuperUserService.js';
import { getCategories }    from '/src/services/CategoryService.js';

window.wpApp = {
  mapView: null, currentUser: null, activities: [], superPanel: null,
  authModal: null, subcatRow: null, _cachedAvatarUrl: '',
};

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

async function renderMapCategories() {
  try {
    const cats = await getCategories();
    const container = document.getElementById('map-categories-footer');
    if (!container || !cats.length) return;
    container.innerHTML = '';
    
    const counts = {};
    try {
      const res = await fetch('/api/airtable-places?summary=true');
      const data = await res.json();
      if (data.success) data.counts.forEach(c => counts[c.category] = c.count);
    } catch(_) {}

    cats.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'category-footer-chip';
      chip.dataset.menuKey = cat.key;
      const icon3d = cat.icon3d_url || '';
      const label  = cat.label_es || cat.key;
      const count  = counts[cat.key] || 0;

      chip.innerHTML = `
        <div class="category-icon-circle">
          ${count > 0 ? `<div class="category-count-badge">${count} lugares</div>` : ''}
          <img src="${icon3d}" class="category-icon-3d">
        </div>
        <span class="category-name">${label}</span>`;
      container.appendChild(chip);
    });
    setupCategories(window.wpApp.mapView);
  } catch(err) { console.warn('⚠️ renderMapCategories:', err.message); }
}

function setupCategories(mv) {
  const container = document.getElementById('map-categories-footer');
  if (!container) return;
  container.querySelectorAll('.category-footer-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const menuKey = chip.dataset.menuKey;
      const isActive = chip.classList.contains('active');
      container.querySelectorAll('.category-footer-chip').forEach(c => c.classList.remove('active'));
      if (isActive) {
        mv._clearPlaceMarkers(); mv.currentCatId = null;
        window.wpApp.subcatRow?.hide(); return;
      }
      chip.classList.add('active');
      await mv.loadCategory(menuKey);
      window.wpApp.subcatRow?.showSubcats(menuKey);
    });
  });
}

(async () => {
  try {
    console.log('🚀 WhatsPlan iniciando...');
    await waitForMapLibre();
    await loadConfig();
    initSupabase();

    AuthService.onAuthChange(async (event, user) => {
      window.wpApp.currentUser = user;
      if (user && isSuperUser(user.id)) mountSuperPanel(window.wpApp.mapView);
    });

    const mv = new MapView();
    window.wpApp.mapView = mv;
    
    mv.getMap().on('load', () => {
      window.wpApp.subcatRow = new SubcategoryRow({
        map: mv.getMap(),
        onSubcatSelect: (val) => {
          mv.allPlaces.forEach((p, i) => {
            const match = val === 'all' || p.subcategoryTags?.includes(val);
            if (mv.markerEls[i]) mv.markerEls[i].style.display = match ? '' : 'none';
          });
        }
      });
      renderMapCategories();
    });
  } catch(err) { console.error('❌ Error crítico:', err.message); }
})();

function mountSuperPanel(mv) {
  if (window.wpApp.superPanel) return;
  const sp = new SuperUserPanel(mv, {
    onLandmarksUpdated: (items) => mv._renderLandmarks(items),
    onCategoriesUpdated: () => renderMapCategories(),
  });
  sp.mount();
  window.wpApp.superPanel = sp;
}
