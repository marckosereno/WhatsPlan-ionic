// ===================================================================
// WHATSPLAN — app.js
// ====================================================================

import { MapView }          from '/src/components/MapView.js';
import { photoFull, photoSmall } from '/src/utils/photo-url.js';
import { MiniProfile }      from '/src/components/MiniProfile.js';
import { VisitService }     from '/src/services/VisitService.js';
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
  mv._renderPlaceMarkers(mv.allPlaces);
  document.body.classList.add('wp-focus-map');

  const map = mv.getMap?.() || mv.map;
  const fit = (animate = true) => {
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
  top.innerHTML = `
    <button type="button" class="wp-ft-back" aria-label="Volver">
      <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" style="transform:scaleX(-1);flex-shrink:0;"><path d="M464 256c0-114.87-93.13-208-208-208S48 141.13 48 256s93.13 208 208 208 208-93.13 208-208Zm-228.5 91.36a16 16 0 0 1-.09-22.63L303.58 272H170a16 16 0 0 1 0-32h133.58l-52.32-52.73A16 16 0 1 1 274 164.73l79.39 80a16 16 0 0 1 0 22.54l-79.39 80A16 16 0 0 1 235.5 347.36Z"/></svg>
      <span class="wp-ft-back-label">Volver</span>
    </button>
    <div class="wp-ft-title">
      <div class="wp-ft-row"><h2>${esc(title)}</h2>${(opts.choices || []).length > 1 ? `<button type="button" class="wp-ft-switch" aria-label="Otras colecciones"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>` : ''}</div>
      <span class="wp-ft-sub" hidden></span>
    </div>`;
  document.body.appendChild(top);

  const bar = document.createElement('div');
  bar.id = 'wp-focus-bar';
  bar.innerHTML = `
    <div class="wp-fb-chips">
      <button type="button" class="wp-fb-chip wp-fb-next" hidden></button>
      <span class="wp-fb-chip wp-fb-left"></span>
    </div>
    <div class="wp-fb-bar">
      <span class="wp-fb-fill" style="--p:0"></span>
      <button type="button" class="wp-fb-cluster" aria-label="Lugares de la colección">${ph.map((u, i) => `<i class="p${i}" style="background-image:url('${esc(u)}')"></i>`).join('')}<span class="wp-fb-count">${total}</span></button>
      <button type="button" class="wp-fb-me" aria-label="Ver todos">
        <span class="wp-fb-ring" style="--p:0"><span class="wp-fb-av" style="background-image:url('${esc(myAv)}')"></span></span>
        <span class="wp-fb-badge"><span class="wp-fb-n">0</span>/${total}</span>
      </button>
      <span class="wp-fb-score"><b><span class="wp-fb-pct">0</span><small>%</small></b><em>completado</em></span>
    </div>`;
  document.body.appendChild(bar);
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.classList.add('in'); top.classList.add('in'); }));
  bar.querySelector('.wp-fb-me').onclick = () => { mv.haptic?.('light'); fit(true); };
  // Cluster de fotos: por ahora también encuadra todo (su función propia viene después)
  bar.querySelector('.wp-fb-cluster').onclick = () => { mv.haptic?.('light'); fit(true); };

  // De quién es (si no es tuya): "de @usuario"
  if (opts.ownerId && opts.ownerId !== me?.id) {
    import('/src/services/SocialService.js').then(({ SocialService }) => SocialService.getProfile(opts.ownerId)).then(pr => {
      if (!pr || !top.isConnected) return;
      const sub = top.querySelector('.wp-ft-sub');
      sub.textContent = 'de ' + (pr.username ? '@' + pr.username : (pr.name || 'alguien'));
      sub.hidden = false;
    }).catch(() => {});
  }

  // Lugar pendiente más cercano (si sabemos dónde estás) → chip "Siguiente"
  const myPos = () => window.wpApp.subcatRow?._lastGpsPos || null;
  const distM = (a, b) => {
    const R = 6371000, toR = x => x * Math.PI / 180;
    const dLa = toR(b.lat - a.lat), dLo = toR(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const coordsOf = (p) => ({ lat: Number(p.lat ?? p.location?.lat), lng: Number(p.lng ?? p.location?.lng) });

  // Progreso: mis visitas de estos lugares + palomita en los pines visitados
  const visited = new Set();
  const paintProgress = (celebrate = false) => {
    const n = visited.size;
    const pct = total ? Math.round(n / total * 100) : 0;
    bar.querySelector('.wp-fb-n').textContent = String(n);
    bar.querySelector('.wp-fb-pct').textContent = String(pct);
    bar.querySelector('.wp-fb-ring').style.setProperty('--p', String(pct));
    bar.querySelector('.wp-fb-fill').style.setProperty('--p', String(pct));
    const done = total > 0 && n >= total;
    bar.classList.toggle('complete', done);
    const left = bar.querySelector('.wp-fb-left');
    left.textContent = done ? '¡Colección completada!' : `Te ${total - n === 1 ? 'falta 1 lugar' : `faltan ${total - n} lugares`}`;
    left.classList.toggle('ok', done);
    // Siguiente: el pendiente más cercano a ti
    const next = bar.querySelector('.wp-fb-next');
    const pos = myPos();
    let best = null;
    if (pos && !done) {
      places.forEach(p => {
        const id = String(p.place_id || p.placeId || p.id);
        if (visited.has(id)) return;
        const c = coordsOf(p);
        if (!isFinite(c.lat) || !isFinite(c.lng)) return;
        const d = distM(pos, c);
        if (!best || d < best.d) best = { p, d, c };
      });
    }
    left.hidden = !!best && !done; // un solo chip a la vez
    if (best) {
      const dTxt = best.d >= 1000 ? `${(best.d / 1000).toFixed(1)} km` : `${Math.round(best.d / 10) * 10} m`;
      next.innerHTML = `<i></i><span>${esc(best.p.name || 'Siguiente')}</span><b>${dTxt}</b>`;
      next.hidden = false;
      next.onclick = () => { mv.haptic?.('light'); map?.flyTo?.({ center: [best.c.lng, best.c.lat], zoom: 17.4, essential: true }); };
    } else next.hidden = true;
    (mv.markerEls || []).forEach(el => {
      const id = String(el._place?.place_id || el._place?.placeId || el._place?.id || '');
      el.classList.toggle('wp-visited', visited.has(id));
    });
    if (celebrate) {
      mv.haptic?.(done ? 'action' : 'tap');
      const ring = bar.querySelector('.wp-fb-me');
      ring.classList.remove('pop'); void ring.offsetWidth; ring.classList.add('pop');
    }
  };
  paintProgress();
  if (me && total) {
    VisitService.myVisits(ids)
      .then(m => { m.forEach((v, id) => { if (v > 0) visited.add(id); }); paintProgress(); })
      .catch(e => console.warn('[DIAG-VISIT] progreso:', e.message || e));
  }
  // Si registra una visita (desde la ficha) mientras está en este modo
  const onVisit = (ev) => {
    const id = String(ev.detail?.place_id || '');
    if (!ids.includes(id) || visited.has(id)) return;
    visited.add(id);
    paintProgress(true);
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
    (mv.markerEls || []).forEach(el => el.classList.remove('wp-visited'));
    mv.haptic?.('light');
    bar.classList.remove('in');
    top.classList.remove('in');
    setTimeout(() => { bar.remove(); top.remove(); }, instant ? 0 : 280);
    document.body.classList.remove('wp-focus-map');
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
  // Flechita junto al título → lista de las demás colecciones
  top.querySelector('.wp-ft-switch')?.addEventListener('click', () => openFocusPicker(mv, opts));
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
    <div class="wp-fp-sheet"><div class="wp-fp-grab"></div><div class="wp-fp-title">Tus colecciones</div>
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