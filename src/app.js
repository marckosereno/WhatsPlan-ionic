// ===================================================================
// WHATSPLAN — app.js
// ====================================================================

import { MapView }          from '/src/components/MapView.js';
import { photoFull, photoSmall } from '/src/utils/photo-url.js';
import { MiniProfile }      from '/src/components/MiniProfile.js';
import { VisitService }     from '/src/services/VisitService.js';
import { buildFog, drawFog, removeFog } from '/src/utils/explore-fog.js';
import { getAvatarUrl }     from '/src/services/AvatarService.js';
import { AuthModal }        from '/src/components/AuthModal.js';
import { SuperUserPanel }   from '/src/components/SuperUserPanel.js';
import { SubcategoryRow }   from '/src/components/SubcategoryRow.js';
import { initSupabase, AuthService, ActivityService, ProfileService } from '/src/services/SupabaseService.js';
import { isSuperUser }      from '/src/services/SuperUserService.js';
import { getCategories }    from '/src/services/CategoryService.js';
import { initIOSFixes }     from '/src/utils/ios-fixes.js';
import { initLiquidGlass } from '/src/utils/liquid-glass.js';
import { FooterMenu }      from '/src/components/FooterMenu.js';
import { initWpTap }        from '/src/utils/wp-tap.js';
import { PlaceModal } from '/src/components/PlaceModal2.js';
import { ActivityModal }    from '/src/components/ActivityModal.js';
import { ProfileSheet }     from '/src/components/ProfileSheet.js';
import { MomentsUI }        from '/src/components/MomentsUI.js';
import { setMapTint }       from '/src/utils/map-tint.js';
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
    if (window.wpApp.currentUser) _getProfileSheet().open();
    else authModal.show();
  });
}

// ── Perfil (hoja sobre el mapa) ───────────────────────────────────────
// Abrir el perfil de alguien desde la ficha ("Lo guardaron"): por encima
// de la ficha (que vive en z-index 1500000)
window.wpApp.openProfile = (uid) => {
  const ps = _getProfileSheet();
  ps.open(uid);
  const el = document.getElementById('wp-pf');
  if (el && document.getElementById('wp-pm2')?.classList.contains('visible')) el.style.zIndex = '1500300';
};
function _getProfileSheet() {
  if (window.wpApp.profileSheet) return window.wpApp.profileSheet;
  const mv = () => window.wpApp.mapView;
  const ps = new ProfileSheet({
    getCurrentUser: () => window.wpApp.currentUser,
    getPlaceModal:  () => window.wpApp.placeModal,
    proxyPhoto: (url) => photoSmall(url), // portadas chicas del perfil: miniatura si existe
    onOpenPlace: (place) => {
      const pm = window.wpApp.placeModal;
      if (!pm) return;
      pm._fromSearch = false;
      pm.show(place);
    },
    onShowOnMap: (places, label, opts) => showPlacesOnMap(mv(), places, label, opts),
    onOpenActivity: (act) => {
      const map = mv()?.getMap?.();
      if (map && act?.lat && act?.lng) map.flyTo({ center: [act.lng, act.lat], zoom: 16, essential: true });
    },
    onLogout: async () => {
      await AuthService.logout();
      window.wpApp._cachedAvatarUrl = '';
    },
    onAvatarChanged: (url) => {
      window.wpApp._cachedAvatarUrl = url;
      renderAuthButton(window.wpApp.currentUser);
      window.wpApp.placeModal?._paintMyAvatar?.(); // la ficha también hereda la foto nueva
    },
  });
  window.wpApp.profileSheet = ps;
  return ps;
}

