// ====================================================================
// WHATSPLAN — ProfileSheet.js
// Perfil como hoja que sube sobre el mapa (diseño "A · centrado").
//   · Mi perfil: avatar, @usuario, seguidores/siguiendo/reseñas, editar,
//     banner de lugares guardados (→ mapa), colecciones en abanico,
//     actividades, ajustes (privacidad, bloqueados, cerrar sesión).
//   · Perfil de otra persona: Seguir, sus colecciones públicas y sus
//     actividades.
// Navegación interna por "vistas" (colección, seguidores, editar…) con
// botón atrás; la hoja se cierra con ✕ o deslizando hacia abajo.
// ====================================================================
import { ProfileService }   from '/src/services/SupabaseService.js';
import { SocialService }    from '/src/services/SocialService.js';
import { FavoriteService }  from '/src/services/FavoriteService.js';
import { ReviewService }    from '/src/services/ReviewService.js';
import { getAvatarUrl }     from '/src/services/AvatarService.js';

const ICON = {
  x:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  gear:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  dots:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  share: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  cam:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  map:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>',
  chev:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  lock:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  globe: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
};
const ACT_GRADIENTS = [
  'linear-gradient(145deg,#fb7185,#e11d48)', 'linear-gradient(145deg,#a78bfa,#7c3aed)',
  'linear-gradient(145deg,#34d399,#059669)', 'linear-gradient(145deg,#60a5fa,#2563eb)',
];
const STACK_FALLBACK = ['#fde68a', '#bfdbfe', '#ddd6fe', '#fecdd3', '#bbf7d0', '#fed7aa'];
// Emoji → sticker 3D (Fluent Emoji de Microsoft, mismo origen que los
// íconos 3D que ya usa la app)
const FLUENT = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';
const STICKER3D = {
  '❤️': 'Red%20heart/3D/red_heart_3d.png', '⭐': 'Star/3D/star_3d.png', '💙': 'Blue%20heart/3D/blue_heart_3d.png',
  '🤩': 'Star-struck/3D/star-struck_3d.png', '✌️': 'Victory%20hand/Default/3D/victory_hand_3d_default.png',
  '☕': 'Hot%20beverage/3D/hot_beverage_3d.png', '🥐': 'Croissant/3D/croissant_3d.png', '🍔': 'Hamburger/3D/hamburger_3d.png',
  '🌮': 'Taco/3D/taco_3d.png', '🍕': 'Pizza/3D/pizza_3d.png', '🍰': 'Shortcake/3D/shortcake_3d.png',
  '🍦': 'Soft%20ice%20cream/3D/soft_ice_cream_3d.png', '🍻': 'Clinking%20beer%20mugs/3D/clinking_beer_mugs_3d.png',
  '🍷': 'Wine%20glass/3D/wine_glass_3d.png', '🎉': 'Party%20popper/3D/party_popper_3d.png', '🎵': 'Musical%20note/3D/musical_note_3d.png',
  '🌳': 'Deciduous%20tree/3D/deciduous_tree_3d.png', '🛍️': 'Shopping%20bags/3D/shopping_bags_3d.png', '🎨': 'Artist%20palette/3D/artist_palette_3d.png',
  '🏋️': 'Person%20lifting%20weights/Default/3D/person_lifting_weights_3d_default.png', '🦷': 'Tooth/3D/tooth_3d.png',
  '🛺': 'Auto%20rickshaw/3D/auto_rickshaw_3d.png', '🛸': 'Flying%20saucer/3D/flying_saucer_3d.png', '👽': 'Alien/3D/alien_3d.png',
  '👻': 'Ghost/3D/ghost_3d.png', '🍿': 'Popcorn/3D/popcorn_3d.png', '🪩': 'Mirror%20ball/3D/mirror_ball_3d.png',
};
// Si no hay suficientes colecciones con emoji, se completa con estos
const STICKER_FILL = ['☕', '🍦', '🥐', '🍿'];
// Posición de cada sticker (desde la esquina inferior derecha del banner)
const STICKER_SLOTS = [
  { r: -4,  b: -12, s: 80, rot: 8 },    // derecha, saliéndose del borde
  { r: 58,  b: 24,  s: 62, rot: -12 },  // arriba
  { r: 104, b: -16, s: 74, rot: 6 },    // centro abajo
  { r: 160, b: 4,   s: 60, rot: -8 },   // izquierda
];
const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

export class ProfileSheet {
  constructor(opts = {}) {
    this.getCurrentUser   = opts.getCurrentUser   || (() => null);
    this.getPlaceModal    = opts.getPlaceModal    || (() => null); // para toast, haptics, pulse, menú ⋯
    this.proxyPhoto       = opts.proxyPhoto       || (u => u);
    this.onOpenPlace      = opts.onOpenPlace      || (() => {});
    this.onShowOnMap      = opts.onShowOnMap      || (() => {}); // (places, label)
    this.onOpenActivity   = opts.onOpenActivity   || (() => {});
    this.onLogout         = opts.onLogout         || (() => {});
    this.onAvatarChanged  = opts.onAvatarChanged  || (() => {});
    this._el = null;
    this._stack = [];
    this._places = null; // Map place_id → lugar (de /api/supabase-places?category=ALL)
    this._injectStyles();
  }

  // ── Abrir / cerrar ─────────────────────────────────────────────────
  // userId vacío = mi perfil
  open(userId = null) {
    const me = this.getCurrentUser();
    const uid = userId || me?.id;
    if (!uid) return;
    if (this._el) { this._push(v => this._viewProfile(v, uid)); return; }
    this._build();
    this._push(v => this._viewProfile(v, uid), { instant: true });
    this._show();
  }

  close() {
    if (!this._el || this._closing) return;
    this._closing = true;
    const el = this._el;
    el.classList.remove('wp-pf-in');
    this._resumeBehind();
    setTimeout(() => { el.remove(); if (this._el === el) { this._el = null; this._stack = []; } this._closing = false; }, 360);
  }

