// ====================================================================
// WHATSPLAN — app.js
// ====================================================================

import { MapView }          from '/src/components/MapView.js';
import { AuthModal }        from '/src/components/AuthModal.js';
import { SuperUserPanel }   from '/src/components/SuperUserPanel.js';
import { SubcategoryRow }   from '/src/components/SubcategoryRow.js';
import { initSupabase, AuthService, ActivityService, ProfileService } from '/src/services/SupabaseService.js';
import { isSuperUser }      from '/src/services/SuperUserService.js';
import { getCategories }    from '/src/services/CategoryService.js';
import { initIOSFixes }     from '/src/utils/ios-fixes.js';
import { initLiquidGlass, updateLGParam, getLGParams } from '/src/utils/liquid-glass.js';
import { LiquidGlassPanel } from '/src/components/LiquidGlassPanel.js';
import { initWpTap }        from '/src/utils/wp-tap.js';
import { PlaceModal }       from '/src/components/PlaceModal.js';
import { SearchBar }        from '/src/components/SearchBar.js';
import { animatePanelIn, animateChipsIn, animateChipTap, animateAvatarSwap } from '/src/utils/animations.js';
import { appState }         from '/src/state/AppState.js';

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

// ── Categorías desde Supabase ─────────────────────────────────────────
async function renderMapCategories() {
  try {
    // Obtener categorías y conteos en paralelo — sin tocar el DOM hasta tenerlos
    const [cats, counts] = await Promise.all([
      getCategories(),
      fetch('/api/airtable-places?summary=true')
        .then(r => r.json())
        .then(data => {
          const map = {};
          if (data.success) data.counts.forEach(c => map[c.category] = c.count);
          return map;
        })
        .catch(() => ({})),
    ]);

    const container = document.getElementById('map-categories-footer');
    if (!container || !cats.length) return;

    // Construir todos los chips antes de tocar el DOM
    const fragment = document.createDocumentFragment();
    cats.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'category-footer-chip';
      chip.dataset.menuKey = cat.key;
      const icon3d = cat.icon3d_url || '';
      const emoji  = cat.emoji || '';
      const label  = cat.label_es || cat.key;
      const count  = counts[cat.key] || 0;

      chip.innerHTML = `
        <div class="category-icon-circle loading">
          ${count > 0 ? `<div class="category-count-badge">${count} lugares</div>` : ''}
          ${icon3d
            ? `<img src="${icon3d}" class="category-icon-3d"
                onload="this.closest('.category-icon-circle').classList.remove('loading')"
                onerror="this.style.display='none';this.closest('.category-icon-circle').classList.remove('loading')" alt="">`
            : `<span class="category-icon">${emoji}</span>`}
        </div>
        <span class="category-name">${label}</span>`;
      fragment.appendChild(chip);
    });

    // Swap atómico: un solo repaint, sin frame vacío
    container.innerHTML = '';
    container.appendChild(fragment);
    // Cachear categorías para el SearchBar
    window.wpApp._categories = cats.map(function(cat) {
      return { key: cat.key, label_es: cat.label_es || cat.key, emoji: cat.emoji || '', icon3d_url: cat.icon3d_url || '' };
    });
    console.log('✅ ' + cats.length + ' categorías desde Supabase');
  } catch(err) {
    console.warn('⚠️ renderMapCategories:', err.message);
  }
}