// "Ver en el mapa" desde el perfil (todos tus guardados o una colección):
// el mapa muestra SOLO esos lugares y arriba aparece un chip para salir y
// volver a la categoría en la que estabas.
// También disponible para la ficha ("Ver todos en el mapa" de Lugares similares)
window.wpApp.showPlacesOnMap = (places, label, opts) => showPlacesOnMap(window.wpApp.mapView, places, label, opts);
// Modo "solo esta colección": el mapa muestra ÚNICAMENTE esos lugares y
// se esconde todo lo demás (topbar, paneles, categorías, menú, landmarks,
// actividades, momentos). Abajo queda una píldora con fotos + "N lugares"
// (tocarla vuelve a encuadrar todos) y una X que regresa a la pantalla
// anterior (opts.onBack) y deja el mapa como estaba.
function showPlacesOnMap(mv, places, label, opts = {}) {
  if (!mv || !places?.length) return;
  window.wpApp._focusExit?.(false, true); // si ya había uno abierto, cerrarlo sin regresar
  // Cerrar TODO lo que esté encima del mapa: la ficha (si el perfil se
  // abrió desde ella), el mini perfil y hojas sueltas. Así el mapa con
  // los lugares queda a la vista de inmediato.
  try {
    const pm = window.wpApp.placeModal;
    if (pm?._el?.classList.contains('visible')) pm.hide();
  } catch (_) {}
  window.wpApp.miniProfile?.close?.(true);
  ['wp-pm2-sim', 'wp-pm2-menu-sheet', 'wp-saved-chip'].forEach(id => document.getElementById(id)?.remove());
  const pf = document.getElementById('wp-pf');
  if (pf) pf.style.zIndex = ''; // al regresar, el perfil ya no necesita ir encima de la ficha
  if (!('_savedPrevCat' in window.wpApp)) window.wpApp._savedPrevCat = mv.currentCatId || null;
  mv._clearPlaceMarkers();
  mv.allPlaces = places.slice();
  mv._mixedCats = true; // cada pin con el ícono de SU categoría
  mv._renderPlaceMarkers(mv.allPlaces);
  document.body.classList.add('wp-focus-map');

  const map = mv.getMap?.() || mv.map;
  // Fase 2: "Explora tu ciudad" — niebla de hexágonos sobre la ciudad
  const explore = opts.mode === 'explore';
  const fog = explore ? buildFog(places) : null;
  const fit = (animate = true) => {
    if (fog) {
      map?.fitBounds?.(fog.bounds(), { padding: { top: 150, bottom: 170, left: 24, right: 24 }, maxZoom: 16.5, duration: animate ? 700 : 0 });
      return;
    }
    const pts = places.map(p => [Number(p.lng ?? p.location?.lng), Number(p.lat ?? p.location?.lat)]).filter(([x, y]) => isFinite(x) && isFinite(y));
    if (!map || !pts.length) return;
    if (pts.length === 1) { map.flyTo({ center: pts[0], zoom: 17, essential: true, animate }); return; }
    const b = pts.reduce((bb, pt) => bb.extend(pt), new maplibregl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b, { padding: { top: 110, bottom: 190, left: 60, right: 60 }, maxZoom: 17.2, duration: animate ? 700 : 0 });
  };
  setTimeout(() => fit(true), 60);

  // ── Pantalla de reto (gamificación fase 1) ─────────────────────────
  // Arriba: título grande con contorno (nombre de la colección) + píldora
  // "Cerrar". Abajo: chips (siguiente lugar / de quién es) y la barra:
  // se va llenando de azul con el progreso, fotos de la colección, tu
  // avatar grande al centro y el % completado.
  const ph = places.map(p => photoSmall(p.photosUrls?.[0] || p.photoUrl || p.photo_url || '')).filter(Boolean).slice(0, 3);
  // Fuente del título (Anton, condensada y gruesa) — se carga una sola vez
  if (!document.getElementById('wp-font-anton')) {
    const lk = document.createElement('link');
    lk.id = 'wp-font-anton'; lk.rel = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=Anton&display=swap';
    document.head.appendChild(lk);
  }
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hasChoices = opts.mode !== 'explore' && (opts.choices || []).length > 1;
  const ids = places.map(p => String(p.place_id || p.placeId || p.id)).filter(Boolean);
  const total = ids.length;
  const me = window.wpApp.currentUser;
  const myAv = window.wpApp._cachedAvatarUrl || me?.user_metadata?.avatar_url ||
    getAvatarUrl(me?.user_metadata?.display_name || me?.email?.split('@')[0] || 'user');
  // Título: el emoji (si lo hay) va aparte, chiquito, para que el contorno se vea limpio
  const raw = String(label || 'Colección').trim();
  const em = (raw.match(/^(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*)\s*/u) || [])[1] || '';
  const title = raw.slice(em.length).trim() || raw;

  document.getElementById('wp-focus-top')?.remove();
  document.getElementById('wp-focus-bar')?.remove();
  const top = document.createElement('div');
  top.id = 'wp-focus-top';
  // Ya no hay título arriba: la colección se identifica por su emoji en el
  // cluster de la barra (y ahí mismo se cambia de colección)
  top.innerHTML = `
    <button type="button" class="wp-ft-back" aria-label="Volver">
      <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" style="transform:scaleX(-1);flex-shrink:0;"><path d="M464 256c0-114.87-93.13-208-208-208S48 141.13 48 256s93.13 208 208 208 208-93.13 208-208Zm-228.5 91.36a16 16 0 0 1-.09-22.63L303.58 272H170a16 16 0 0 1 0-32h133.58l-52.32-52.73A16 16 0 1 1 274 164.73l79.39 80a16 16 0 0 1 0 22.54l-79.39 80A16 16 0 0 1 235.5 347.36Z"/></svg>
      <span class="wp-ft-back-label">Volver</span>
    </button>`;
  document.body.appendChild(top);

  const chev = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  // Cluster: las fotos salen "explotando" desde el emoji de la colección,
  // que queda al frente. Sin emoji: solo las fotos en abanico
  const clusterEm = em || (explore ? '🧭' : opts.choiceKey === 'saved' ? '🔖' : '');
  const clusterInner = ph.map((u, i) => `<i class="p${i}" style="background-image:url('${esc(u)}')"></i>`).join('')
    + (clusterEm ? `<span class="wp-fb-emoji">${esc(clusterEm)}</span>` : '');
  const bar = document.createElement('div');
  bar.id = 'wp-focus-bar';
  bar.innerHTML = `
    <div class="wp-fb-chips">
      <button type="button" class="wp-fb-chip wp-fb-col${hasChoices ? '' : ' solo'}" aria-label="${esc(title)}${hasChoices ? ' · otras colecciones' : ''}"><span class="wp-fb-ct">${esc(explore ? 'Explora tu ciudad' : title)}</span>${hasChoices ? chev : ''}</button>
    </div>
    <div class="wp-fb-bar">
      <span class="wp-fb-fill" style="--p:0"></span>
      <button type="button" class="wp-fb-cluster${clusterEm ? ' is-emoji' : ''}" aria-label="Ver los lugares">${clusterInner}<span class="wp-fb-count">${chev}</span></button>
      <button type="button" class="wp-fb-me" aria-label="Ver todos">
        <span class="wp-fb-ring" style="--p:0"><span class="wp-fb-av" style="background-image:url('${esc(myAv)}')"></span></span>
        <span class="wp-fb-badge"><span class="wp-fb-n">0</span>/${explore ? (fog?.total || 0) : total}</span>
      </button>
      <span class="wp-fb-score"><b><span class="wp-fb-pct">0</span><small>%</small></b><em>${explore ? 'explorado' : 'completado'}</em></span>
    </div>`;
  document.body.appendChild(bar);
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.classList.add('in'); top.classList.add('in'); }));
  bar.querySelector('.wp-fb-me').onclick = () => { mv.haptic?.('light'); fit(true); };
  // Pill del título (arriba del avatar): las demás colecciones
  bar.querySelector('.wp-fb-col').onclick = () => { if (hasChoices) openFocusPicker(mv, opts); else mv.haptic?.('light'); };
  // Cluster (fotos + emoji, con flechita): lista de los lugares (con visitados)
  bar.querySelector('.wp-fb-cluster').onclick = () => openFocusPlaces(mv, places, visited, label, near, fog);

  // De quién es: @usuario, para el título de la hoja de colecciones
  // ("Colecciones de @x")
  const ownerUid = explore ? null : (opts.ownerId && opts.ownerId !== me?.id ? opts.ownerId : null);
  if (ownerUid) {
    import('/src/services/SocialService.js').then(({ SocialService }) => SocialService.getProfile(ownerUid)).then(pr => {
      if (!pr) return;
      const who = pr.username ? '@' + pr.username : (pr.name || '');
      opts.ownerName = who;
    }).catch(() => {});
  }

  // ── Termómetro "frío o caliente" (izquierda) ──────────────────────
  // Meta arriba: el lugar pendiente más cercano. Tu avatar en pill sube
  // por la barra conforme te acercas (escala logarítmica 2 km → 100 m).
  // A menos de 100 m: "¡Llegaste!" → abre la ficha para registrar visita.
  // Tu ubicación se sigue EN VIVO solo mientras estás en este mapa.
  const myPos = () => window.wpApp._focusPos?.pos || window.wpApp.subcatRow?._lastGpsPos || null;
  document.getElementById('wp-focus-thermo')?.remove();
  const thermo = document.createElement('div');
  thermo.id = 'wp-focus-thermo';
  thermo.hidden = true;
  thermo.innerHTML = `
    <div class="wp-th-track"><span class="wp-th-fill"></span>
      <button type="button" class="wp-th-goal" aria-label="Lugar más cercano"><i class="g1"></i><i class="g0"></i></button>
      <div class="wp-th-me">
        <svg class="wp-th-arrow" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.871 3.838C19.7933 3.42454 20.7382 4.36939 20.3247 5.29172L13.8301 19.7797C13.2154 21.1509 11.2904 21.2097 10.5931 19.8786L9.00442 16.8456C8.62675 16.1246 8.03812 15.536 7.31712 15.1583L4.28415 13.5696C2.95299 12.8723 3.01181 10.9473 4.38306 10.3326L18.871 3.838Z" fill="#fff" stroke="#fff" stroke-width="4.6" stroke-linejoin="round"/>
          <path class="wp-th-arrow-fill" d="M18.871 3.838C19.7933 3.42454 20.7382 4.36939 20.3247 5.29172L13.8301 19.7797C13.2154 21.1509 11.2904 21.2097 10.5931 19.8786L9.00442 16.8456C8.62675 16.1246 8.03812 15.536 7.31712 15.1583L4.28415 13.5696C2.95299 12.8723 3.01181 10.9473 4.38306 10.3326L18.871 3.838Z" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>`;
  document.body.appendChild(thermo);
  const LOG_FAR = Math.log(2000), LOG_NEAR = Math.log(100);
  let thBand = null, thTarget = null;
  let thPick = null;   // lugar elegido a mano en la lista (null = el más cercano)
  let thCands = [];    // pendientes con su distancia, del más cercano al más lejano
  const paintThermo = (best) => {
    if (!best) { thermo.hidden = true; thTarget = null; return; }
    thermo.hidden = false;
    const d = best.d;
    const t = Math.max(0, Math.min(1, (LOG_FAR - Math.log(Math.max(d, 100))) / (LOG_FAR - LOG_NEAR)));
    const arrived = d <= 100;
    // azul (lejos) → amarillo → rojo (cerca); verde al llegar
    // celeste (lejos) → azul (cerca); al llegar, azul intenso
    const lerp = (a, b) => Math.round(a + (b - a) * (arrived ? 1 : t));
    const hue = lerp(197, 224), sat = lerp(92, 90), lig = arrived ? 45 : lerp(66, 52);
    thermo.style.setProperty('--h', (t * 100).toFixed(1));
    thermo.style.setProperty('--c', `hsl(${hue} ${sat}% ${lig}%)`);
    thermo.classList.toggle('arrived', arrived);
    thermo.classList.toggle('full', t > 0.72); // la distancia (vertical) ya no cabe arriba del relleno
    const id = String(best.p.place_id || best.p.placeId || best.p.id);
    if (id !== thTarget) {
      thTarget = id;
      // Mini cluster: 2 fotos del lugar (si solo tiene una, va sola)
      const urls = [...new Set([...(best.p.photosUrls || []), best.p.photoUrl || best.p.photo_url].filter(Boolean))].slice(0, 2).map(photoSmall);
      ['g0', 'g1'].forEach((g, i) => {
        const el = thermo.querySelector('.wp-th-goal .' + g);
        el.style.backgroundImage = urls[i] ? `url('${urls[i].replace(/'/g, '%27')}')` : '';
        el.hidden = !urls[i] && i > 0;
      });
      thermo.classList.toggle('fogged', !!fog);
      thBand = null;
    }
    // Vibración suave al cruzar 1 km, 500 m, 200 m y 100 m (acercándote)
    const band = d <= 100 ? 4 : d <= 200 ? 3 : d <= 500 ? 2 : d <= 1000 ? 1 : 0;
    if (thBand !== null && band > thBand) mv.haptic?.(band === 4 ? 'action' : 'light');
    thBand = band;
    thermo.querySelector('.wp-th-goal').onclick = () => {
      mv.haptic?.('light');
      if (arrived) { mv.onPlaceSelect?.(best.p, { direct: true }); return; }
      // Llévame: ruta a este lugar (el mapa se acomoda a ti + el lugar);
      // sin GPS, como antes: solo acercarse al lugar
      if (myPos()) { thPick = best.id; startRoute(); }
      else map?.flyTo?.({ center: [best.c.lng, best.c.lat], zoom: Math.max(map.getZoom(), 16.5), essential: true, duration: 600 });
      const idx = (mv.allPlaces || []).indexOf(best.p);
      setTimeout(() => { try { if (idx >= 0) mv._showMiniCard(best.p, idx, best.p.photosUrls?.[0] || best.p.photoUrl || best.p.photo_url || null); } catch (_) {} }, 650);
    };
  };
  // Para la pestaña "Cerca de ti" de la hoja de lugares: pendientes por
  // distancia; el que elijas pasa al termómetro
  const near = {
    list: () => thCands,
    current: () => thTarget,
    hasPos: () => !!myPos(),
    // Elegido en "Cerca de ti": ese lugar (fijo) + ruta encendida
    pick: (id) => { thPick = id; startRoute(); },
  };

  // ── Tú en el mapa (solo con GPS) ───────────────────────────────────
  // Tu avatar (en sello) donde estás + la ruta a pie al lugar del
  // termómetro, con distancia y minutos. La ruta la da OSRM (OpenStreetMap,
  // gratis). Al moverte: si vas sobre la ruta, se recorta lo ya caminado
  // y se recalculan metros/minutos (sin pedir nada); si te sales de ella
  // (otro rumbo, >35 m), se pide una ruta nueva desde donde estás.
  // Mientras llega (o si falla) va una línea punteada directa.
  const ROUTE = 'wp-focus-route';
  let meMk = null, meEl = null, routeFor = '', routeAbort = null, routeFit = true;
  let route = null;      // { coords, dist, dur } la última ruta a pie
  let routeAsk = 0;      // cuándo se pidió la última (máx. 1 cada 8 s)
  const OFF_ROUTE = 35;  // m fuera de la línea = tomaste otro rumbo
  // La ruta arranca APAGADA. Se enciende por intención: elegir un lugar
  // en "Cerca de ti" o tocar las fotitos del termómetro. Se apaga con la
  // × de la etiqueta o sola al llegar (<100 m). Tocar en "Todos" no la toca.
  let routeOn = false;

  // ── Cómo vas: auto → mototaxi → moto → bici → a pie ───────────────
  // En el MAPA tú eres tu vehículo en 3D visto desde arriba (estilo
  // Bolt/Uber): gira hacia donde te mueves (o hacia el lugar si estás
  // quieto); tocarlo cambia de modo y recalcula ruta y minutos. En el
  // TERMÓMETRO va la flecha de navegación. Se recuerda el último modo.
  // Versiones anteriores: app.before-3d.js (línea), app.before-glyphs.js (emoji).
  // mpm = metros por minuto para el tiempo aproximado (sin ruta).
  // Mototaxi y moto: el servidor no tiene perfil propio → calles de auto.
  const MODES = {
    car:  { label: 'En auto',     osrm: 'routed-car',  mpm: 450, svg: '<svg viewBox="0 0 40 40"><defs><linearGradient id="wcB" x1="0" x2="1"><stop offset="0" stop-color="#0f3fb8"/><stop offset=".22" stop-color="#2b6cff"/><stop offset=".5" stop-color="#5b93ff"/><stop offset=".78" stop-color="#2b6cff"/><stop offset="1" stop-color="#0f3fb8"/></linearGradient><linearGradient id="wcG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2433"/><stop offset="1" stop-color="#3a4a66"/></linearGradient><linearGradient id="wcR" x1="0" x2="1"><stop offset="0" stop-color="#1e56e6"/><stop offset=".5" stop-color="#4a86ff"/><stop offset="1" stop-color="#1e56e6"/></linearGradient></defs><rect x="9.6" y="13.6" width="3.4" height="2.6" rx="1.2" fill="#123fa8"/><rect x="27" y="13.6" width="3.4" height="2.6" rx="1.2" fill="#123fa8"/><path d="M14.2 3.2h11.6c2.6 0 3.8 1.6 3.9 4.2l.4 24.4c0 3-1.6 5-4.4 5H14.3c-2.8 0-4.4-2-4.4-5l.4-24.4c.1-2.6 1.3-4.2 3.9-4.2z" fill="url(#wcB)"/><path d="M13.4 12.6c3.6-1.6 9.6-1.6 13.2 0l-1.2 5.2c-3.4-.9-7.4-.9-10.8 0z" fill="url(#wcG)"/><path d="M14.6 17.8c3.4-.8 7.4-.8 10.8 0v9.4c-3.4.7-7.4.7-10.8 0z" fill="url(#wcR)"/><path d="M14.6 27.2c3.4.7 7.4.7 10.8 0l.9 3.8c-4 1.1-8.6 1.1-12.6 0z" fill="url(#wcG)"/><path d="M12.6 13.4l1.8 4.3v9.6l-1.6 3.2zM27.4 13.4l-1.8 4.3v9.6l1.6 3.2z" fill="#24324d" opacity=".75"/><rect x="11.6" y="4" width="4.2" height="2" rx="1" fill="#fff6c2"/><rect x="24.2" y="4" width="4.2" height="2" rx="1" fill="#fff6c2"/><rect x="11.8" y="34.2" width="3.6" height="1.3" rx=".65" fill="#ff5a5a"/><rect x="24.6" y="34.2" width="3.6" height="1.3" rx=".65" fill="#ff5a5a"/><path d="M17 4.6c2-.5 4-.5 6 0" stroke="#fff" stroke-opacity=".55" stroke-width=".9" fill="none" stroke-linecap="round"/><path d="M18.2 19.5v6.4" stroke="#fff" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"/></svg>' },
    moto: { label: 'En mototaxi', osrm: 'routed-car',  mpm: 330, svg: '<svg viewBox="0 0 40 40"><defs><linearGradient id="wmC" x1="0" x2="1"><stop offset="0" stop-color="#c7861a"/><stop offset=".25" stop-color="#ffc83d"/><stop offset=".5" stop-color="#ffe27a"/><stop offset=".75" stop-color="#ffc83d"/><stop offset="1" stop-color="#c7861a"/></linearGradient><linearGradient id="wmT" x1="0" x2="1"><stop offset="0" stop-color="#0b0f17"/><stop offset=".5" stop-color="#3a4252"/><stop offset="1" stop-color="#0b0f17"/></linearGradient></defs><rect x="7.2" y="25.4" width="4.4" height="9.6" rx="2" fill="url(#wmT)"/><rect x="28.4" y="25.4" width="4.4" height="9.6" rx="2" fill="url(#wmT)"/><rect x="18" y="1.4" width="4" height="8" rx="2" fill="url(#wmT)"/><path d="M14.6 7.4h10.8l2.6 3.6H12z" fill="#d63a3a"/><path d="M12.2 10.6c0-1.4 1-2.2 2.4-2.2h10.8c1.4 0 2.4.8 2.4 2.2L29.6 31c.1 2.6-1.4 4.4-4 4.4H14.4c-2.6 0-4.1-1.8-4-4.4z" fill="url(#wmC)"/><path d="M13.4 11.6h13.2l.3 2.4H13.1z" fill="#1c2433" opacity=".8"/><path d="M15 16v16M20 16v16.6M25 16v16" stroke="#a96d0c" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/><path d="M16.4 9.6c2.4-.6 4.8-.6 7.2 0" stroke="#fff" stroke-opacity=".6" stroke-width=".9" fill="none" stroke-linecap="round"/><path d="M17.4 18v11" stroke="#fff" stroke-opacity=".45" stroke-width="1.3" stroke-linecap="round"/></svg>' },
    mbk:  { label: 'En moto',     osrm: 'routed-car',  mpm: 500, svg: '<svg viewBox="0 0 40 40"><defs><linearGradient id="wsB" x1="0" x2="1"><stop offset="0" stop-color="#b4141f"/><stop offset=".3" stop-color="#ef3b3b"/><stop offset=".5" stop-color="#ff7a6e"/><stop offset=".7" stop-color="#ef3b3b"/><stop offset="1" stop-color="#b4141f"/></linearGradient><linearGradient id="wsT" x1="0" x2="1"><stop offset="0" stop-color="#0b0f17"/><stop offset=".5" stop-color="#3a4252"/><stop offset="1" stop-color="#0b0f17"/></linearGradient><linearGradient id="wsS" x1="0" x2="1"><stop offset="0" stop-color="#141a24"/><stop offset=".5" stop-color="#3d4656"/><stop offset="1" stop-color="#141a24"/></linearGradient></defs><rect x="18.2" y="1.6" width="3.6" height="8.4" rx="1.8" fill="url(#wsT)"/><rect x="18.2" y="29.4" width="3.6" height="9" rx="1.8" fill="url(#wsT)"/><path d="M10.6 10.2h18.8" stroke="#2a3140" stroke-width="2" stroke-linecap="round"/><circle cx="10.4" cy="10.2" r="1.5" fill="#cfd6e2"/><circle cx="29.6" cy="10.2" r="1.5" fill="#cfd6e2"/><path d="M16.6 7.2c2.2-1 4.6-1 6.8 0l.8 7.2c.6 2.6 1 5 1 8.2v6.4c0 2.8-2.2 4.6-5.2 4.6s-5.2-1.8-5.2-4.6v-6.4c0-3.2.4-5.6 1-8.2z" fill="url(#wsB)"/><path d="M17.2 17.6h5.6c.9 0 1.5.6 1.5 1.5v8.6c0 1.8-1.8 3-4.3 3s-4.3-1.2-4.3-3v-8.6c0-.9.6-1.5 1.5-1.5z" fill="url(#wsS)"/><path d="M18.2 8.6c1.2-.4 2.4-.4 3.6 0" stroke="#fff" stroke-opacity=".6" stroke-width=".9" fill="none" stroke-linecap="round"/><rect x="18.8" y="5.6" width="2.4" height="1.4" rx=".7" fill="#fff6c2"/></svg>' },
    bike: { label: 'En bici',     osrm: 'routed-bike', mpm: 250, svg: '<svg viewBox="0 0 40 40"><defs><linearGradient id="wbT" x1="0" x2="1"><stop offset="0" stop-color="#0b0f17"/><stop offset=".5" stop-color="#454e60"/><stop offset="1" stop-color="#0b0f17"/></linearGradient><linearGradient id="wbF" x1="0" x2="1"><stop offset="0" stop-color="#0f8a6a"/><stop offset=".5" stop-color="#34d3a5"/><stop offset="1" stop-color="#0f8a6a"/></linearGradient><linearGradient id="wbS" x1="0" x2="1"><stop offset="0" stop-color="#141a24"/><stop offset=".5" stop-color="#4a5466"/><stop offset="1" stop-color="#141a24"/></linearGradient></defs><rect x="18.4" y="1.4" width="3.2" height="12" rx="1.6" fill="url(#wbT)"/><rect x="18.4" y="26.6" width="3.2" height="12" rx="1.6" fill="url(#wbT)"/><rect x="18.6" y="9" width="2.8" height="21" rx="1.4" fill="url(#wbF)"/><path d="M11.2 10.8c2.4-1.2 5-1.6 8.8-1.6s6.4.4 8.8 1.6" stroke="#2a3140" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="9.6" y="9.4" width="3" height="2.6" rx="1.2" fill="#1c2433"/><rect x="27.4" y="9.4" width="3" height="2.6" rx="1.2" fill="#1c2433"/><path d="M18.2 24.4c0-1.2.8-2 1.8-2s1.8.8 1.8 2v3.4c0 1-.8 1.6-1.8 1.6s-1.8-.6-1.8-1.6z" fill="url(#wbS)"/><path d="M15.4 19.6h9.2" stroke="#6b7280" stroke-width="1.6" stroke-linecap="round"/><rect x="13.6" y="18.6" width="2.6" height="2" rx=".8" fill="#1c2433"/><rect x="23.8" y="18.6" width="2.6" height="2" rx=".8" fill="#1c2433"/><path d="M19.4 11v17" stroke="#fff" stroke-opacity=".45" stroke-width=".8" stroke-linecap="round"/></svg>' },
    walk: { label: 'A pie',       osrm: 'routed-foot', mpm: 80,  svg: '<svg viewBox="0 0 40 40"><defs><radialGradient id="wpH" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#7a5640"/><stop offset="1" stop-color="#2b1a10"/></radialGradient><linearGradient id="wpS" x1="0" x2="1"><stop offset="0" stop-color="#0f3fb8"/><stop offset=".3" stop-color="#2b6cff"/><stop offset=".5" stop-color="#5b93ff"/><stop offset=".7" stop-color="#2b6cff"/><stop offset="1" stop-color="#0f3fb8"/></linearGradient><radialGradient id="wpA" cx=".4" cy=".4" r=".8"><stop offset="0" stop-color="#e9b38c"/><stop offset="1" stop-color="#b77a52"/></radialGradient></defs><ellipse class="wp-ft-l" cx="16.4" cy="12.6" rx="2.4" ry="3.6" fill="#1c2433"/><ellipse class="wp-ft-r" cx="23.6" cy="27.4" rx="2.4" ry="3.6" fill="#1c2433"/><ellipse cx="9.6" cy="22.4" rx="2.3" ry="3.4" fill="url(#wpA)"/><ellipse cx="30.4" cy="17.6" rx="2.3" ry="3.4" fill="url(#wpA)"/><path d="M10.4 20c0-3 4.2-4.8 9.6-4.8s9.6 1.8 9.6 4.8-4.2 4.8-9.6 4.8-9.6-1.8-9.6-4.8z" fill="url(#wpS)"/><circle cx="20" cy="19.4" r="4.6" fill="url(#wpH)"/><path d="M18 17.2c1-.8 2.4-.9 3.6-.4" stroke="#fff" stroke-opacity=".35" stroke-width=".9" fill="none" stroke-linecap="round"/></svg>' },
  };
  const ORDER = ['car', 'moto', 'mbk', 'bike', 'walk'];
  let mode = 'car';
  try { const m = localStorage.getItem('wpGoMode'); if (MODES[m]) mode = m; } catch (_) {}
  // Rumbo de la flecha del mapa:
  //  1) en movimiento (últimos 20 s): hacia donde vas (rumbo del GPS si da
  //     velocidad, si no el de tus últimos pasos ≥15 m)
  //  2) quieto: hacia el lugar (con ruta: hacia el siguiente tramo de la ruta)
  let myHd = null, myHdT = 0, hdPrev = null, hdShown = null;
  const brgTo = (a, b) => {
    const toR = x => x * Math.PI / 180, y = Math.sin(toR(b.lng - a.lng)) * Math.cos(toR(b.lat));
    const x = Math.cos(toR(a.lat)) * Math.sin(toR(b.lat)) - Math.sin(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.cos(toR(b.lng - a.lng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };
  // Gira tu vehículo en el mapa: tu rumbo menos lo que esté girado el mapa
  const paintHeading = () => {
    const v = meEl?.querySelector('.wp-me-veh');
    if (!v) return;
    let hd = myHd != null && Date.now() - myHdT < 20000 ? myHd : null;
    if (hd == null) {
      const p = myPos(), b = thCands.find(x => x.id === thTarget);
      if (p && b) {
        let to = b.c;
        if (routeOn && route?.coords?.length > 1) { // el punto de la ruta ~25 m adelante
          const n = nearestOnRoute(p, route.coords);
          let acc = 0, q = { lng: n.p[0], lat: n.p[1] };
          for (let i = n.i + 1; i < route.coords.length; i++) {
            const r = { lng: route.coords[i][0], lat: route.coords[i][1] };
            acc += distM(q, r); q = r;
            if (acc >= 25) break;
          }
          if (distM(p, q) > 3) to = q;
        }
        hd = brgTo(p, to);
      } else hd = myHd ?? 0;
    }
    // Ángulo en pantalla, por el camino más corto (sin dar la vuelta completa al pasar por el norte)
    const target = hd - (map?.getBearing?.() || 0);
    hdShown = hdShown == null ? target : hdShown + ((((target - hdShown) % 360) + 540) % 360 - 180);
    v.style.setProperty('--hd', `${hdShown}deg`);
  };
  const paintMode = () => {
    const v = meEl?.querySelector('.wp-me-veh');
    if (!v) return;
    v.innerHTML = MODES[mode].svg;
    meEl.dataset.mode = mode;
    meEl.setAttribute('aria-label', `${MODES[mode].label} · tocar para cambiar`);
    paintHeading();
  };
  const nextMode = () => {
    mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    try { localStorage.setItem('wpGoMode', mode); } catch (_) {}
    mv.haptic?.('light');
    paintMode();
    const v = meEl?.querySelector('.wp-me-veh');
    if (v) { v.classList.remove('swap'); void v.offsetWidth; v.classList.add('swap'); }
    showFocusBubble(bar, `<strong>${MODES[mode].label}</strong><span>Toca tu vehículo para cambiar</span>`, 'hint', 1300);
    route = null; routeFor = ''; // ruta y minutos de nuevo, para este modo
    paintProgress();
  };

  // Brújula: escondida; aparece (arriba a la derecha, bajo la campanita)
  // solo cuando giras el mapa y se esconde al volver al norte. Carátula
  // con N · E · S · O y rayitas en las diagonales. Gira con el mapa para que la N apunte siempre al
  // norte real; la letra hacia donde estás viendo (arriba de la pantalla)
  // sobresale. Al centro, la estrella fija = tu frente. Tocar → norte arriba.
  document.getElementById('wp-focus-compass')?.remove();
  const compass = document.createElement('button');
  compass.type = 'button';
  compass.id = 'wp-focus-compass';
  compass.setAttribute('aria-label', 'Brújula: tocar para poner el norte arriba');
  // Carátula: rayitas finas (las de N·E·S·O más largas) y un triángulo rojo
  // en el norte; gira con el mapa. Al centro, derecha y sin girar, la
  // dirección hacia donde ves (N, NE, E, SE, S, SO, O, NO).
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = i * 15, card = a % 90 === 0, mid = a % 45 === 0;
    if (a === 0) return '';
    const r1 = card ? 15.2 : mid ? 16.6 : 17.6, r2 = 19.6;
    const x = (r) => (23 + r * Math.sin(a * Math.PI / 180)).toFixed(2), y = (r) => (23 - r * Math.cos(a * Math.PI / 180)).toFixed(2);
    return `<line x1="${x(r1)}" y1="${y(r1)}" x2="${x(r2)}" y2="${y(r2)}" stroke="${card ? '#6b7280' : '#c3c8d0'}" stroke-width="${card ? 1.6 : 1}" stroke-linecap="round"/>`;
  }).join('');
  compass.innerHTML = `<svg class="wp-cp-dial" viewBox="0 0 46 46" aria-hidden="true">${ticks}<path d="M23 2.6 26.2 8.4H19.8z" fill="#ef4444"/></svg><b class="wp-cp-dir">N</b>`;
  document.body.appendChild(compass);
  const cpDir = compass.querySelector('.wp-cp-dir');
  let cpFacing = '', cpHideT = null;
  const paintNorth = () => {
    const b = map?.getBearing?.() || 0;            // hacia dónde ve la parte de arriba de la pantalla (0 = norte)
    compass.style.setProperty('--brg', `${-b}deg`);
    paintHeading();
    const h = ((b % 360) + 360) % 360;
    const facing = DIRS[Math.round(h / 45) % 8];
    if (facing !== cpFacing) {
      if (cpFacing && facing.length === 1) mv.haptic?.('tap'); // vibra al pasar por N, E, S u O
      cpFacing = facing;
      cpDir.textContent = facing;
      cpDir.classList.toggle('n', facing === 'N');
      cpDir.classList.toggle('two', facing.length > 1);
    }
    compass.classList.toggle('turned', Math.abs(b) > 1);
    // Mostrar al girar; esconder un momento después de volver al norte
    clearTimeout(cpHideT);
    if (Math.abs(b) > 2) compass.classList.add('show');
    else if (compass.classList.contains('show')) cpHideT = setTimeout(() => compass.classList.remove('show'), 700);
  };
  paintNorth();
  map?.on?.('rotate', paintNorth);
  compass.onclick = () => { mv.haptic?.('light'); map?.easeTo?.({ bearing: 0, pitch: 0, duration: 500 }); };
  const startRoute = () => { routeOn = true; routeFit = true; routeFor = ''; paintProgress(); };
  const stopRoute = () => { routeOn = false; thPick = null; paintProgress(); }; // vuelve al más cercano
  // Punto más cercano de la ruta: { off (m a la línea), i (tramo), p ([lng,lat]) }
  const nearestOnRoute = (pos, coords) => {
    const kx = 111320 * Math.cos(pos.lat * Math.PI / 180), ky = 110540;
    let best = { off: Infinity, i: 0, p: coords[0] };
    for (let i = 0; i < coords.length - 1; i++) {
      const ax = (coords[i][0] - pos.lng) * kx, ay = (coords[i][1] - pos.lat) * ky;
      const bx = (coords[i + 1][0] - pos.lng) * kx, by = (coords[i + 1][1] - pos.lat) * ky;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best.off) best = { off: d, i, p: [coords[i][0] + t * (coords[i + 1][0] - coords[i][0]), coords[i][1] + t * (coords[i + 1][1] - coords[i][1])] };
    }
    return best;
  };
  const lineLen = (cs) => { let m = 0; for (let i = 1; i < cs.length; i++) m += distM({ lng: cs[i - 1][0], lat: cs[i - 1][1] }, { lng: cs[i][0], lat: cs[i][1] }); return m; };
  const fmtD = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
  const fmtT = (s) => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  const routeData = (coords, kind) => ({ type: 'FeatureCollection', features: coords ? [{ type: 'Feature', properties: { k: kind }, geometry: { type: 'LineString', coordinates: coords } }] : [] });
  const ensureRoute = () => {
    if (!map?.getSource || map.getSource(ROUTE)) return !!map?.getSource;
    try {
      map.addSource(ROUTE, { type: 'geojson', data: routeData(null) });
      const lay = { 'line-cap': 'round', 'line-join': 'round' };
      map.addLayer({ id: ROUTE + '-case', type: 'line', source: ROUTE, filter: ['==', ['get', 'k'], 'walk'], layout: lay, paint: { 'line-color': '#ffffff', 'line-width': 9 } });
      map.addLayer({ id: ROUTE + '-walk', type: 'line', source: ROUTE, filter: ['==', ['get', 'k'], 'walk'], layout: lay, paint: { 'line-color': '#1a5cf5', 'line-width': 5 } });
      map.addLayer({ id: ROUTE + '-air', type: 'line', source: ROUTE, filter: ['==', ['get', 'k'], 'air'], layout: lay, paint: { 'line-color': '#1a5cf5', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [0.01, 2] } });
      return true;
    } catch (e) { console.warn('[DIAG-ROUTE] capa:', e.message || e); return false; }
  };
  const setRoute = (coords, kind) => { try { if (ensureRoute()) map.getSource(ROUTE).setData(routeData(coords, kind)); } catch (_) {} };
  const removeRoute = () => {
    routeAbort?.abort(); routeAbort = null;
    try { [ROUTE + '-air', ROUTE + '-walk', ROUTE + '-case'].forEach(l => map?.getLayer?.(l) && map.removeLayer(l)); if (map?.getSource?.(ROUTE)) map.removeSource(ROUTE); } catch (_) {}
  };
  const setChip = (txt) => {
    const c = meEl?.querySelector('.wp-me-chip');
    if (!c) return;
    c.querySelector('.wp-me-chip-t').textContent = txt || '';
    c.hidden = !txt;
    c.querySelector('.wp-me-x').hidden = !routeOn; // la × solo con ruta
    c.classList.toggle('route', routeOn);
  };
  const fitBoth = (a, b) => {
    try {
      map.fitBounds([[Math.min(a.lng, b.lng), Math.min(a.lat, b.lat)], [Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)]],
        { padding: { top: 150, bottom: 190, left: 70, right: 90 }, maxZoom: 17, duration: 700 });
    } catch (_) {}
  };
  const paintMe = (pos, best) => {
    if (!pos || !map || !window.maplibregl) return;
    if (!meMk) {
      meEl = document.createElement('div');
      meEl.className = 'wp-me-mk';
      meEl.innerHTML = `<span class="wp-me-pulse"></span><span class="wp-me-veh"></span>
        <span class="wp-me-chip" hidden><span class="wp-me-chip-t"></span><button type="button" class="wp-me-x" aria-label="Quitar ruta" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button></span>`;
      meEl.onclick = (e) => { e.stopPropagation(); nextMode(); }; // tocar tu vehículo: cambia de modo
      meEl.querySelector('.wp-me-x').onclick = (e) => { e.stopPropagation(); mv.haptic?.('light'); stopRoute(); };
      meMk = new window.maplibregl.Marker({ element: meEl, anchor: 'center' }).setLngLat([pos.lng, pos.lat]).addTo(map);
      paintMode();
    } else meMk.setLngLat([pos.lng, pos.lat]);
    paintHeading();
    // Sin lugar pendiente o ya llegaste: sin ruta
    if (!best || best.d <= 100) {
      if (best && routeOn) { routeOn = false; thPick = null; } // llegaste: la ruta se quita sola
      setRoute(null); setChip(best ? '¡Llegaste!' : ''); routeFor = ''; route = null; return;
    }
    if (!routeOn) { // ruta apagada: sin línea ni peticiones, solo la distancia
      routeAbort?.abort(); routeAbort = null;
      setRoute(null); route = null; routeFor = '';
      setChip(`${fmtD(best.d)} · ~${fmtT(best.d * 1.3 / MODES[mode].mpm * 60)}`);
      return;
    }
    const first = best.id !== routeFor;
    if (!first && route) {
      const n = nearestOnRoute(pos, route.coords);
      if (n.off <= OFF_ROUTE) {
        // Sobre la ruta: quitar lo ya caminado y actualizar lo que falta
        const rest = [[pos.lng, pos.lat], n.p, ...route.coords.slice(n.i + 1)];
        const left = lineLen(rest.slice(1)) + n.off;
        setRoute(rest, 'walk');
        setChip(`${fmtD(left)} · ${fmtT(route.dur * Math.min(1, left / Math.max(1, route.dist)))}`);
        return;
      }
      if (Date.now() - routeAsk < 8000) return; // otro rumbo: se recalcula (sin saturar)
      console.log(`[DIAG-ROUTE] fuera de la ruta (${Math.round(n.off)} m) → recalculando`);
    } else if (!first && Date.now() - routeAsk < 8000) return; // aún esperando la primera
    routeFor = best.id; routeAsk = Date.now();
    if (first) { // mientras llega la ruta: línea directa y tiempo aproximado (~80 m/min)
      route = null;
      setRoute([[pos.lng, pos.lat], [best.c.lng, best.c.lat]], 'air');
      setChip(`${fmtD(best.d)} · ~${fmtT(best.d * 1.3 / MODES[mode].mpm * 60)}`);
    }
    if (routeFit) { routeFit = false; fitBoth(pos, best.c); }
    routeAbort?.abort();
    const ac = routeAbort = new AbortController();
    const to = setTimeout(() => ac.abort(), 7000);
    const url = `https://routing.openstreetmap.de/${MODES[mode].osrm}/route/v1/driving/${pos.lng.toFixed(6)},${pos.lat.toFixed(6)};${best.c.lng.toFixed(6)},${best.c.lat.toFixed(6)}?overview=full&geometries=geojson`;
    fetch(url, { signal: ac.signal }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))).then(j => {
      const r = j?.routes?.[0];
      if (!r || ac !== routeAbort || routeFor !== best.id || !bar.isConnected || !routeOn) return;
      route = { coords: r.geometry.coordinates, dist: r.distance, dur: r.duration };
      setRoute(route.coords, 'walk');
      setChip(`${fmtD(r.distance)} · ${fmtT(r.duration)}`);
    }).catch(e => {
      if (ac !== routeAbort) return;
      console.log(`[DIAG-ROUTE] sin ruta (${mode}), queda la línea directa:`, e.message || e);
      if (route) return; // se queda la ruta anterior; se reintenta en el próximo movimiento
      setRoute([[pos.lng, pos.lat], [best.c.lng, best.c.lat]], 'air');
      setChip(`${fmtD(best.d)} · ~${fmtT(best.d * 1.3 / MODES[mode].mpm * 60)}`);
    }).finally(() => clearTimeout(to));
  };

  // Ubicación en vivo: se actualiza cuando te mueves ≥10 m; se pausa con
  // la app en segundo plano y se apaga al salir de este mapa
  let watchId = null, watchOn = false;
  const onPos = (lat, lng, c = {}) => {
    const prev = window.wpApp._focusPos?.pos;
    // Rumbo: el del GPS si vas a más de ~3 km/h; si no, el de tus últimos ≥15 m
    if (c.speed > 0.8 && isFinite(c.heading) && c.heading != null) { myHd = c.heading; myHdT = Date.now(); }
    else if (hdPrev && distM(hdPrev, { lat, lng }) >= 15) { myHd = brgTo(hdPrev, { lat, lng }); myHdT = Date.now(); hdPrev = { lat, lng }; }
    if (!hdPrev) hdPrev = { lat, lng };
    if (hdPrev && distM(hdPrev, { lat, lng }) >= 15) hdPrev = { lat, lng };
    if (prev && distM(prev, { lat, lng }) < 10) { paintHeading(); return; }
    window.wpApp._focusPos = { pos: { lat, lng }, t: Date.now() };
    if (bar.isConnected) paintProgress();
  };
  const startWatch = async () => {
    if (watchOn) return;
    watchOn = true;
    try {
      const G = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Geolocation;
      if (G) {
        const perm = await G.checkPermissions().catch(() => null);
        if (perm && perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          const r = await G.requestPermissions().catch(() => null);
          if (r && r.location !== 'granted' && r.coarseLocation !== 'granted') { console.log('[DIAG-NEXT] sin permiso de ubicación'); watchOn = false; return; }
        }
        if (!watchOn) return;
        const id = await G.watchPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }, (p, err) => {
          if (err || !p) { if (err) console.log('[DIAG-NEXT] ubicación:', err.message || err); return; }
          onPos(p.coords.latitude, p.coords.longitude, p.coords);
        });
        if (!watchOn) { Promise.resolve(G.clearWatch({ id })).catch(() => {}); return; }
        watchId = { G, id };
      } else if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(p => onPos(p.coords.latitude, p.coords.longitude, p.coords),
          e => console.log('[DIAG-NEXT] ubicación:', e.message), { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
        watchId = { id };
      }
      console.log('[DIAG-NEXT] siguiendo ubicación en vivo');
    } catch (e) { watchOn = false; console.log('[DIAG-NEXT] no se pudo seguir la ubicación:', e?.message || e); }
  };
  const stopWatch = () => {
    watchOn = false;
    if (!watchId) return;
    try { if (watchId.G) Promise.resolve(watchId.G.clearWatch({ id: watchId.id })).catch(() => {}); else navigator.geolocation.clearWatch(watchId.id); } catch (_) {}
    watchId = null;
    console.log('[DIAG-NEXT] ubicación en vivo apagada');
  };
  const onVis = () => { if (document.hidden) stopWatch(); else startWatch(); };
  document.addEventListener('visibilitychange', onVis);
  const distM = (a, b) => {
    const R = 6371000, toR = x => x * Math.PI / 180;
    const dLa = toR(b.lat - a.lat), dLo = toR(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const coordsOf = (p) => ({ lat: Number(p.lat ?? p.location?.lat), lng: Number(p.lng ?? p.location?.lng) });

  // Progreso: mis visitas de estos lugares + palomita en los pines visitados
  const visited = new Set();
  let lastPct = -1;
  let wasDone = null; // para celebrar solo cuando se completa en este momento
  const paintProgress = (celebrate = false) => {
    let n, pct, done;
    if (fog) {
      // Zonas destapadas de la ciudad
      const st = fog.stats(visited);
      n = st.open; pct = st.pct; done = st.total > 0 && st.open >= st.total;
      if (pct !== lastPct) { try { drawFog(map, fog.geojson(visited)); } catch (e) { console.warn('[DIAG-FOG]', e.message); } }
      lastPct = pct;
    } else {
      n = visited.size;
      pct = total ? Math.round(n / total * 100) : 0;
      done = total > 0 && n >= total;
    }
    bar.querySelector('.wp-fb-n').textContent = String(n);
    bar.querySelector('.wp-fb-pct').textContent = String(pct);
    bar.querySelector('.wp-fb-ring').style.setProperty('--p', String(pct));
    bar.querySelector('.wp-fb-fill').style.setProperty('--p', String(pct));
    bar.classList.toggle('complete', done);
    // ¡Completada! — solo si pasó ahora (no al entrar a una ya completa)
    if (done && wasDone === false && celebrate) {
      showFocusBubble(bar, fog
        ? `<b>🎉</b><strong>¡Exploraste toda la ciudad!</strong>`
        : `<b>🎉</b><strong>¡Colección completada!</strong><span>${total} de ${total} lugares visitados</span>`, 'done', 3200);
      // (los puntos de la colección se ven en el aviso de la ficha)
    }
    wasDone = done;
    // El pendiente más cercano a ti → termómetro
    const pos = myPos();
    thCands = [];
    if (pos && !done) {
      places.forEach(p => {
        const id = String(p.place_id || p.placeId || p.id);
        if (visited.has(id)) return;
        if (fog && !fog.inFog(p, visited)) return; // en explorar: solo lugares que siguen en la niebla
        const c = coordsOf(p);
        if (!isFinite(c.lat) || !isFinite(c.lng)) return;
        thCands.push({ p, d: distM(pos, c), c, id });
      });
      thCands.sort((a, b) => a.d - b.d);
    }
    // El elegido a mano (si sigue pendiente); si no, el más cercano
    if (thPick && !thCands.some(x => x.id === thPick)) thPick = null;
    const best = (thPick && thCands.find(x => x.id === thPick)) || thCands[0] || null;
    paintThermo(best);
    paintMe(pos, best);
    (mv.markerEls || []).forEach(el => {
      const id = String(el._place?.place_id || el._place?.placeId || el._place?.id || '');
      el.classList.toggle('wp-visited', visited.has(id));
      if (fog) el.classList.toggle('wp-fogged', !visited.has(id)); // en explorar: lo no visitado, apagado
    });
    if (celebrate) {
      mv.haptic?.(done ? 'action' : 'tap');
      const ring = bar.querySelector('.wp-fb-me');
      ring.classList.remove('pop'); void ring.offsetWidth; ring.classList.add('pop');
    }
  };
  paintProgress();
  startWatch();
  // [DIAG-MARKERS] Todo marker debe ser position:absolute; si alguno no,
  // se corre del mapa (y corre a los demás). Se revisa al entrar y al zoom.
  const diagMarkers = () => {
    const bad = [...document.querySelectorAll('.maplibregl-marker')].filter(el => getComputedStyle(el).position !== 'absolute');
    if (bad.length) console.warn('[DIAG-MARKERS] markers fuera de lugar (no absolute):', bad.length, bad.slice(0, 5).map(el => el.className));
    else console.log('[DIAG-MARKERS] ok, todos absolute');
  };
  setTimeout(diagMarkers, 1500);
  map?.once?.('zoomend', diagMarkers);
  requestAnimationFrame(() => requestAnimationFrame(() => thermo.classList.add('in')));
  // Explorar: ayuda solo mientras no tengas visitas (después de saberlo)
  const exploreHint = () => {
    if (fog && !visited.size && bar.isConnected) setTimeout(() => {
      if (!visited.size && bar.isConnected) showFocusBubble(bar, '<strong>Visita un lugar para destapar la niebla</strong><span>Cada lugar que visitas aclara su zona</span>', 'hint', 4200);
    }, 900);
  };
  if (me && total) {
    VisitService.myVisits(ids)
      .then(m => { m.forEach((v, id) => { if (v > 0) visited.add(id); }); paintProgress(); exploreHint(); loadFriends(); })
      .catch(e => { console.warn('[DIAG-VISIT] progreso:', e.message || e); loadFriends(); });
  } else exploreHint();

  // ── Amigos en la barra (fase 3) ────────────────────────────────────
  // Caritas de la gente que sigues sobre la barra, en el punto de SU
  // avance en esta colección (como carrera). Tocar → lista. Solo quien
  // muestra sus visitas (friends_progress en collection_friends.sql).
  let friends = [];
  const friendsBox = document.createElement('div');
  friendsBox.className = 'wp-fb-friends';
  bar.querySelector('.wp-fb-bar').appendChild(friendsBox);
  const paintFriends = () => {
    if (!friends.length) { friendsBox.innerHTML = ''; return; }
    // Agrupa a quienes van casi igual (cada 10%) para que no se encimen de más
    const groups = new Map();
    friends.forEach(f => {
      const pct = Math.min(100, Math.round(f.visited / Math.max(1, total) * 100));
      const k = Math.round(pct / 10);
      if (!groups.has(k)) groups.set(k, { pct, list: [] });
      groups.get(k).list.push(f);
    });
    friendsBox.innerHTML = [...groups.values()].map(g => {
      const faces = g.list.slice(0, 3).map(f => `<i style="background-image:url('${esc(f.avatar_url || getAvatarUrl(f.name || 'user'))}')"></i>`).join('');
      const more = g.list.length > 3 ? `<b>+${g.list.length - 3}</b>` : '';
      return `<button type="button" class="wp-fb-fr" style="--p:${g.pct}" aria-label="Amigos">${faces}${more}</button>`;
    }).join('');
    friendsBox.querySelectorAll('.wp-fb-fr').forEach(b => b.onclick = (e) => { e.stopPropagation(); openFriendsSheet(mv, friends, visited.size, total, title); });
  };
  async function loadFriends() {
    if (!me || !total) return;
    try {
      const { getSupabase } = await import('/src/services/SupabaseService.js');
      const { data, error } = await getSupabase().rpc('friends_progress', { p_place_ids: ids });
      if (error) throw error;
      if (!bar.isConnected) return;
      friends = (data || []).filter(f => f.user_id !== me.id);
      paintFriends();
      // "@ana te rebasó": solo la primera vez que alguien te pasa en esta colección
      const key = 'wpAhead:' + (opts.choiceKey || label);
      let before = [];
      try { before = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
      const ahead = friends.filter(f => f.visited > visited.size);
      const fresh = ahead.find(f => !before.includes(f.user_id));
      try { localStorage.setItem(key, JSON.stringify(ahead.map(f => f.user_id))); } catch (_) {}
      if (fresh && !bar.classList.contains('complete')) {
        const who = fresh.username ? '@' + fresh.username : (fresh.name || 'Un amigo');
        setTimeout(() => { if (bar.isConnected) showFocusBubble(bar, `<strong>${esc(who)} te rebasó</strong><span>${fresh.visited} de ${total} lugares</span>`, 'hint', 3400); }, 1400);
      }
    } catch (e) { console.warn('[DIAG-FRIENDS] avance de amigos:', e.message || e); }
  }
  // Si registra una visita (desde la ficha) mientras está en este modo
  const onVisit = (ev) => {
    const id = String(ev.detail?.place_id || '');
    if (!ids.includes(id) || visited.has(id)) return;
    visited.add(id);
    paintProgress(true);
    const pts = ev.detail?.points || 0; // fase 3 (puntos)
    if (fog) showFogBurst(bar, fog.stats(visited).pct, pts);
    else if (pts && !bar.classList.contains('complete')) showFocusBubble(bar, `<b>+${pts}</b><span>puntos</span>`, 'pts', 1900);
  };
  document.addEventListener('wp:visit', onVisit);
  // Los pines se pueden volver a crear (zoom, clusters): repintar palomitas
  const repaint = () => paintProgress();
  map?.on?.('moveend', repaint);

  const exit = (goBack = true, instant = false) => {
    if (window.wpApp._focusExit !== exit) return;
    window.wpApp._focusExit = null;
    document.removeEventListener('wp:focus-exit', onExt);
    document.removeEventListener('wp:visit', onVisit);
    map?.off?.('moveend', repaint);
    document.removeEventListener('visibilitychange', onVis);
    stopWatch();
    meMk?.remove(); meMk = null;
    removeRoute();
    map?.off?.('rotate', paintNorth);
    clearTimeout(cpHideT);
    compass.classList.remove('show');
    setTimeout(() => compass.remove(), instant ? 0 : 280);
    thermo.classList.remove('in');
    setTimeout(() => thermo.remove(), instant ? 0 : 280);
    (mv.markerEls || []).forEach(el => el.classList.remove('wp-visited', 'wp-fogged'));
    if (fog) removeFog(map);
    mv.haptic?.('light');
    bar.classList.remove('in');
    top.classList.remove('in');
    setTimeout(() => { bar.remove(); top.remove(); }, instant ? 0 : 280);
    document.body.classList.remove('wp-focus-map');
    mv._mixedCats = false;
    const prev = window.wpApp._savedPrevCat;
    if (!instant) delete window.wpApp._savedPrevCat; // cambio de colección: se conserva la categoría de antes
    document.getElementById('wp-focus-pick')?.remove();
    if (!instant) {
      if (prev) mv.loadCategory(prev);
      else { mv._clearPlaceMarkers(); mv.allPlaces = []; }
    }
    if (goBack && typeof opts.onBack === 'function') setTimeout(() => opts.onBack(), 120);
  };
  const onExt = () => exit(false);
  document.addEventListener('wp:focus-exit', onExt);
  window.wpApp._focusExit = exit;
  // "Volver" (el mismo de la ficha): se retrae al ícono y regresa a la pantalla anterior
  const backBtn = top.querySelector('.wp-ft-back');
  backBtn.onclick = () => {
    backBtn.classList.add('q');
    setTimeout(() => exit(true), 110);
  };

}

// ── "Explora Nuevo Progreso" (fase 2) ─────────────────────────────────
// Todos los lugares de la app con la niebla encima; tu % de la ciudad.
window.wpApp.openExplore = (opts = {}) => openExplore(window.wpApp.mapView, opts);
async function openExplore(mv, opts = {}) {
  if (!mv) return;
  if (!window.wpApp.currentUser) { window.wpApp.authModal?.show?.(); return; }
  let places = window.wpApp._allPlacesCache;
  if (!places) {
    try {
      const j = await (await fetch('/api/supabase-places?category=ALL')).json();
      places = window.wpApp._allPlacesCache = j.places || [];
    } catch (e) { console.warn('[DIAG-FOG] lugares:', e.message); return; }
  }
  showPlacesOnMap(mv, places, 'Nuevo Progreso', { ...opts, mode: 'explore' });
}

// Burbuja de un momento (completada / ayuda) arriba de la barra
function showFocusBubble(bar, html, kind, ms) {
  bar.querySelector('.wp-fb-bubble')?.remove();
  const b = document.createElement('div');
  b.className = 'wp-fog-burst wp-fb-bubble ' + kind;
  b.innerHTML = html;
  bar.appendChild(b);
  setTimeout(() => b.classList.add('out'), ms);
  setTimeout(() => b.remove(), ms + 500);
}

// Burbuja "+% de Nuevo Progreso" al destapar zona nueva
function showFogBurst(bar, pct, pts = 0) {
  const b = document.createElement('div');
  b.className = 'wp-fog-burst';
  b.innerHTML = `<b>${pct}<small>%</small></b><span>de Nuevo Progreso${pts ? ` · +${pts} pts` : ''}</span>`;
  bar.appendChild(b);
  setTimeout(() => b.classList.add('out'), 2200);
  setTimeout(() => b.remove(), 2700);
}

// Hoja con los lugares de la colección: visitados con palomita verde.
// Tocar uno lleva el mapa a ese lugar y abre su minimodal.
// Hoja "Amigos en esta colección": tú + la gente que sigues, por avance.
// Tocar a alguien abre su mini perfil.
function openFriendsSheet(mv, friends, myN, total, label) {
  mv.haptic?.('light');
  document.getElementById('wp-focus-pick')?.remove();
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const me = window.wpApp.currentUser;
  const myAv = window.wpApp._cachedAvatarUrl || me?.user_metadata?.avatar_url || getAvatarUrl(me?.user_metadata?.display_name || me?.email?.split('@')[0] || 'user');
  const rows = [...friends.map(f => ({ ...f, me: false })), { user_id: me?.id, name: 'Tú', avatar_url: myAv, visited: myN, me: true }]
    .sort((a, b) => b.visited - a.visited || (a.me ? -1 : 1));
  const root = document.createElement('div');
  root.id = 'wp-focus-pick';
  root.innerHTML = `<div class="wp-fp-dim"></div>
    <div class="wp-fp-sheet"><div class="wp-fp-grab"></div>
      <div class="wp-fp-title">Amigos en esta colección<small>${esc(label || '')}</small></div>
      <div class="wp-fp-list">${rows.map((r, i) => {
        const pct = Math.min(100, Math.round(r.visited / Math.max(1, total) * 100));
        const done = r.visited >= total && total > 0;
        return `<button type="button" class="wp-fp-row wp-fr-row${r.me ? ' on' : ''}" data-i="${i}">
          <span class="wp-fr-pos">${i + 1}</span>
          <span class="wp-fp-pic wp-fr-av" style="background-image:url('${esc(r.avatar_url || getAvatarUrl(r.name || 'user'))}')"></span>
          <span class="wp-fp-txt"><b>${esc(r.me ? 'Tú' : (r.name || (r.username ? '@' + r.username : 'Usuario')))}</b>
            <span class="wp-fr-bar"><i style="width:${pct}%"></i></span></span>
          <span class="wp-fr-n">${done ? '🏁' : `${r.visited}/${total}`}</span>
        </button>`;
      }).join('')}</div></div>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('in')));
  const close = () => { root.classList.remove('in'); setTimeout(() => root.remove(), 280); };
  root.querySelector('.wp-fp-dim').onclick = close;
  root.querySelectorAll('.wp-fr-row').forEach(b => b.onclick = () => {
    const r = rows[+b.dataset.i];
    if (!r || r.me || !r.user_id) return;
    mv.haptic?.('light');
    const mp = window.wpApp.miniProfile;
    if (mp) mp.open(r.user_id, { name: r.name, avatar: r.avatar_url || '' });
    else window.wpApp.openProfile?.(r.user_id);
  });
}

// Pestañas: "Todos" (visitados con palomita; tocar uno lleva el mapa ahí)
// y "Cerca de ti" (pendientes por distancia; tocar uno lo pone en el
// termómetro).
function openFocusPlaces(mv, places, visited, label, near, fog) {
  mv.haptic?.('light');
  document.getElementById('wp-focus-pick')?.remove();
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const idOf = (p) => String(p.place_id || p.placeId || p.id);
  const picOf = (p) => photoSmall(p.photosUrls?.[0] || p.photoUrl || p.photo_url || '');
  const fmt = (d) => d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 10) * 10} m`;
  // Pendientes primero, visitados al final
  const all = places.slice().sort((a, b) => (visited.has(idOf(a)) ? 1 : 0) - (visited.has(idOf(b)) ? 1 : 0));
  const n = places.filter(p => visited.has(idOf(p))).length;
  let tab = (near && window.wpApp._fpTab === 'near') ? 'near' : 'all';
  let nearList = [];

  const rowsAll = () => all.map((p, i) => {
    const v = visited.has(idOf(p));
    const ph = picOf(p);
    const addr = String(p.formattedAddress || p.vicinity || p.address || '').split(',')[0];
    return `<button type="button" class="wp-fp-row${v ? ' visited' : ''}" data-i="${i}">
      <span class="wp-fp-pic" style="${ph ? `background-image:url('${esc(ph)}')` : ''}"></span>
      <span class="wp-fp-txt"><b>${esc(p.name || 'Lugar')}</b><small>${esc(addr)}</small></span>
      ${v ? '<span class="wp-fp-ok"><svg width="12" height="12" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Visitado</span>' : '<span class="wp-fp-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>'}
    </button>`;
  }).join('');
  const rowsNear = () => {
    nearList = (near.list() || []).slice(0, 40);
    if (!nearList.length) {
      return `<p class="wp-fp-empty">${near.hasPos() ? '¡Ya visitaste todos!' : 'Buscando tu ubicación… Activa la ubicación del teléfono para ver qué tienes cerca.'}</p>`;
    }
    const cur = near.current();
    return nearList.map((x, i) => {
      const ph = picOf(x.p);
      const addr = String(x.p.formattedAddress || x.p.vicinity || x.p.address || '').split(',')[0];
      return `<button type="button" class="wp-fp-row${x.id === cur ? ' on' : ''}" data-i="${i}">
        <span class="wp-fp-pic${fog ? ' fog' : ''}" style="${ph ? `background-image:url('${esc(ph)}')` : ''}"></span>
        <span class="wp-fp-txt"><b>${esc(fog ? 'Por descubrir' : (x.p.name || 'Lugar'))}</b><small>${x.id === cur ? 'En tu termómetro' : esc(i === 0 ? 'El más cercano' : addr)}</small></span>
        <span class="wp-fp-dist">${fmt(x.d)}</span>
      </button>`;
    }).join('');
  };

  const root = document.createElement('div');
  root.id = 'wp-focus-pick';
  root.innerHTML = `<div class="wp-fp-dim"></div>
    <div class="wp-fp-sheet"><div class="wp-fp-grab"></div>
      <div class="wp-fp-title">${esc(label || 'Lugares')}<small>${n}/${places.length} visitados</small></div>
      ${near ? `<div class="wp-fp-tabs"><button type="button" data-t="all">Todos</button><button type="button" data-t="near">Cerca de ti</button><span class="wp-fp-tabs-knob"></span></div>` : ''}
      <div class="wp-fp-list"></div></div>`;
  document.body.appendChild(root);
  const listEl = root.querySelector('.wp-fp-list');
  const close = () => { root.classList.remove('in'); setTimeout(() => root.remove(), 280); };

  const render = () => {
    listEl.innerHTML = tab === 'near' ? rowsNear() : rowsAll();
    listEl.scrollTop = 0;
    root.querySelector('.wp-fp-tabs')?.classList.toggle('near', tab === 'near');
    root.querySelectorAll('.wp-fp-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    listEl.querySelectorAll('.wp-fp-row').forEach(b => b.onclick = () => {
      mv.haptic?.('light');
      if (tab === 'near') {
        const x = nearList[+b.dataset.i];
        if (!x) return;
        near.pick(x.id);
        close();
        return;
      }
      const p = all[+b.dataset.i];
      if (!p) return;
      close();
      const idx = (mv.allPlaces || []).indexOf(p);
      const lat = Number(p.lat ?? p.location?.lat), lng = Number(p.lng ?? p.location?.lng);
      const map = mv.getMap?.() || mv.map;
      if (isFinite(lat) && isFinite(lng)) map?.flyTo?.({ center: [lng, lat], zoom: Math.max(map.getZoom(), 16.5), essential: true, duration: 600 });
      setTimeout(() => {
        try { if (idx >= 0) mv._showMiniCard(p, idx, p.photosUrls?.[0] || p.photoUrl || p.photo_url || null); } catch (_) {}
      }, 650);
    });
  };
  root.querySelectorAll('.wp-fp-tabs button').forEach(b => b.onclick = () => {
    if (b.dataset.t === tab) return;
    mv.haptic?.('light');
    tab = window.wpApp._fpTab = b.dataset.t;
    render();
  });
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('in')));
  root.querySelector('.wp-fp-dim').onclick = close;
}