  _build() {
    const el = document.createElement('div');
    el.id = 'wp-pf';
    el.innerHTML = `
      <div class="wp-pf-overlay"></div>
      <div class="wp-pf-sheet">
        <div class="wp-pf-head">
          <div class="wp-pf-handle"></div>
          <button type="button" class="wp-pf-hbtn wp-pf-left" aria-label="Cerrar">${ICON.x}</button>
          <div class="wp-pf-htitle"></div>
          <button type="button" class="wp-pf-hbtn wp-pf-right" aria-label="Opciones"></button>
        </div>
        <div class="wp-pf-body"></div>
      </div>`;
    document.body.appendChild(el);
    this._el = el;
    this._sheet = el.querySelector('.wp-pf-sheet');
    this._body = el.querySelector('.wp-pf-body');
    el.querySelector('.wp-pf-overlay').onclick = () => this.close();
    el.querySelector('.wp-pf-left').onclick = () => {
      this._pulse(el.querySelector('.wp-pf-left'));
      if (this._stack.length > 1) this._pop(); else this.close();
    };
    // Deslizar hacia abajo desde el encabezado = cerrar
    const head = el.querySelector('.wp-pf-head');
    let sy = 0, dy = 0, drag = false;
    head.addEventListener('touchstart', e => {
      if (e.target.closest('button')) return;
      sy = e.touches[0].clientY; dy = 0; drag = true; this._sheet.style.transition = 'none';
    }, { passive: true });
    head.addEventListener('touchmove', e => {
      if (!drag) return;
      dy = Math.max(0, e.touches[0].clientY - sy);
      this._sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    head.addEventListener('touchend', () => {
      if (!drag) return; drag = false;
      this._sheet.style.transition = '';
      this._sheet.style.transform = '';
      if (dy > 90) this.close();
    });
  }

  _show() {
    // Scroll del contenido SOLO al terminar de subir (un área con scroll
    // dentro de una hoja que se anima es lo que daba glitch en Android)
    this._body.classList.add('wp-pf-noscroll');
    requestAnimationFrame(() => requestAnimationFrame(() => this._el?.classList.add('wp-pf-in')));
    setTimeout(() => this._body?.classList.remove('wp-pf-noscroll'), 420);
    this._freezeBehind();
  }

  // Lo de atrás (pins animados del mapa) se pausa mientras está abierto
  _freezeBehind() {
    this._paused = [];
    try {
      document.getAnimations().forEach(a => {
        const t = a.effect?.target;
        if (t && this._el && !this._el.contains(t) && a.playState === 'running') { a.pause(); this._paused.push(a); }
      });
    } catch (_) {}
  }
  _resumeBehind() {
    (this._paused || []).forEach(a => { try { a.play(); } catch (_) {} });
    this._paused = [];
  }

  // ── Vistas ─────────────────────────────────────────────────────────
  _push(render, { instant = false } = {}) {
    const view = document.createElement('div');
    view.className = 'wp-pf-view';
    const prev = this._stack[this._stack.length - 1];
    if (prev) prev.scroll = this._body.scrollTop;
    this._stack.push({ render, view, scroll: 0 });
    this._mount(view, instant ? 0 : 1);
    render.call(this, view);
  }
  _pop() {
    if (this._stack.length < 2) return;
    this._stack.pop();
    const top = this._stack[this._stack.length - 1];
    const view = document.createElement('div');
    view.className = 'wp-pf-view';
    top.view = view;
    this._mount(view, -1);
    top.render.call(this, view);
    this._body.scrollTop = top.scroll || 0;
  }
  _mount(view, dir) {
    this._body.innerHTML = '';
    this._body.appendChild(view);
    this._body.scrollTop = 0;
    this._setHeader({ title: '', right: null });
    if (dir) this._slideIn(view, dir);
  }
  // Entrada de vista: desliza 24px y aparece (por cuadros, sin capas fijas)
  _slideIn(view, dir) {
    const t0 = performance.now(), D = 220;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - t, 3);
      view.style.opacity = String(k);
      view.style.transform = t < 1 ? `translateX(${(1 - k) * 24 * dir}px)` : '';
      if (t < 1) requestAnimationFrame(step);
    };
    view.style.opacity = '0';
    requestAnimationFrame(step);
  }
  _setHeader({ title = '', right = null }) {
    if (!this._el) return;
    const left = this._el.querySelector('.wp-pf-left');
    const isRoot = this._stack.length <= 1;
    left.innerHTML = isRoot ? ICON.x : ICON.back;
    left.setAttribute('aria-label', isRoot ? 'Cerrar' : 'Atrás');
    this._el.querySelector('.wp-pf-htitle').textContent = title;
    const r = this._el.querySelector('.wp-pf-right');
    r.style.visibility = right ? '' : 'hidden';
    r.innerHTML = right?.icon || '';
    r.onclick = right ? (e) => { e.stopPropagation(); this._pulse(r); right.onClick(r); } : null;
  }
  _isCurrent(view) { return this._el && this._stack[this._stack.length - 1]?.view === view && view.isConnected; }

  // ── Datos ──────────────────────────────────────────────────────────
  async _placesIndex() {
    if (this._places) return this._places;
    if (!this._placesP) {
      this._placesP = fetch('/api/supabase-places?category=ALL')
        .then(r => r.json())
        .then(j => {
          const m = new Map();
          (j.places || []).forEach(p => m.set(String(p.place_id), p));
          this._places = m;
          return m;
        })
        .catch(e => { this._placesP = null; console.warn('[PF] Lugares:', e.message || e); return new Map(); });
    }
    return this._placesP;
  }
  _photo(p) {
    const raw = p?.photoUrl || p?.photo_url || p?.photosUrls?.[0] || null;
    return raw ? this.proxyPhoto(raw) : null;
  }
  _avatar(prof, isMe) {
    const me = this.getCurrentUser();
    return prof?.avatar_url || (isMe ? me?.user_metadata?.avatar_url : '') || getAvatarUrl(prof?.name || 'user');
  }
  _name(prof, isMe) {
    const me = this.getCurrentUser();
    return prof?.name || (isMe ? (me?.user_metadata?.name || me?.email?.split('@')[0]) : '') || 'Usuario';
  }

