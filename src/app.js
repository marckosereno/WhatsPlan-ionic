// WHATSPLAN — app.js
import { MapView }          from '/src/components/MapView.js';
import { AuthModal }        from '/src/components/AuthModal.js';
import { SubcategoryRow }   from '/src/components/SubcategoryRow.js';
import { initSupabase, AuthService, ActivityService } from '/src/services/SupabaseService.js';
import { getCategories }    from '/src/services/CategoryService.js';

window.wpApp = { mapView: null, currentUser: null, subcatRow: null };

async function renderMapCategories() {
  const cats = await getCategories();
  const container = document.getElementById('map-categories-footer');
  if (!container) return;
  container.innerHTML = '';
  
  const counts = {};
  try {
    const res = await fetch('/api/airtable-places?summary=true');
    const data = await res.json();
    if (data.success) data.counts.forEach(c => counts[c.category] = c.count);
  } catch(_) {}

  cats.forEach(cat => {
    const count = counts[cat.key] || 0;
    const chip = document.createElement('button');
    chip.className = 'category-footer-chip';
    chip.dataset.menuKey = cat.key;
    chip.innerHTML = `
      <div class="category-icon-circle">
        ${count > 0 ? `<div class="category-count-badge">${count} lugares</div>` : ''}
        <img src="${cat.icon3d_url}" class="category-icon-3d">
      </div>
      <span class="category-name">${cat.label_es}</span>`;
    container.appendChild(chip);
  });
  setupCategoryListeners(window.wpApp.mapView);
}

function setupCategoryListeners(mv) {
  document.querySelectorAll('.category-footer-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const menuKey = chip.dataset.menuKey;
      document.querySelectorAll('.category-footer-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      await mv.loadCategory(menuKey);
      window.wpApp.subcatRow?.showSubcats(menuKey);
    });
  });
}

function setupSearch(mv) {
  const floatBtn = document.getElementById('floating-search-btn');
  const overlay = document.getElementById('global-search-overlay');
  const input = document.getElementById('map-search-global-input');
  
  floatBtn.addEventListener('click', () => { overlay.style.display = 'flex'; input.focus(); });
  document.getElementById('close-search-overlay').addEventListener('click', () => { overlay.style.display = 'none'; });
  
  input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    mv.allPlaces.forEach((p, i) => {
      const match = p.name.toLowerCase().includes(q);
      if (mv.markerEls[i]) mv.markerEls[i].style.display = match ? '' : 'none';
    });
  });
}

(async () => {
  initSupabase();
  const mv = new MapView();
  window.wpApp.mapView = mv;
  
  mv.getMap().on('load', () => {
    window.wpApp.subcatRow = new SubcategoryRow({ map: mv.getMap(), onSubcatSelect: (val) => {
      mv.allPlaces.forEach((p, i) => {
        const match = val === 'all' || p.subcategoryTags?.includes(val);
        if (mv.markerEls[i]) mv.markerEls[i].style.display = match ? '' : 'none';
      });
    }});
    renderMapCategories();
    setupSearch(mv);
  });
})();