// ── Avatar ────────────────────────────────────────────────────────────
async function renderAuthButton(user) {
  const btn = document.getElementById('topbar-auth-btn');
  if (!btn) return;
  // Si el botón está oculto por la búsqueda, no tocar nada
  if (btn.dataset.wpHidden === '1') return;
  btn.classList.remove('avatar-skeleton');

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
      if (profile?.avatar_url) {
        avatarUrl = profile.avatar_url;
        window.wpApp._cachedAvatarUrl = avatarUrl;
      }
    } catch(_) {}
  }

  if (avatarUrl) {
    // Precargar imagen antes de mostrar — evita flash de icono
    const img = new Image();
    img.onload = function() {
      btn.classList.remove('avatar-skeleton');
      btn.style.border = '2px solid rgba(255,255,255,0.7)';
      btn.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;overflow:hidden;"><img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>`;
    };
    img.onerror = function() {
      btn.classList.remove('avatar-skeleton');
      btn.style.border = '2.5px dashed var(--wp-blue,#2563eb)';
      btn.innerHTML = `<img src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Ghost/3D/ghost_3d.png" style="width:26px;height:26px;object-fit:contain;" onerror="this.outerHTML='👻'"><span style="position:absolute;bottom:-6px;right:-4px;background:var(--wp-blue,#2563eb);color:white;border-radius:50%;width:16px;height:16px;font-size:9px;font-weight:800;line-height:16px;text-align:center;border:1.5px solid white;">+</span>`;
    };
    img.src = avatarUrl;
    // Mantener skeleton mientras carga
    return;
  } else {
    btn.classList.remove('avatar-skeleton');
    btn.style.border = '2.5px dashed var(--wp-blue,#2563eb)';
    btn.innerHTML = `<img src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Ghost/3D/ghost_3d.png" style="width:26px;height:26px;object-fit:contain;" onerror="this.outerHTML='👻'"><span style="position:absolute;bottom:-6px;right:-4px;background:var(--wp-blue,#2563eb);color:white;border-radius:50%;width:16px;height:16px;font-size:9px;font-weight:800;line-height:16px;text-align:center;border:1.5px solid white;">+</span>`;
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
    await AuthService.logout();
    window.wpApp._cachedAvatarUrl = '';
    menu.remove();
  });
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 100);
  document.body.appendChild(menu);
}

// ── SuperUserPanel ────────────────────────────────────────────────────
function mountSuperPanel(mv) {
  if (window.wpApp.superPanel) return;
  const sp = new SuperUserPanel(mv, {
    onLandmarksUpdated:  (items) => mv._renderLandmarks(items),
    onCategoriesUpdated: () => renderMapCategories().then(() => setupCategories(mv)),
  });
  sp.mount();
  window.wpApp.superPanel = sp;
  console.log('✅ SuperUserPanel montado');
}