  // ── Vista: perfil ──────────────────────────────────────────────────
  async _viewProfile(view, uid) {
    const me = this.getCurrentUser();
    const isMe = !!me && me.id === uid;
    view.innerHTML = `
      <div class="wp-pf-top">
        <div class="wp-pf-avatar-wrap">
          <div class="wp-pf-avatar wp-pf-skel"></div>
          ${isMe ? `<button type="button" class="wp-pf-cam" aria-label="Cambiar foto">${ICON.cam}</button>` : ''}
        </div>
        <div class="wp-pf-name"><span class="wp-pf-skel wp-pf-skel-line" style="width:150px"></span></div>
        <div class="wp-pf-handle-line"></div>
        <div class="wp-pf-bio"></div>
        <div class="wp-pf-stats">
          <button type="button" data-k="followers"><b>–</b><span>seguidores</span></button>
          <button type="button" data-k="following"><b>–</b><span>siguiendo</span></button>
          <div><b>–</b><span>reseñas</span></div>
        </div>
        <div class="wp-pf-actions"></div>
      </div>
      ${isMe ? `<button type="button" class="wp-pf-banner">
          <svg class="wp-pf-banner-map" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g fill="none" stroke="#fff" stroke-linecap="round">
              <path d="M-10 32 H380 M-10 104 H380 M52 -10 V160 M140 -10 V160 M236 -10 V160 M300 -10 V160" stroke-width="5" opacity="0.13"/>
              <path d="M-10 68 C60 60 90 80 160 70 S270 58 380 66 M96 -10 C102 50 88 100 104 160 M190 -10 L206 160" stroke-width="3" opacity="0.16"/>
            </g>
            <path d="M-10 128 C40 112 70 130 120 118 C170 106 210 128 260 114 C300 104 330 120 380 110 V160 H-10Z" fill="#fff" opacity="0.12"/>
            <path d="M200 46 l14 -8 14 8 v16 l-14 8 -14 -8z M230 62 l14 -8 14 8 v16 l-14 8 -14 -8z M170 64 l14 -8 14 8 v16 l-14 8 -14 -8z" fill="#fff" opacity="0.14"/>
            <path d="M38 96 c8 -14 16 -26 24 -16 s10 -24 20 -18 s12 -18 22 -10 s14 -16 24 -6 s12 -12 22 -4 s16 -14 24 -2 s14 -10 22 0 s12 -14 22 -4 s16 -10 26 2 s14 -16 26 -6"
              fill="none" stroke="#1e2a78" stroke-width="2.6" stroke-linejoin="round" opacity="0.55"/>
            <g class="wp-pf-banner-labels" font-family="Arimo, Arial, sans-serif" font-weight="700" font-size="13"
               fill="#1f2a5a" fill-opacity="0.72" stroke="#fff" stroke-width="3.5" stroke-opacity="0.75" paint-order="stroke"></g>
          </svg>
          <div class="wp-pf-banner-l"><span>Guardados</span><b class="wp-pf-saved-n">–</b>
            <span class="wp-pf-banner-pill">${ICON.map} Ver mapa</span></div>
          <span class="wp-pf-banner-dot"></span>
          <div class="wp-pf-stickers"></div>
        </button>` : ''}
      <div class="wp-pf-mem"></div>
      <div class="wp-pf-sec"><span>Colecciones</span><span class="wp-pf-sec-n"></span></div>
      <div class="wp-pf-cols"><div class="wp-pf-col wp-pf-col-skel"></div><div class="wp-pf-col wp-pf-col-skel"></div><div class="wp-pf-col wp-pf-col-skel"></div></div>
      <div class="wp-pf-sec"><span>Actividades</span><span class="wp-pf-sec-n wp-pf-acts-all"></span></div>
      <div class="wp-pf-acts"></div>
      <div style="height:28px"></div>`;
    this._setHeader({
      title: '',
      right: isMe
        ? { icon: ICON.gear, onClick: () => this._push(v => this._viewSettings(v)) }
        : (me ? { icon: ICON.dots, onClick: (btn) => this._otherMenu(btn, uid) } : null),
    });

    // Memories (momentos activos + guardados) — los pinta MomentsUI
    window.wpApp?.momentsUI?.renderProfile(view.querySelector('.wp-pf-mem'), uid, isMe);

    const avEl = view.querySelector('.wp-pf-avatar');
    const nameEl = view.querySelector('.wp-pf-name');
    const handleEl = view.querySelector('.wp-pf-handle-line');
    const bioEl = view.querySelector('.wp-pf-bio');
    const statEls = view.querySelectorAll('.wp-pf-stats b');
    const actionsEl = view.querySelector('.wp-pf-actions');

    // Perfil
    let prof = null;
    try { prof = await SocialService.getProfile(uid); } catch (e) { console.warn('[PF] Perfil:', e.message || e); }
    if (!this._isCurrent(view)) return;
    this._lastProfile = isMe ? prof : this._lastProfile;
    const name = this._name(prof, isMe);
    const img = new Image();
    img.onload = () => { avEl.classList.remove('wp-pf-skel'); avEl.style.backgroundImage = `url("${img.src}")`; };
    img.onerror = () => { avEl.classList.remove('wp-pf-skel'); avEl.style.backgroundImage = `url("${getAvatarUrl(name)}")`; };
    img.src = this._avatar(prof, isMe);
    nameEl.textContent = name;
    const bits = [];
    if (prof?.username) bits.push('@' + prof.username);
    if (prof?.city) bits.push(prof.city);
    handleEl.textContent = bits.join(' · ');
    if (isMe && !prof?.username) {
      handleEl.innerHTML = '<button type="button" class="wp-pf-link">+ Agrega tu @usuario</button>';
      handleEl.querySelector('button').onclick = () => this._push(v => this._viewEdit(v));
    }
    bioEl.textContent = prof?.bio || '';
    bioEl.style.display = prof?.bio ? '' : 'none';

    if (isMe) {
      view.querySelector('.wp-pf-cam').onclick = () => this._pickAvatar(avEl);
      actionsEl.innerHTML = `<button type="button" class="wp-pf-pill" data-a="edit">Editar perfil</button>
        <button type="button" class="wp-pf-pill" data-a="share">${ICON.share} Compartir</button>`;
      actionsEl.querySelector('[data-a=edit]').onclick = (e) => { this._pulse(e.currentTarget); this._push(v => this._viewEdit(v)); };
    } else {
      actionsEl.innerHTML = `<button type="button" class="wp-pf-pill wp-pf-pill-dark" data-a="follow">Seguir</button>
        <button type="button" class="wp-pf-pill" data-a="share">${ICON.share} Compartir</button>`;
      this._wireFollow(actionsEl.querySelector('[data-a=follow]'), uid, (delta) => {
        const b = statEls[0]; const n = (parseInt(b.textContent, 10) || 0) + delta; b.textContent = String(Math.max(0, n));
      });
    }
    actionsEl.querySelector('[data-a=share]').onclick = (e) => {
      this._pulse(e.currentTarget);
      this._share(`${name} en WhatsPlan`, `Mira los lugares de ${name}${prof?.username ? ' (@' + prof.username + ')' : ''} en WhatsPlan`);
    };

    // Seguidores / siguiendo / reseñas
    view.querySelectorAll('.wp-pf-stats button').forEach(b => {
      b.onclick = () => { this._pulse(b); this._push(v => this._viewFollows(v, uid, b.dataset.k, name)); };
    });
    SocialService.getFollowCounts(uid).then(c => {
      if (!view.isConnected) return;
      statEls[0].textContent = String(c.followers); statEls[1].textContent = String(c.following);
    }).catch(e => console.warn('[PF] Seguidores:', e.message || e));
    SocialService.getReviewCount(uid).then(n => { if (view.isConnected) statEls[2].textContent = String(n); })
      .catch(e => console.warn('[PF] Reseñas:', e.message || e));

    // Guardados + colecciones + actividades
    this._fillCollections(view, uid, isMe);
    this._fillActivities(view, uid, isMe);
  }

  async _fillCollections(view, uid, isMe) {
    const grid = view.querySelector('.wp-pf-cols');
    const secN = view.querySelectorAll('.wp-pf-sec-n')[0];
    const [places, cols, favIds] = await Promise.all([
      this._placesIndex(),
      FavoriteService.getProfileCollections(uid).catch(e => { console.warn('[PF] Colecciones:', e.message || e); return []; }),
      isMe ? FavoriteService.getFavoriteIds(uid).catch(() => []) : Promise.resolve([]),
    ]);
    if (!view.isConnected) return;

    // Banner de guardados
    if (isMe) {
      const banner = view.querySelector('.wp-pf-banner');
      const saved = favIds.map(id => places.get(String(id))).filter(Boolean);
      view.querySelector('.wp-pf-saved-n').textContent = String(favIds.length);
      // Stickers 3D: emojis de tus colecciones con más lugares (sin
      // repetir), completados con unos de comida/plan
      const fromCols = cols.slice().sort((a, b) => b.items.length - a.items.length).map(c => c.emoji).filter(e => e && STICKER3D[e]);
      const emojis = [...new Set([...fromCols, ...STICKER_FILL])].slice(0, STICKER_SLOTS.length);
      view.querySelector('.wp-pf-stickers').innerHTML = emojis.map((e, i) => {
        const sl = STICKER_SLOTS[i];
        return `<img class="wp-pf-sticker" alt="" draggable="false" src="${FLUENT + STICKER3D[e]}"
          style="right:${sl.r}px;bottom:${sl.b}px;width:${sl.s}px;height:${sl.s}px;--r:${sl.rot}deg;z-index:${10 - i}"
          onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'wp-pf-sticker wp-pf-sticker-txt',textContent:'${e}',style:this.getAttribute('style')}))">`;
      }).join('');
      // Etiquetas tipo mapa: nombres de tus lugares guardados
      const LBL = [[176, 26], [204, 56]];
      view.querySelector('.wp-pf-banner-labels').innerHTML = saved.slice(0, LBL.length).map((p, i) => {
        const n = String(p.name || '').slice(0, 14);
        return `<text x="${LBL[i][0]}" y="${LBL[i][1]}">${this._esc(n)}</text>`;
      }).join('');
      banner.onclick = () => {
        this._pulse(banner);
        if (!saved.length) { this._toast('Aún no tienes lugares guardados'); return; }
        this.close();
        this.onShowOnMap(saved, 'Tus guardados');
      };
    }

    secN.textContent = cols.length ? String(cols.length) : '';
    if (!cols.length) {
      grid.outerHTML = `<p class="wp-pf-empty">${isMe
        ? 'Crea colecciones desde la ficha de un lugar con “♥ Añadir a una colección”.'
        : 'No tiene colecciones públicas.'}</p>`;
      return;
    }
    grid.innerHTML = '';
    cols.forEach((c, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'wp-pf-col';
      const photos = c.items.map(id => this._photo(places.get(String(id)))).filter(Boolean).slice(0, 3);
      const n = c.items.length;
      card.innerHTML = `
        <div class="wp-pf-stack">${this._stackHtml(photos, i)}<span class="wp-pf-stack-emoji">${this._esc(c.emoji || '❤️')}</span></div>
        <div class="wp-pf-col-name"></div>
        <div class="wp-pf-col-meta">${n} ${n === 1 ? 'lugar' : 'lugares'}${isMe ? ` · ${c.is_public ? ICON.globe : ICON.lock}` : ''}</div>`;
      card.querySelector('.wp-pf-col-name').textContent = c.name;
      card.onclick = () => { this._pulse(card); this._push(v => this._viewCollection(v, c, isMe)); };
      grid.appendChild(card);
    });
  }