// Hoja con las colecciones (y "Tus guardados") para cambiar sin salir del mapa
async function openFocusPicker(mv, opts) {
  const list = opts.choices || [];
  if (!list.length) return;
  mv.haptic?.('light');
  document.getElementById('wp-focus-pick')?.remove();
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.createElement('div');
  root.id = 'wp-focus-pick';
  root.innerHTML = `<div class="wp-fp-dim"></div>
    <div class="wp-fp-sheet"><div class="wp-fp-grab"></div><div class="wp-fp-title">${opts.ownerId && opts.ownerId !== window.wpApp.currentUser?.id ? `Colecciones de ${esc(opts.ownerName || 'este usuario')}` : 'Tus colecciones'}</div>
      <div class="wp-fp-list">${list.map((c, i) => {
        const ph = c.places.map(p => photoSmall(p.photosUrls?.[0] || p.photoUrl || p.photo_url || '')).filter(Boolean).slice(0, 3);
        return `<button type="button" class="wp-fp-row${c.key === opts.choiceKey ? ' on' : ''}" data-i="${i}">
          <span class="wp-fp-ph">${ph.map((u, k) => `<i class="p${k}" style="background-image:url('${esc(u)}')"></i>`).join('')}</span>
          <span class="wp-fp-txt"><b>${esc(c.label)}</b><small data-prog>${c.places.length} ${c.places.length === 1 ? 'lugar' : 'lugares'}</small></span>
          ${c.key === opts.choiceKey ? '<span class="wp-fp-now">Viendo</span>' : '<span class="wp-fp-chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>'}
        </button>`;
      }).join('')}</div></div>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('in')));
  const close = () => { root.classList.remove('in'); setTimeout(() => root.remove(), 280); };
  root.querySelector('.wp-fp-dim').onclick = close;
  root.querySelectorAll('.wp-fp-row').forEach(b => b.onclick = () => {
    const c = list[+b.dataset.i];
    if (!c) return;
    if (c.key === opts.choiceKey) { close(); return; }
    mv.haptic?.('light');
    close();
    setTimeout(() => showPlacesOnMap(mv, c.places, c.label, { ...opts, ownerId: c.ownerId, choiceKey: c.key }), 160);
  });
  // Progreso de cada una ("3/7 visitados")
  if (window.wpApp.currentUser) {
    try {
      const all = [...new Set(list.flatMap(c => c.places.map(p => String(p.place_id || p.placeId || p.id))))];
      const m = await VisitService.myVisits(all);
      root.querySelectorAll('.wp-fp-row').forEach(b => {
        const c = list[+b.dataset.i];
        const n = c.places.filter(p => (m.get(String(p.place_id || p.placeId || p.id)) || 0) > 0).length;
        const el = b.querySelector('[data-prog]');
        el.textContent = `${n}/${c.places.length} visitados`;
        if (n >= c.places.length) el.classList.add('ok');
      });
    } catch (_) {}
  }
}

function _showProfileMenu() {
  document.getElementById('profile-menu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'profile-menu';
  menu.style.cssText = 'position:fixed;top:64px;right:12px;z-index:2000;background:white;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15);min-width:160px;font-family:var(--wp-font);';
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

  // Badge de total en el chip activo — el chip ya tiene la clase .active
  // puesta por SubcategoryRow ANTES de llamar onSubcatSelect/filterBySubcat,
  // así que alcanza con leerla acá. El resto de los chips se limpian para
  // que solo el activo muestre número.
  const setSubcatBadge = (count) => {
    document.querySelectorAll('.subcategory-footer-chip').forEach(chip => {
      const badge = chip.querySelector('.subcat-chip-badge');
      if (!badge) return;
      if (chip.classList.contains('active')) {
        badge.textContent = String(count);
        requestAnimationFrame(() => badge.classList.add('show'));
      } else {
        badge.classList.remove('show');
        badge.textContent = '';
      }
    });
  };

  // Antes de tocar ningún display: limpiar el estado de "escondido por
  // clustering" que haya quedado de la categoría/subcategoría anterior.
  // _updateClusters() (más abajo) arranca RESTAURANDO cualquier pin que
  // tenga _clusterHiddenDisplay guardado — si no se limpia acá primero,
  // esa restauración pisaría el filtro que estamos por aplicar con un
  // valor viejo de otro agrupamiento, y el resultado quedaba con pines
  // sueltos en vez de reagruparse según la subcategoría actual.
  mv.markerEls.forEach(el => { delete el._clusterHiddenDisplay; });

  if (!subcatValue || subcatValue === 'all') {
    mv.markerEls.forEach(el => el.style.display = '');
    const total = mv.allPlaces.length;
    if (counter) counter.textContent = `${total} lugares`;
    setSubcatBadge(total);
    mv._updateClusters(); // reagrupar según lo que quedó visible ("Todos")
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
  setSubcatBadge(visible);
  mv._updateClusters(); // reagrupar en clusters propios de esta subcategoría
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
        setMapTint({ cat: null }); // sombras del mapa de vuelta a blanco
        mv._clearPlaceMarkers();
        mv.currentCatId = null;
        window.wpApp.subcatRow?.hide();
        const counter = document.getElementById('map-results-count');
        if (counter) counter.textContent = '';
        return;
      }

      newChip.classList.add('active');
      setMapTint({ cat: menuKey }); // sombras del mapa con el color de la categoría
      window.wpApp.subcatRow?.showLoading(menuKey);
      await mv.loadCategory(menuKey);
      await window.wpApp.subcatRow?.showSubcats(menuKey);
      // "Todos" ya queda marcado como activo por showSubcats() (currentSubcat
      // arranca en null en cada categoría nueva), pero el BADGE con la
      // cantidad solo se llenaba cuando el usuario tocaba un chip a mano
      // — acá se dispara una vez apenas se muestran las subcategorías,
      // para que el badge de "Todos" aparezca de entrada sin esperar
      // ningún tap.
      filterBySubcat(mv, 'all');
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
// PANEL LATERAL
// ════════════════════════════════════════════════════════════════════
try {
  const positionSidePanel = () => {
    const topPanel    = document.getElementById('wp-side-panel-top');
    const bottomPanel = document.getElementById('wp-side-panel-bottom');
    const catPanel    = document.getElementById('map-results-panel');
    const topbar      = document.getElementById('topbar');
    if (!topPanel || !bottomPanel || !catPanel || !topbar) return false;
    const topbarBottom = topbar.getBoundingClientRect().bottom;
    const catPanelTop  = catPanel.getBoundingClientRect().top;
    if (catPanelTop <= topbarBottom) return false;
    const midY      = topbarBottom + (catPanelTop - topbarBottom) * 0.82;
    const bottomH   = bottomPanel.offsetHeight || 80;
    const topH      = topPanel.offsetHeight    || 42;
    const GAP       = 8;
    const bottomTop = midY - (bottomH + GAP + topH) / 2 + topH + GAP;
    const topTop    = bottomTop - GAP - topH;
    topPanel.style.transform    = 'none';
    bottomPanel.style.transform = 'none';
    topPanel.style.top    = Math.round(topTop)    + 'px';
    bottomPanel.style.top = Math.round(bottomTop) + 'px';
    topPanel.classList.add('wp-positioned');
    bottomPanel.classList.add('wp-positioned');
    return true;
  };
  const tryPosition = () => { if (!positionSidePanel()) requestAnimationFrame(tryPosition); };
  requestAnimationFrame(tryPosition);
} catch(e) { console.error('[wp-side-panel]', e); }

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════
(async () => {
  try {
    console.log('🚀 WhatsPlan iniciando...');

    // iOS / Capacitor fixes — lo primero, antes de montar nada
    initIOSFixes();

    // Liquid Glass topbar
    setTimeout(initLiquidGlass, 200);

    // Footer menu
    let activityModal = null;
    const openActivityModal = () => {
      if (!window.wpApp.currentUser) { window.wpApp.authModal?.show(); return; }
      if (!activityModal) {
        activityModal = new ActivityModal({
          currentUser: window.wpApp.currentUser,
          onActivityCreated: (activity) => {
            console.log('✅ Actividad creada:', activity);
            window.wpApp?.mapView?._loadActivities?.();
          },
          onActivityJoined: (activity) => { console.log('✅ Te uniste a:', activity); },
        });
      }
      activityModal.setUser(window.wpApp.currentUser);
      activityModal.show();
    };

    const footerMenu = new FooterMenu({
      onActividades: openActivityModal,
      onHome:        () => console.log('Home'),
      onSocial:      () => console.log('Social'),
    });
    footerMenu.animateIn();

    // Botones del panel lateral
    document.getElementById('wp-side-plan-btn')?.addEventListener('click', e => { e.stopPropagation(); openActivityModal(); });
    document.getElementById('wp-side-slot-2')?.addEventListener('click',  e => { e.stopPropagation(); window.wpApp.momentsUI?.openCamera(); }); // Memories
    document.getElementById('wp-side-slot-3')?.addEventListener('click',  e => { e.stopPropagation(); /* GPS — wired by SubcategoryRow */ });

    // Tap en un pin de actividad (custom point) en el mapa
    document.addEventListener('wp:activity-tap', (e) => {
      const { activity, group } = e.detail;
      if (group.length > 1) {
        console.log('📍 Grupo de actividades:', group);
        // TODO: carrusel si hay varias actividades en el mismo punto
      } else {
        console.log('📍 Actividad:', activity);
        // TODO: popup de detalles + botón unirse (ActivityService.joinActivity)
      }
    });

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
      if (!user) VisitService._cache.clear(); // visitas de la sesión anterior
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

    // ── Momentos / Memories (botón de cámara del panel lateral) ──
    const momentsUI = new MomentsUI({
      getCurrentUser: () => window.wpApp.currentUser,
      getMap:    () => mv.getMap?.(),
      getPlaces: () => mv.allPlaces || [],
      getGpsPos: () => window.wpApp.subcatRow?._lastGpsPos || null,
      onNeedLogin: () => window.wpApp.authModal?.show?.(),
      onOpenPlace: (placeId) => {
        const p = (mv.allPlaces || []).find(x => String(x.place_id || x.id) === String(placeId));
        const pm = window.wpApp.placeModal;
        if (p && pm) { pm._fromSearch = false; pm.show(p); }
      },
    });
    window.wpApp.momentsUI = momentsUI;
    window.wpApp.miniProfile = new MiniProfile({ getCurrentUser: () => window.wpApp.currentUser });
    // Cuando el mapa termina de cargar: stickers de momentos + limpieza
    {
      let tries = 0;
      const waitMap = setInterval(() => {
        const m = mv.getMap?.();
        if ((m && m.loaded && m.loaded()) || ++tries > 60) {
          clearInterval(waitMap);
          if (m) momentsUI.startMap();
        }
      }, 500);
    }

    const authModal = new AuthModal({
      onAuthSuccess: async (user) => {
        window.wpApp.currentUser = user;
        await renderAuthButton(user);
        window.wpApp.momentsUI?.startMap(); // ya con sesión: mis momentos y memories
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
          return photoFull(url); // Supabase directo (sin pasar por /api/photo-proxy)
        },
        getCurrentUser: function() { return window.wpApp.currentUser; }
      });
      window.wpApp.placeModal = placeModal;
      placeModal.mapView = mv;

      // Al tocar el minicard (MapView) → según el contexto:
      // - Búsqueda activa: abre la ficha completa directo
      // - Mapview normal: abre el minisnap primero (tap en el minisnap
      //   recién ahí abre la ficha completa — ver showMini/_showMiniSnap
      //   en PlaceModal2.js)
      // - opts.direct (el tap en la tarjeta héroe del slide de cluster):
      //   va DIRECTO a la ficha completa, sin pasar por el minisnap —
      //   ahí ya se venía de una pantalla "completa" (el slide), pasar
      //   por un paso intermedio chico se sentiría como un retroceso.
      //   Si además viene con flipFromRect, show() devuelve a dónde tiene
      //   que volar el clon que arma MapView — ver el flip en
      //   _openClusterExpand().
      mv.onPlaceSelect = function(place, opts) {
        if (opts && opts.direct) {
          placeModal._fromSearch = false;
          return placeModal.show(place, opts);
        }
        var sb = window.wpApp && window.wpApp.searchBar;
        if (sb && sb.isActive()) {
          placeModal._fromSearch = true;
          placeModal.show(place);
          return;
        }
        placeModal._fromSearch = false;
        placeModal.showMini(place);
      };
      const subcatRow = new SubcategoryRow({
        map: mv.getMap(),
        onSubcatSelect: (value) => filterBySubcat(mv, value),
      });
      window.wpApp.subcatRow = subcatRow;
      // GPS en vivo → sombras verdes (se engancha a su bandera _gpsActive)
      {
        let gpsOn = !!subcatRow._gpsActive;
        Object.defineProperty(subcatRow, '_gpsActive', {
          configurable: true,
          get: () => gpsOn,
          set: (v) => { gpsOn = !!v; setMapTint({ gps: gpsOn }); },
        });
      }

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
      // Búsqueda activa → sombras azules
      {
        const act = searchBar.activate.bind(searchBar), deact = searchBar.deactivate.bind(searchBar);
        searchBar.activate   = (...a) => { setMapTint({ search: true });  return act(...a); };
        searchBar.deactivate = (...a) => { setMapTint({ search: false }); return deact(...a); };
      }

      // Pill buscar — ahora el topbar-right-chip activa la searchbar
      const searchBtn = document.getElementById('topbar-right-chip');
      if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (!searchBar.isActive()) searchBar.activate();
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