// ── Filtro de subcategoría ────────────────────────────────────────────
function filterBySubcat(mv, subcatValue) {
  const counter = document.getElementById('map-results-count');

  if (!subcatValue || subcatValue === 'all') {
    mv.markerEls.forEach(el => el.style.display = '');
    if (counter) counter.textContent = `${mv.allPlaces.length} lugares`;
    return;
  }

  let visible = 0;
  mv.allPlaces.forEach((place, i) => {
    // Soportar tanto array como string "tag1,tag2" (formato Supabase)
    let tags = place.subcategoryTags || place.subcategory_tags || '';
    if (typeof tags === 'string') {
      tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    const match = tags.some(tag => tag.toLowerCase() === subcatValue.toLowerCase());
    if (mv.markerEls[i]) mv.markerEls[i].style.display = match ? '' : 'none';
    if (match) visible++;
  });

  if (counter) counter.textContent = `${visible} lugares`;
  console.log(`🔍 Subcat "${subcatValue}": ${visible} lugares`);
}

// ── Categorías + SubcategoryRow ───────────────────────────────────────
function setupCategories(mv) {
  const container = document.getElementById('map-categories-footer');
  if (!container) return;

  // Limpiar cualquier estilo inline que GSAP haya dejado antes de clonar
  container.querySelectorAll('.category-footer-chip').forEach(function(c) {
    c.style.opacity = '';
    c.style.transform = '';
  });

  container.querySelectorAll('.category-footer-chip').forEach(chip => {
    const newChip = chip.cloneNode(true);
    chip.parentNode.replaceChild(newChip, chip);
    newChip.querySelectorAll('*').forEach(el => el.style.pointerEvents = 'none');

    newChip.addEventListener('click', async (e) => {
      e.stopPropagation();
      animateChipTap(newChip);
      const menuKey  = newChip.dataset.menuKey;
      const isActive = newChip.classList.contains('active');

      container.querySelectorAll('.category-footer-chip').forEach(c => c.classList.remove('active'));

      if (isActive) {
        mv._clearPlaceMarkers();
        mv.currentCatId = null;
        window.wpApp.subcatRow?.hide();
        const counter = document.getElementById('map-results-count');
        if (counter) counter.textContent = '';
        return;
      }

      newChip.classList.add('active');
      window.wpApp.subcatRow?.showLoading(menuKey);
      await mv.loadCategory(menuKey);
      window.wpApp.subcatRow?.showSubcats(menuKey);
    });
  });

  // Chips ya visibles — solo asegurar opacity:1 sin animación de posición
  Array.from(container.querySelectorAll('.category-footer-chip')).forEach(function(c) {
    c.style.opacity = '1';
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

    // iOS / Capacitor fixes — lo primero, antes de montar nada
    initIOSFixes();

    // Liquid Glass topbar
    setTimeout(() => {
      initLiquidGlass();
      window.wpLiquidGlass = { updateParam: updateLGParam, getParams: getLGParams };
      new LiquidGlassPanel();
    }, 200);

    // Pulse spring universal
    setTimeout(initWpTap, 400);

    // Forzar status bar icons oscuros (negros)
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      // Esperar a que Capacitor inicialice completamente antes de setear el style
      // Capacitor 7 — usar SystemBars si está disponible, sino StatusBar
      const setDarkIcons = () => {
        try {
          if (window.Capacitor.Plugins.SystemBars) {
            window.Capacitor.Plugins.SystemBars.setStyle({ style: 'LIGHT' });
          } else {
            window.Capacitor.Plugins.StatusBar.setStyle({ style: 'LIGHT' });
          }
        } catch(e) {}
      };
      // Aplicar inmediatamente y con delay para asegurar que Capacitor esté listo
      setDarkIcons();
      setTimeout(setDarkIcons, 300);
      setTimeout(setDarkIcons, 800);
      // Reforzar cada vez que la app vuelve al frente
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') setDarkIcons();
      });
      // Listener nativo de Capacitor
      try {
        window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
          if (state.isActive) setDarkIcons();
        });
      } catch(e) {}
    }

    await waitForMapLibre();
    console.log('✅ MapLibre listo');

    await loadConfig();
    initSupabase();

    AuthService.onAuthChange(async (event, user) => {
      console.log('🔐 Auth:', event, user?.email || 'sin sesión');
      window.wpApp.currentUser = user;
      appState.setUser(user);
      // No tocar el avatar si la búsqueda está activa
      var sb = window.wpApp && window.wpApp.searchBar;
      if (!sb || !sb.isActive()) {
        await renderAuthButton(user);
        animateAvatarSwap(document.getElementById('topbar-auth-btn'));
      }
      if (user && isSuperUser(user.id)) mountSuperPanel(window.wpApp.mapView);
      if (!user && window.wpApp.superPanel) {
        window.wpApp.superPanel.unmount();
        window.wpApp.superPanel = null;
        window.wpApp._cachedAvatarUrl = '';
        appState.clearUser();
      }
    });

    console.log('🗺️ Creando MapView...');
    const mv = new MapView();
    window.wpApp.mapView = mv;
    // onPlaceSelect se asigna en Promise.all cuando PlaceModal está listo
    console.log('✅ MapView creado');

    const authModal = new AuthModal({
      onAuthSuccess: async (user) => {
        window.wpApp.currentUser = user;
        await renderAuthButton(user);
        if (isSuperUser(user?.id)) mountSuperPanel(mv);
      },
    });
    window.wpApp.authModal = authModal;

    setupTopBar(authModal);
    setupActivitySubscription(mv);
    // No renderizar null — dejar skeleton hasta que auth resuelva

    // Esperar mapa + categorías juntos antes de crear SubcategoryRow.
    // Así los skeletons de ambas filas desaparecen al mismo tiempo, sin colapso.
    const mapReady  = new Promise(resolve => mv.getMap().on('load', resolve));
    const catsReady = renderMapCategories();

    Promise.all([mapReady, catsReady]).then(() => {
      // Panel ya visible desde el HTML — solo hacer setup de categorías
      setupCategories(mv);

      // PlaceModal — bottom sheet de detalles
      const placeModal = new PlaceModal({
        proxyPhoto: function(url) {
          return url ? '/api/photo-proxy?url=' + encodeURIComponent(url) : null;
        },
        getCurrentUser: function() { return window.wpApp.currentUser; }
      });
      window.wpApp.placeModal = placeModal;

      // Al tocar la minicard → abrir el modal de detalles
      mv.onPlaceSelect = function(place) {
        placeModal.show(place);
      };
      const subcatRow = new SubcategoryRow({
        map: mv.getMap(),
        onSubcatSelect: (value) => filterBySubcat(mv, value),
      });
      window.wpApp.subcatRow = subcatRow;

      // SearchBar — se crea aquí para tener acceso a mv y categories
      const searchBar = new SearchBar({
        mapView: mv,
        getCategories: function() { return window.wpApp._categories || []; },
        onCategorySelect: function(catKey) {
          // Simular tap en el chip de categoría correspondiente
          const container = document.getElementById('map-categories-footer');
          if (!container) return;
          const chip = container.querySelector('[data-menu-key="' + catKey + '"]');
          if (chip) chip.click();
        }
      });
      window.wpApp.searchBar = searchBar;

      const searchBtn = document.getElementById('topbar-search-btn');
      if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (searchBar.isActive()) searchBar.deactivate();
          else searchBar.activate();
        });
      }

      // +Actividad — función próximamente
      const actBtn = document.getElementById('topbar-activity-btn');
      if (actBtn) {
        actBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          console.log('+ Actividad — próximamente');
        });
      }

      // Mensajes — función próximamente
      const msgBtn = document.getElementById('topbar-messages-btn');
      if (msgBtn) {
        msgBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          console.log('Mensajes — próximamente');
        });
      }
    });

    // Trackear altura del teclado globalmente — antes de que Capacitor lo cierre
    window._wpLastKbH = 0;
    window._wpVvHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        var vvH = window.visualViewport.height;
        var kbH = Math.max(0, window.innerHeight - vvH);
        window._wpVvHeight = vvH;
        window._wpLastKbH  = kbH;
      });
    }
    // También trackear con focusin/focusout
    document.addEventListener('focusin', function(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        // Teclado va a abrirse — marcar flag
        window._wpKeyboardWasOpen = true;
      }
    }, true);
    document.addEventListener('focusout', function(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        // Teclado va a cerrarse
        setTimeout(function() { window._wpKeyboardWasOpen = false; }, 500);
      }
    }, true);

    // ── Cerrar minicard al abrir teclado — múltiples métodos ──────────
    var _forceCloseMiniCard = function() {
      var mv = window.wpApp && window.wpApp.mapView;
      if (!mv) return;
      if (typeof mv._closeMiniCard === 'function') {
        mv._closeMiniCard();
      } else if (mv.miniCardMarker) {
        var w = mv.miniCardMarker.getElement();
        if (w && w._savedPinHTML !== undefined) {
          w.style.width = '44px'; w.style.height = '44px';
          w.style.overflow = 'visible'; w.style.zIndex = '';
          w.style.marginTop = ''; w.innerHTML = w._savedPinHTML;
          delete w._savedPinHTML;
        }
        mv.miniCardMarker    = null; mv.miniCardIndex     = -1;
        mv.miniCardPlace     = null; mv._miniCardPinRoot  = null;
        mv._miniCardMarkerEl = null;
      }
    };

    // Método 1: visualViewport resize (Chrome)
    if (window.visualViewport) {
      var _lastKbH = 0;
      window.visualViewport.addEventListener('resize', function() {
        var kbH = window.innerHeight - window.visualViewport.height;
        if (kbH > 100 && _lastKbH <= 100) _forceCloseMiniCard();
        _lastKbH = kbH;
      });
    }

    // Método 2: focus en cualquier input (WebView y Chrome)
    document.addEventListener('focusin', function(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        // Pequeño delay para que el teclado empiece a subir
        setTimeout(_forceCloseMiniCard, 50);
        setTimeout(_forceCloseMiniCard, 200); // doble seguridad
      }
    }, true);

    // Método 3: polling activo cuando hay minicard abierta (WebView fallback)
    setInterval(function() {
      var mv = window.wpApp && window.wpApp.mapView;
      if (!mv || !mv.miniCardMarker) return;
      var vv  = window.visualViewport;
      var kbH = vv ? Math.max(0, window.innerHeight - vv.height) : 0;
      if (kbH > 100) _forceCloseMiniCard();
    }, 100);

    console.log('✅ WhatsPlan listo');
  } catch(err) {
    console.error('❌ Error crítico:', err.message, err.stack);
  }
})();