  // Abanico de hasta 3 fotos (como el del hero de la ficha)
  _stackHtml(photos, seed = 0) {
    const ROT = [['-9deg', '-6px'], ['7deg', '6px'], ['0deg', '0px']];
    const list = photos.length ? photos : [null, null];
    return list.map((src, i, arr) => {
      const [r, x] = ROT[(arr.length === 1 ? 2 : i) % 3];
      const bg = src ? `background-image:url('${String(src).replace(/'/g, '%27')}')` : `background:${STACK_FALLBACK[(seed + i) % STACK_FALLBACK.length]}`;
      return `<i style="${bg};--r:${r};--x:${x};z-index:${i + 1}"></i>`;
    }).join('');
  }

  async _fillActivities(view, uid, isMe) {
    const box = view.querySelector('.wp-pf-acts');
    const allBtn = view.querySelector('.wp-pf-acts-all');
    let acts = [];
    try { acts = await SocialService.getUserActivities(uid); } catch (e) { console.warn('[PF] Actividades:', e.message || e); }
    if (!view.isConnected) return;
    if (!acts.length) {
      box.innerHTML = `<p class="wp-pf-empty">${isMe ? 'No tienes actividades próximas.' : 'Sin actividades próximas.'}</p>`;
      return;
    }
    allBtn.textContent = 'Ver todo';
    allBtn.classList.add('wp-pf-link');
    allBtn.onclick = () => this._push(v => this._viewActivities(v, acts));
    const first = acts[0];
    box.innerHTML = `
      <button type="button" class="wp-pf-act-cluster">
        <div class="wp-pf-act-stack">${acts.slice(0, 3).map((a, i) => this._actCard(a, i)).join('')}</div>
        <div class="wp-pf-act-txt">
          <b>${acts.length} ${acts.length === 1 ? 'próxima' : 'próximas'}</b>
          <span></span>
        </div>
        <span class="wp-pf-act-chev">${ICON.chev}</span>
      </button>`;
    box.querySelector('.wp-pf-act-txt span').textContent = `${first.title || first.place_name || 'Actividad'} · ${this._when(first.scheduled_at)}`;
    const btn = box.querySelector('.wp-pf-act-cluster');
    btn.onclick = () => { this._pulse(btn); this._push(v => this._viewActivities(v, acts)); };
  }
  _actCard(a, i) {
    const d = new Date(a.scheduled_at);
    const ROT = ['-7deg', '5deg', '-2deg'];
    return `<div class="wp-pf-act-card" style="background:${ACT_GRADIENTS[i % ACT_GRADIENTS.length]};--r:${ROT[i % 3]};left:${i * 16}px;z-index:${3 - i}">
      <b>${d.getDate()}</b><span>${MONTHS[d.getMonth()]}</span></div>`;
  }
  _when(iso) {
    const d = new Date(iso);
    const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const time = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    const today = new Date(); const tom = new Date(); tom.setDate(today.getDate() + 1);
    const same = (x, y) => x.toDateString() === y.toDateString();
    const day = same(d, today) ? 'hoy' : same(d, tom) ? 'mañana' : `${days[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`;
    return `${day}, ${time}`;
  }

  // ── Vista: una colección ───────────────────────────────────────────
  async _viewCollection(view, c, isMe) {
    this._setHeader({ title: `${c.emoji || '❤️'} ${c.name}`, right: null });
    view.innerHTML = `
      <div class="wp-pf-col-head">
        <div class="wp-pf-stack wp-pf-stack-big"></div>
        <div class="wp-pf-col-hmeta"></div>
        <div class="wp-pf-actions">
          ${isMe ? '<button type="button" class="wp-pf-pill" data-a="priv"></button>' : ''}
          <button type="button" class="wp-pf-pill" data-a="map">${ICON.map} Ver en el mapa</button>
          <button type="button" class="wp-pf-pill" data-a="share">${ICON.share}</button>
        </div>
      </div>
      <div class="wp-pf-list"></div>`;
    const places = await this._placesIndex();
    if (!this._isCurrent(view)) return;
    const list = c.items.map(id => places.get(String(id))).filter(Boolean);
    const photos = list.map(p => this._photo(p)).filter(Boolean).slice(0, 3);
    view.querySelector('.wp-pf-stack').innerHTML = this._stackHtml(photos, 1) + `<span class="wp-pf-stack-emoji">${this._esc(c.emoji || '❤️')}</span>`;
    view.querySelector('.wp-pf-col-hmeta').textContent = `${c.items.length} ${c.items.length === 1 ? 'lugar' : 'lugares'}`;

    const priv = view.querySelector('[data-a=priv]');
    const paintPriv = () => { if (priv) priv.innerHTML = c.is_public ? `${ICON.globe} Pública` : `${ICON.lock} Privada`; };
    paintPriv();
    if (priv) priv.onclick = async () => {
      const was = c.is_public;
      c.is_public = !was; paintPriv(); this._pulse(priv); this._haptic('light');
      try {
        await FavoriteService.setCollectionPublic(c.id, c.is_public);
        this._toast(c.is_public ? 'Ahora cualquiera puede verla' : 'Ahora solo tú la ves');
      } catch (e) {
        console.error('[PF] Privacidad:', e);
        c.is_public = was; paintPriv();
        this._toast('No se pudo cambiar');
      }
    };
    view.querySelector('[data-a=map]').onclick = (e) => {
      this._pulse(e.currentTarget);
      if (!list.length) { this._toast('Esta colección está vacía'); return; }
      this.close();
      this.onShowOnMap(list, `${c.emoji || ''} ${c.name}`.trim());
    };
    view.querySelector('[data-a=share]').onclick = (e) => {
      this._pulse(e.currentTarget);
      this._share(`${c.emoji || ''} ${c.name}`.trim(), `${c.emoji || ''} ${c.name} en WhatsPlan:\n` + list.map(p => `• ${p.name}`).join('\n'));
    };

    const box = view.querySelector('.wp-pf-list');
    if (!list.length) { box.innerHTML = '<p class="wp-pf-empty">Esta colección está vacía.</p>'; return; }
    list.forEach(p => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'wp-pf-row';
      const ph = this._photo(p);
      row.innerHTML = `<span class="wp-pf-row-img" style="${ph ? `background-image:url('${ph}')` : ''}"></span>
        <span class="wp-pf-row-txt"><b></b><span></span></span><span class="wp-pf-row-chev">${ICON.chev}</span>`;
      row.querySelector('b').textContent = p.name;
      row.querySelector('.wp-pf-row-txt span').textContent = [p.rating ? `⭐ ${Number(p.rating).toFixed(1)}` : '', p.formattedAddress || ''].filter(Boolean).join(' · ');
      row.onclick = () => { this._pulse(row); this.close(); setTimeout(() => this.onOpenPlace(p), 200); };
      box.appendChild(row);
    });
  }

  // ── Vista: actividades ─────────────────────────────────────────────
  _viewActivities(view, acts) {
    this._setHeader({ title: 'Actividades', right: null });
    const box = document.createElement('div');
    box.className = 'wp-pf-list';
    view.appendChild(box);
    acts.forEach((a, i) => {
      const d = new Date(a.scheduled_at);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'wp-pf-row';
      const n = (a.participants || []).length;
      row.innerHTML = `<span class="wp-pf-row-date" style="background:${ACT_GRADIENTS[i % ACT_GRADIENTS.length]}"><b>${d.getDate()}</b>${MONTHS[d.getMonth()]}</span>
        <span class="wp-pf-row-txt"><b></b><span></span></span><span class="wp-pf-row-chev">${ICON.chev}</span>`;
      row.querySelector('b').textContent = a.title || a.place_name || 'Actividad';
      row.querySelector('.wp-pf-row-txt span').textContent = [this._when(a.scheduled_at), a.place_name, n ? `${n}/${a.max_participants || '∞'} van` : ''].filter(Boolean).join(' · ');
      row.onclick = () => { this._pulse(row); this.close(); setTimeout(() => this.onOpenActivity(a), 200); };
      box.appendChild(row);
    });
  }

  // ── Vista: seguidores / siguiendo ──────────────────────────────────
  async _viewFollows(view, uid, kind, name) {
    this._setHeader({ title: kind === 'followers' ? 'Seguidores' : 'Siguiendo', right: null });
    view.innerHTML = '<div class="wp-pf-list"><p class="wp-pf-empty">Cargando…</p></div>';
    const box = view.querySelector('.wp-pf-list');
    let people = [];
    try { people = await SocialService.listFollows(uid, kind); } catch (e) { console.warn('[PF] Lista:', e.message || e); }
    const me = this.getCurrentUser();
    let mine = new Set();
    try { mine = await SocialService.followingSet(me?.id, people.map(p => p.id)); } catch (_) {}
    if (!this._isCurrent(view)) return;
    box.innerHTML = '';
    if (!people.length) {
      box.innerHTML = `<p class="wp-pf-empty">${kind === 'followers' ? `Nadie sigue a ${this._esc(name)} todavía.` : `${this._esc(name)} todavía no sigue a nadie.`}</p>`;
      return;
    }
    people.forEach(p => box.appendChild(this._personRow(p, mine.has(p.id))));
  }
  _personRow(p, iFollow) {
    const me = this.getCurrentUser();
    const row = document.createElement('div');
    row.className = 'wp-pf-row';
    row.setAttribute('role', 'button');
    row.innerHTML = `<span class="wp-pf-row-av" style="background-image:url('${this._avatar(p, false)}')"></span>
      <span class="wp-pf-row-txt"><b></b><span></span></span>`;
    row.querySelector('b').textContent = p.name || 'Usuario';
    row.querySelector('.wp-pf-row-txt span').textContent = [p.username ? '@' + p.username : '', p.city || ''].filter(Boolean).join(' · ');
    if (me && me.id !== p.id) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wp-pf-pill wp-pf-pill-sm';
      row.appendChild(b);
      this._wireFollow(b, p.id, null, iFollow);
    }
    row.onclick = (e) => { if (e.target.closest('.wp-pf-pill')) return; this._pulse(row); this._push(v => this._viewProfile(v, p.id)); };
    return row;
  }

  // Botón Seguir / Siguiendo (optimista)
  async _wireFollow(btn, uid, onDelta, known = null) {
    const me = this.getCurrentUser();
    let on = !!known;
    const paint = () => {
      btn.textContent = on ? 'Siguiendo' : 'Seguir';
      btn.classList.toggle('wp-pf-pill-dark', !on);
    };
    paint();
    if (!me) { btn.onclick = () => window.wpApp?.authModal?.show(); return; }
    if (known === null) {
      try { on = await SocialService.isFollowing(me.id, uid); paint(); } catch (_) {}
    }
    btn.onclick = async (e) => {
      e.stopPropagation();
      const was = on; on = !on; paint();
      this._pulse(btn); this._haptic(on ? 'success' : 'light');
      onDelta?.(on ? 1 : -1);
      try {
        const myName = this._lastProfile?.name || me.user_metadata?.name || '';
        if (on) await SocialService.follow(me.id, uid, myName);
        else await SocialService.unfollow(me.id, uid);
      } catch (err) {
        console.error('[PF] Seguir:', err);
        on = was; paint(); onDelta?.(was ? 1 : -1);
        this._toast('No se pudo actualizar');
      }
    };
  }

  // ⋯ en el perfil de otra persona
  _otherMenu(anchor, uid) {
    const pm = this.getPlaceModal();
    const me = this.getCurrentUser();
    if (!pm?._openPopMenu || !me) return;
    pm._openPopMenu(anchor, [
      { label: 'Bloquear usuario', icon: 'trash', danger: true, onClick: async () => {
        try {
          await ReviewService.blockUser(me.id, uid);
          this._toast('Usuario bloqueado', { label: 'Deshacer', onClick: () => ReviewService.unblockUser(me.id, uid).catch(() => {}) });
        } catch (e) { console.error('[PF] Bloquear:', e); this._toast('No se pudo bloquear'); }
      } },
    ]);
  }

  // ── Vista: editar perfil ───────────────────────────────────────────
  async _viewEdit(view) {
    const me = this.getCurrentUser();
    if (!me) return;
    this._setHeader({ title: 'Editar perfil', right: null });
    let prof = this._lastProfile;
    if (!prof) { try { prof = await SocialService.getProfile(me.id); } catch (_) {} }
    if (!this._isCurrent(view)) return;
    view.innerHTML = `
      <div class="wp-pf-edit">
        <div class="wp-pf-avatar-wrap" style="margin:4px auto 14px">
          <div class="wp-pf-avatar"></div>
          <button type="button" class="wp-pf-cam" aria-label="Cambiar foto">${ICON.cam}</button>
        </div>
        <label class="wp-pf-field"><span>Nombre</span><input data-f="name" maxlength="40" autocapitalize="words" autocomplete="name"></label>
        <label class="wp-pf-field"><span>Usuario</span><div class="wp-pf-at"><i>@</i><input data-f="username" maxlength="20" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="tu.usuario"></div><em class="wp-pf-err"></em></label>
        <label class="wp-pf-field"><span>Ciudad</span><input data-f="city" maxlength="40" autocapitalize="words" placeholder="Matamoros"></label>
        <label class="wp-pf-field"><span>Sobre ti</span><textarea data-f="bio" maxlength="120" rows="3" autocapitalize="sentences" placeholder="Tacos, cafés y planes con amigos"></textarea></label>
        <button type="button" class="wp-pf-save">Guardar</button>
      </div>`;
    const av = view.querySelector('.wp-pf-avatar');
    av.style.backgroundImage = `url("${this._avatar(prof, true)}")`;
    view.querySelector('.wp-pf-cam').onclick = () => this._pickAvatar(av);
    const f = (k) => view.querySelector(`[data-f=${k}]`);
    f('name').value = this._name(prof, true);
    f('username').value = prof?.username || '';
    f('city').value = prof?.city || '';
    f('bio').value = prof?.bio || '';
    const err = view.querySelector('.wp-pf-err');
    f('username').addEventListener('input', () => {
      const v = f('username').value.toLowerCase().replace(/[^a-z0-9._]/g, '');
      if (v !== f('username').value) f('username').value = v;
      err.textContent = '';
    });
    const save = view.querySelector('.wp-pf-save');
    save.onclick = async () => {
      this._pulse(save);
      const name = f('name').value.trim();
      const username = f('username').value.trim().toLowerCase();
      if (!name) { this._toast('Escribe tu nombre'); return; }
      if (username && !/^[a-z0-9._]{3,20}$/.test(username)) { err.textContent = 'De 3 a 20 letras, números, punto o guion bajo'; return; }
      save.disabled = true; save.textContent = 'Guardando…';
      try {
        if (username && username !== (prof?.username || '')) {
          const free = await SocialService.isUsernameFree(username, me.id);
          if (!free) { err.textContent = 'Ese usuario ya está ocupado'; save.disabled = false; save.textContent = 'Guardar'; return; }
        }
        const updated = await ProfileService.updateProfile(me.id, {
          name, username: username || null, city: f('city').value.trim() || null, bio: f('bio').value.trim() || null,
        });
        this._lastProfile = updated;
        this._toast('✓ Perfil actualizado');
        this._pop();
      } catch (e) {
        console.error('[PF] Guardar perfil:', e);
        this._toast(/username|duplicate|unique/i.test(e.message || '') ? 'Ese usuario ya está ocupado' : 'No se pudo guardar');
        save.disabled = false; save.textContent = 'Guardar';
      }
    };
  }

  _pickAvatar(avEl) {
    const me = this.getCurrentUser();
    if (!me) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      avEl.classList.add('wp-pf-skel');
      try {
        const url = await ProfileService.uploadAvatar(me.id, file);
        avEl.style.backgroundImage = `url("${url}")`;
        if (this._lastProfile) this._lastProfile.avatar_url = url;
        this.onAvatarChanged(url);
        this._toast('✓ Foto actualizada');
      } catch (e) {
        console.error('[PF] Avatar:', e);
        this._toast('No se pudo subir la foto');
      } finally { avEl.classList.remove('wp-pf-skel'); }
    };
    input.click();
  }

  // ── Vista: ajustes ─────────────────────────────────────────────────
  async _viewSettings(view) {
    const me = this.getCurrentUser();
    if (!me) return;
    this._setHeader({ title: 'Ajustes', right: null });
    const prof = this._lastProfile;
    view.innerHTML = `
      <div class="wp-pf-group">
        <div class="wp-pf-set">
          <span class="wp-pf-set-txt"><b>Mostrar mis lugares guardados</b><span>Otros podrán ver que guardaste un lugar</span></span>
          <button type="button" class="wp-pf-switch" role="switch"></button>
        </div>
        <button type="button" class="wp-pf-set" data-a="blocked"><span class="wp-pf-set-txt"><b>Usuarios bloqueados</b></span>${ICON.chev}</button>
      </div>
      <div class="wp-pf-group">
        <div class="wp-pf-set"><span class="wp-pf-set-txt"><b>Cuenta</b><span></span></span></div>
        <button type="button" class="wp-pf-set wp-pf-danger" data-a="logout"><span class="wp-pf-set-txt"><b>Cerrar sesión</b></span></button>
      </div>`;
    view.querySelector('.wp-pf-group:nth-child(2) .wp-pf-set-txt span').textContent = me.email || '';
    const sw = view.querySelector('.wp-pf-switch');
    let on = !!prof?.show_saved;
    const paint = () => { sw.classList.toggle('wp-pf-on', on); sw.setAttribute('aria-checked', String(on)); };
    paint();
    sw.onclick = async () => {
      const was = on; on = !on; paint(); this._haptic('light');
      try {
        const u = await ProfileService.updateProfile(me.id, { show_saved: on });
        this._lastProfile = u;
      } catch (e) { console.error('[PF] show_saved:', e); on = was; paint(); this._toast('No se pudo cambiar'); }
    };
    view.querySelector('[data-a=blocked]').onclick = () => this._push(v => this._viewBlocked(v));
    view.querySelector('[data-a=logout]').onclick = async (e) => {
      this._pulse(e.currentTarget);
      this.close();
      try { await this.onLogout(); } catch (err) { console.error('[PF] Logout:', err); }
    };
  }

  async _viewBlocked(view) {
    const me = this.getCurrentUser();
    this._setHeader({ title: 'Usuarios bloqueados', right: null });
    view.innerHTML = '<div class="wp-pf-list"><p class="wp-pf-empty">Cargando…</p></div>';
    const box = view.querySelector('.wp-pf-list');
    let list = [];
    try { list = await SocialService.getBlocked(me.id); } catch (e) { console.warn('[PF] Bloqueados:', e.message || e); }
    if (!this._isCurrent(view)) return;
    box.innerHTML = list.length ? '' : '<p class="wp-pf-empty">No has bloqueado a nadie.</p>';
    list.forEach(p => {
      const row = document.createElement('div');
      row.className = 'wp-pf-row';
      row.innerHTML = `<span class="wp-pf-row-av" style="background-image:url('${this._avatar(p, false)}')"></span>
        <span class="wp-pf-row-txt"><b></b></span><button type="button" class="wp-pf-pill wp-pf-pill-sm">Desbloquear</button>`;
      row.querySelector('b').textContent = p.name || 'Usuario';
      const b = row.querySelector('button');
      b.onclick = async () => {
        this._pulse(b);
        try { await ReviewService.unblockUser(me.id, p.id); row.remove(); this._toast('Usuario desbloqueado'); if (!box.children.length) box.innerHTML = '<p class="wp-pf-empty">No has bloqueado a nadie.</p>'; }
        catch (e) { console.error('[PF] Desbloquear:', e); this._toast('No se pudo desbloquear'); }
      };
      box.appendChild(row);
    });
  }

  // ── Utilidades (reusa las de la ficha si están) ────────────────────
  _toast(msg, action) {
    const pm = this.getPlaceModal();
    if (pm?._showToast) pm._showToast(msg, action);
    else console.log('[PF]', msg);
  }
  _haptic(kind) { this.getPlaceModal()?._haptic?.(kind); }
  _pulse(el) {
    const pm = this.getPlaceModal();
    if (el && pm?._scaleKeys) pm._scaleKeys(el, [0.94, 1.02, 1], 220);
  }
  async _share(title, text) {
    const Share = window.Capacitor?.Plugins?.Share;
    try {
      if (Share?.share) { await Share.share({ title, text }); return; }
      if (navigator.share) { await navigator.share({ title, text }); return; }
      await navigator.clipboard?.writeText(text);
      this._toast('Texto copiado');
    } catch (_) {}
  }
  _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ── Estilos ────────────────────────────────────────────────────────
  _injectStyles() {
    if (document.getElementById('wp-pf-styles')) return;
    // Número grande del banner (letra condensada y gruesa)
    if (!document.getElementById('wp-pf-font')) {
      const l = document.createElement('link');
      l.id = 'wp-pf-font'; l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/npm/@fontsource/anton@5.2.7/400.css';
      document.head.appendChild(l);
    }
    const s = document.createElement('style');
    s.id = 'wp-pf-styles';
    s.textContent = `
      #wp-pf { position:fixed; inset:0; z-index:1400000; font-family:var(--wp-font); }
      #wp-pf .wp-pf-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.28); opacity:0; transition:opacity 0.3s ease; }
      #wp-pf.wp-pf-in .wp-pf-overlay { opacity:1; }
      #wp-pf .wp-pf-sheet {
        position:absolute; left:0; right:0; bottom:0;
        top:calc(env(safe-area-inset-top,0px) + 6px);
        background:#fff; border-radius:28px 28px 0 0;
        box-shadow:0 -8px 40px rgba(0,0,0,0.16);
        display:flex; flex-direction:column;
        transform:translateY(105%); transition:transform 0.38s cubic-bezier(0.32,0.9,0.36,1);
      }
      #wp-pf.wp-pf-in .wp-pf-sheet { transform:translateY(0); }
      /* Encabezado transparente encima del contenido, con un degradado
         blanco que se desvanece hacia abajo (mismo principio que el
         topbar de la ficha): el contenido pasa por debajo sin cortarse */
      .wp-pf-head {
        position:absolute; top:0; left:0; right:0; z-index:3; height:58px;
        display:flex; align-items:center; justify-content:space-between; padding:0 12px;
        border-radius:28px 28px 0 0;
        background:linear-gradient(to bottom, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 100%);
      }
      .wp-pf-head::after {
        content:''; position:absolute; left:0; right:0; top:100%; height:30px; pointer-events:none;
        background:linear-gradient(to bottom, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0) 100%);
      }
      .wp-pf-handle { position:absolute; left:50%; top:8px; width:38px; height:4px; margin-left:-19px; border-radius:999px; background:rgba(0,0,0,0.14); }
      /* ✕ / ⚙ / ← / ⋯ en pills gris suave */
      .wp-pf-hbtn {
        position:relative; z-index:1;
        width:48px; height:36px; padding:0; border:none; border-radius:999px; background:#f3f4f6; color:#374151;
        display:flex; align-items:center; justify-content:center; cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:background-color 0.12s;
      }
      .wp-pf-hbtn:active { background:#e5e7eb; }
      .wp-pf-htitle { flex:1; min-width:0; text-align:center; font-size:16px; font-weight:800; color:#111827;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 6px; }
      .wp-pf-body { flex:1; min-height:0; padding-top:58px; border-radius:28px 28px 0 0; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
      .wp-pf-body.wp-pf-noscroll { overflow:hidden; }
      .wp-pf-view { padding:0 16px calc(16px + env(safe-area-inset-bottom,0px)); }

      .wp-pf-top { display:flex; flex-direction:column; align-items:center; text-align:center; padding-top:2px; }
      .wp-pf-avatar-wrap { position:relative; width:92px; height:92px; }
      .wp-pf-avatar {
        width:92px; height:92px; border-radius:999px; background:#e5e7eb center/cover no-repeat;
        box-shadow:0 0 0 4px #fff, 0 6px 18px rgba(0,0,0,0.14);
      }
      .wp-pf-cam {
        position:absolute; right:-2px; bottom:2px; width:30px; height:30px; padding:0; border-radius:999px;
        border:3px solid #fff; background:#0a0a0a; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;
      }
      .wp-pf-name { margin-top:10px; font-size:22px; font-weight:800; color:#0a0a0a; letter-spacing:-0.01em; }
      .wp-pf-handle-line { margin-top:2px; font-size:13.5px; color:#6b7280; font-weight:500; min-height:18px; }
      .wp-pf-bio { margin-top:8px; font-size:14px; color:#374151; line-height:1.4; max-width:300px; }
      .wp-pf-link { border:none; background:none; padding:0; color:#2563eb; font:inherit; font-weight:700; cursor:pointer; }
      .wp-pf-stats { display:flex; gap:22px; margin:14px 0 14px; }
      .wp-pf-stats > * { border:none; background:none; padding:0; font-family:inherit; display:flex; flex-direction:column; align-items:center; cursor:pointer; -webkit-tap-highlight-color:transparent; }
      .wp-pf-stats b { font-size:17px; font-weight:800; color:#0a0a0a; }
      .wp-pf-stats span { font-size:12px; color:#6b7280; font-weight:500; }
      .wp-pf-actions { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
      .wp-pf-pill {
        height:38px; padding:0 18px; border:none; border-radius:999px; background:#f3f4f6; color:#111827;
        display:inline-flex; align-items:center; justify-content:center; gap:6px;
        font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:background-color 0.12s;
      }
      .wp-pf-pill:active { background:#e5e7eb; }
      .wp-pf-pill-dark { background:#0a0a0a; color:#fff; }
      .wp-pf-pill-dark:active { background:#262626; }
      .wp-pf-pill-sm { height:32px; padding:0 14px; font-size:13px; margin-left:auto; flex:none; }

      /* Banner "Lugares guardados": mapa de fondo en azul → lavanda, número
         grande y stickers 3D con borde blanco (como recortados) */
      .wp-pf-banner {
        width:100%; height:150px; margin-top:18px; position:relative; overflow:hidden; display:block;
        border:none; border-radius:26px; padding:0; text-align:left; color:#fff; cursor:pointer;
        background:linear-gradient(100deg,#3557ff 0%,#4f6cff 30%,#8f9ff2 66%,#c9cbf2 100%);
        box-shadow:0 10px 26px rgba(53,87,255,0.28); font-family:inherit; -webkit-tap-highlight-color:transparent;
      }
      .wp-pf-banner-map { position:absolute; inset:0; width:100%; height:100%; }
      .wp-pf-banner-l { position:absolute; left:20px; top:16px; z-index:2; display:flex; flex-direction:column; align-items:flex-start; }
      .wp-pf-banner-l > span:first-child { font-size:17px; font-weight:700; color:rgba(255,255,255,0.78); }
      .wp-pf-banner-l b {
        font-family:'Anton','Arimo',Arial,sans-serif; font-weight:400; font-size:68px; line-height:0.95; margin-top:2px;
        color:#fff; text-shadow:0 2px 10px rgba(20,30,120,0.25);
      }
      .wp-pf-banner-pill { margin-top:4px; display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px;
        background:rgba(255,255,255,0.22); font-size:12px; font-weight:700; color:#fff; }
      /* Punto azul de ubicación con brillo */
      .wp-pf-banner-dot {
        position:absolute; right:40px; top:22px; z-index:3; width:32px; height:32px; border-radius:999px;
        background:radial-gradient(circle at 38% 35%, #6aa8ff 0%, #1f5cff 55%, #1440d6 100%);
        box-shadow:0 0 0 4px rgba(255,255,255,0.85), 0 0 0 11px rgba(120,160,255,0.35), 0 6px 14px rgba(20,40,160,0.35);
      }
      .wp-pf-stickers { position:absolute; inset:0; z-index:4; pointer-events:none; }
      /* Borde blanco tipo sticker: 4 sombras sólidas + una suave */
      .wp-pf-sticker {
        position:absolute; object-fit:contain; transform:rotate(var(--r));
        filter:drop-shadow(2.5px 0 0 #fff) drop-shadow(-2.5px 0 0 #fff) drop-shadow(0 2.5px 0 #fff) drop-shadow(0 -2.5px 0 #fff)
               drop-shadow(0 5px 6px rgba(20,30,90,0.28));
      }
      .wp-pf-sticker-txt { display:flex; align-items:center; justify-content:center; font-size:46px; line-height:1;
        font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif; }

      .wp-pf-sec { display:flex; justify-content:space-between; align-items:baseline; margin:22px 2px 10px; font-size:17px; font-weight:800; color:#0a0a0a; }
      .wp-pf-sec-n { font-size:13px; font-weight:600; color:#9ca3af; border:none; background:none; padding:0; font-family:inherit; }
      .wp-pf-sec-n.wp-pf-link { color:#2563eb; font-weight:700; }
      .wp-pf-empty { margin:4px 2px; font-size:13.5px; color:#9ca3af; line-height:1.4; }

      .wp-pf-cols { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px 10px; }
      .wp-pf-col { border:none; background:none; padding:0; text-align:left; font-family:inherit; cursor:pointer; min-width:0; -webkit-tap-highlight-color:transparent; }
      .wp-pf-col-skel { height:130px; border-radius:18px; background:#f3f4f6; }
      .wp-pf-stack { position:relative; width:100%; aspect-ratio:1/1; }
      .wp-pf-stack i {
        position:absolute; inset:8% 12%; border-radius:16px; background:#e5e7eb center/cover no-repeat;
        border:3px solid #fff; box-shadow:0 4px 12px rgba(0,0,0,0.14);
        transform:translateX(var(--x)) rotate(var(--r));
      }
      .wp-pf-stack-emoji {
        position:absolute; left:4%; bottom:2%; z-index:5; width:30px; height:30px; border-radius:999px; background:#fff;
        display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 2px 8px rgba(0,0,0,0.16);
        font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;
      }
      .wp-pf-col-name { margin-top:6px; font-size:13.5px; font-weight:700; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wp-pf-col-meta { display:flex; align-items:center; gap:4px; font-size:12px; color:#6b7280; }

      .wp-pf-act-cluster { width:100%; display:flex; align-items:center; gap:14px; padding:12px 12px 12px 14px; border:none; border-radius:22px;
        background:#f7f7f8; font-family:inherit; text-align:left; cursor:pointer; -webkit-tap-highlight-color:transparent; }
      .wp-pf-act-stack { position:relative; width:94px; height:74px; flex:none; }
      .wp-pf-act-card {
        position:absolute; top:4px; width:56px; height:66px; border-radius:14px; color:#fff; border:2.5px solid #fff;
        display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.16);
        transform:rotate(var(--r)); box-sizing:border-box;
      }
      .wp-pf-act-card b { font-size:20px; line-height:1; font-weight:800; }
      .wp-pf-act-card span { font-size:10.5px; font-weight:800; letter-spacing:0.04em; }
      .wp-pf-act-txt { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .wp-pf-act-txt b { font-size:15px; font-weight:800; color:#111827; }
      .wp-pf-act-txt span { font-size:12.5px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wp-pf-act-chev { color:#9ca3af; display:flex; }

      .wp-pf-list { display:flex; flex-direction:column; gap:2px; margin-top:4px; }
      .wp-pf-row {
        width:100%; display:flex; align-items:center; gap:12px; padding:10px 8px; border:none; border-radius:999px; background:transparent;
        font-family:inherit; text-align:left; cursor:pointer; -webkit-tap-highlight-color:transparent; box-sizing:border-box;
        transition:background-color 0.12s;
      }
      .wp-pf-row:active { background:#f3f4f6; }
      .wp-pf-row-img { width:50px; height:50px; flex:none; border-radius:16px; background:#e5e7eb center/cover no-repeat; }
      .wp-pf-row-av { width:46px; height:46px; flex:none; border-radius:999px; background:#e5e7eb center/cover no-repeat; }
      .wp-pf-row-date { width:50px; height:54px; flex:none; border-radius:14px; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:10.5px; font-weight:800; }
      .wp-pf-row-date b { font-size:19px; line-height:1; }
      .wp-pf-row-txt { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .wp-pf-row-txt b { font-size:15px; font-weight:700; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wp-pf-row-txt span { font-size:12.5px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wp-pf-row-chev { color:#c4c7cc; display:flex; flex:none; }

      .wp-pf-col-head { display:flex; flex-direction:column; align-items:center; gap:6px; margin:0 0 14px; }
      .wp-pf-stack-big { width:150px; }
      .wp-pf-col-hmeta { font-size:13px; color:#6b7280; font-weight:600; margin-bottom:6px; }

      .wp-pf-edit { display:flex; flex-direction:column; gap:12px; padding-top:4px; }
      .wp-pf-field { display:flex; flex-direction:column; gap:6px; }
      .wp-pf-field > span { font-size:12.5px; font-weight:700; color:#6b7280; padding-left:6px; }
      .wp-pf-field input, .wp-pf-field textarea, .wp-pf-at {
        width:100%; box-sizing:border-box; border:1px solid rgba(0,0,0,0.06); background:#f3f4f6; border-radius:22px;
        padding:12px 16px; font-size:15px; font-family:inherit; color:#0a0a0a; outline:none;
      }
      .wp-pf-field input { border-radius:999px; height:46px; }
      .wp-pf-field input:focus, .wp-pf-field textarea:focus, .wp-pf-at:focus-within { background:#fff; border-color:#d1d5db; }
      .wp-pf-field textarea { resize:none; line-height:1.4; }
      .wp-pf-at { display:flex; align-items:center; gap:2px; height:46px; border-radius:999px; padding:0 16px; }
      .wp-pf-at i { font-style:normal; color:#9ca3af; font-weight:700; }
      .wp-pf-at input { border:none; background:transparent; padding:0; height:100%; }
      .wp-pf-at input:focus { background:transparent; }
      .wp-pf-err { font-style:normal; font-size:12px; color:#e11d48; padding-left:8px; min-height:0; }
      .wp-pf-save { margin-top:6px; height:48px; border:none; border-radius:999px; background:#0a0a0a; color:#fff; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; }
      .wp-pf-save:disabled { opacity:0.5; }

      .wp-pf-group { background:#f7f7f8; border-radius:22px; padding:4px; margin-top:12px; }
      .wp-pf-set { width:100%; display:flex; align-items:center; gap:12px; padding:12px 14px; border:none; background:transparent; border-radius:18px;
        font-family:inherit; text-align:left; color:#9ca3af; cursor:pointer; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
      button.wp-pf-set:active { background:#eef0f3; }
      .wp-pf-set-txt { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .wp-pf-set-txt b { font-size:15px; font-weight:700; color:#111827; }
      .wp-pf-set-txt span { font-size:12.5px; color:#6b7280; }
      .wp-pf-danger .wp-pf-set-txt b { color:#e11d48; }
      .wp-pf-switch { flex:none; position:relative; width:50px; height:30px; padding:0; border:none; border-radius:999px; background:#d1d5db; cursor:pointer; transition:background-color 0.18s; }
      .wp-pf-switch::after { content:''; position:absolute; left:3px; top:3px; width:24px; height:24px; border-radius:999px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.2); transition:left 0.18s; }
      .wp-pf-switch.wp-pf-on { background:#0a0a0a; }
      .wp-pf-switch.wp-pf-on::after { left:23px; }

      .wp-pf-skel { background-color:#eceef1; }
      .wp-pf-skel-line { display:inline-block; height:20px; border-radius:999px; }
    `;
    document.head.appendChild(s);
  }
}
