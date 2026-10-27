// ====================================================================
// WHATSPLAN — MiniProfile.js
// Hoja flotante con el resumen de una persona. Se abre al tocar un
// avatar en reseñas, respuestas o "Lo guardaron".
//
//   window.wpApp.miniProfile.open(uid, { context, placeId, name, avatar })
//     context: 'review' → muestra su calificación de ESTE lugar
//              'saved'  → lugares en común + sus 3 últimos guardados
//
// Datos: una sola llamada a la función mini_profile (mini_profile.sql).
// Si es mi propio usuario → abre directo mi perfil completo.
// ====================================================================
import { getSupabase }    from '/src/services/SupabaseService.js';
import { SocialService }  from '/src/services/SocialService.js';
import { MomentsService } from '/src/services/MomentsService.js';
import { getAvatarUrl }   from '/src/services/AvatarService.js';
import { photoSmall }     from '/src/utils/photo-url.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
};
const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return 'hace un momento';
  const h = s / 3600; if (h < 24) return `hace ${Math.floor(h)} h`;
  const d = h / 24;   if (d < 2) return 'ayer';
  if (d < 30) return `hace ${Math.floor(d)} días`;
  const m = d / 30;   if (m < 12) return `hace ${Math.floor(m)} ${Math.floor(m) === 1 ? 'mes' : 'meses'}`;
  const y = Math.floor(m / 12); return `hace ${y} ${y === 1 ? 'año' : 'años'}`;
};

const ICON = {
  star:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.6 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.3 3.4 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>',
  people:'<svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><circle cx="9" cy="8" r="3.6"/><path d="M2.5 19c.6-3.4 3.3-5.3 6.5-5.3s5.9 1.9 6.5 5.3z"/><circle cx="17" cy="9" r="2.8" opacity=".75"/><path d="M15.8 13.8c2.9-.2 5.1 1.4 5.7 4.6h-4.4" opacity=".75"/></svg>',
  check: '<svg width="9" height="9" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x:     '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  starO: '<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
};

export class MiniProfile {
  constructor(opts = {}) {
    this.getCurrentUser = opts.getCurrentUser || (() => window.wpApp?.currentUser || null);
    this._css();
  }

  _haptic(t) { try { window.wpApp?.mapView?.haptic?.(t); } catch (_) {} }

  async open(uid, opts = {}) {
    if (!uid) return;
    const me = this.getCurrentUser();
    if (me && me.id === uid) { window.wpApp?.openProfile?.(uid); return; } // yo → mi perfil completo
    this.close(true);
    this._haptic('light');
    const ctx = opts.context === 'saved' ? 'saved' : 'review';
    const root = document.createElement('div');
    root.id = 'wp-mp';
    root.innerHTML = `
      <div class="wp-mp-dim"></div>
      <div class="wp-mp-sheet" role="dialog" aria-label="Perfil">
        <div class="wp-mp-tint"></div>
        <div class="wp-mp-grab"></div>
        <button type="button" class="wp-mp-x" aria-label="Cerrar">${ICON.x}</button>
        <div class="wp-mp-in">
          <div class="wp-mp-ring"><span class="wp-mp-av" style="background-image:url('${esc(opts.avatar || getAvatarUrl(opts.name || 'user'))}')"></span></div>
          <div class="wp-mp-name"><span>${esc(opts.name || '')}</span></div>
          <div class="wp-mp-user wp-mp-sk" style="width:150px">&nbsp;</div>
          <div class="wp-mp-bio"></div>
          <div class="wp-mp-stats">
            ${[0, 1, 2].map(() => '<div class="wp-mp-st"><span class="wp-mp-ic wp-mp-sk"></span><b class="wp-mp-sk" style="width:34px">&nbsp;</b><small>&nbsp;</small></div>').join('')}
          </div>
          <div class="wp-mp-extra"></div>
          <div class="wp-mp-btns">
            <button type="button" class="wp-mp-btn wp-mp-sec" data-act="profile">Ver perfil</button>
            <button type="button" class="wp-mp-btn wp-mp-pri" data-act="follow" disabled>+ Seguir</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    this._root = root;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('in')));

    const sheet = root.querySelector('.wp-mp-sheet');
    root.querySelector('.wp-mp-dim').onclick = () => this.close();
    root.querySelector('.wp-mp-x').onclick = () => this.close();
    this._wireDrag(sheet);
    root.querySelector('[data-act="profile"]').onclick = () => {
      this._haptic('light');
      this.close();
      setTimeout(() => window.wpApp?.openProfile?.(uid), 120);
    };

    // Color del avatar → degradado de fondo (como el color promedio de Momentos)
    this._tintFrom(opts.avatar || getAvatarUrl(opts.name || 'user'), root);

    let d = null;
    try {
      const { data, error } = await getSupabase().rpc('mini_profile', { p_user: uid, p_place_id: opts.placeId ? String(opts.placeId) : null });
      if (error) throw error;
      d = data;
    } catch (e) {
      console.warn('[DIAG-MINIPF] mini_profile:', e.message || e);
    }
    if (this._root !== root) return; // se cerró mientras cargaba
    if (!d) {
      root.querySelector('.wp-mp-in').innerHTML = `<div class="wp-mp-empty">No se pudo cargar este perfil</div>
        <div class="wp-mp-btns"><button type="button" class="wp-mp-btn wp-mp-sec" data-act="close">Cerrar</button></div>`;
      root.querySelector('[data-act="close"]').onclick = () => this.close();
      return;
    }
    this._fill(root, d, ctx, uid);
  }

  _fill(root, d, ctx, uid) {
    const av = d.avatar_url || getAvatarUrl(d.name || 'user');
    root.querySelector('.wp-mp-av').style.backgroundImage = `url('${av.replace(/'/g, '%27')}')`;
    if (d.avatar_url) this._tintFrom(d.avatar_url, root);
    root.querySelector('.wp-mp-name').innerHTML =
      `<span>${esc(d.name || 'Usuario')}</span>${d.is_owner ? `<i class="wp-mp-chk" title="Dueño verificado">${ICON.check}</i>` : ''}`;
    const user = root.querySelector('.wp-mp-user');
    user.classList.remove('wp-mp-sk'); user.style.width = '';
    user.textContent = [d.username ? '@' + d.username : '', d.city || ''].filter(Boolean).join(' · ');
    const bio = root.querySelector('.wp-mp-bio');
    bio.textContent = d.bio || '';
    bio.style.display = d.bio ? '' : 'none';

    const stats = [
      { ic: ICON.star,   c: '#f59e0b', n: d.reviews,   t: 'Reseñas' },
      d.show_saved ? { ic: ICON.heart, c: '#ec4899', n: d.saved, t: 'Guardados' } : null,
      { ic: ICON.people, c: '#1a5cf5', n: d.followers, t: 'Seguidores', k: 'fol' },
    ].filter(Boolean);
    root.querySelector('.wp-mp-stats').innerHTML = stats.map(s =>
      `<div class="wp-mp-st"><span class="wp-mp-ic" style="background:${s.c}">${s.ic}</span><b ${s.k ? `data-k="${s.k}"` : ''}>${fmtN(s.n)}</b><small>${s.t}</small></div>`).join('');

    // Lo que cambia según desde dónde se abrió
    const extra = root.querySelector('.wp-mp-extra');
    if (ctx === 'review' && d.place_review && d.place_review.rating) {
      const r = Number(d.place_review.rating);
      extra.innerHTML = `<div class="wp-mp-conn">${ICON.starO}<span>Calificó este lugar con <b>${(Math.round(r * 10) / 10).toString()}</b> · ${esc(ago(d.place_review.created_at))}</span></div>`;
    } else if (ctx === 'saved' && d.show_saved) {
      const first = esc((d.name || 'Esta persona').split(' ')[0]);
      const line = d.common > 0
        ? `Guardó <b>${fmtN(d.common)} ${d.common === 1 ? 'lugar' : 'lugares'}</b> que tú también guardaste`
        : `${first} tiene <b>${fmtN(d.saved)}</b> ${d.saved === 1 ? 'lugar guardado' : 'lugares guardados'}`;
      const rec = Array.isArray(d.recent) ? d.recent : [];
      extra.innerHTML = `<div class="wp-mp-conn">${ICON.heart.replace('#fff', '#ec4899')}<span>${line}</span></div>
        ${rec.length ? `<div class="wp-mp-recent">${rec.map((p, i) => {
          const ph = photoSmall(p.photo_url);
          return `<button type="button" class="wp-mp-rc" data-i="${i}" style="${ph ? `background-image:url('${esc(ph)}')` : ''}"><span>${esc(p.name || '')}</span></button>`;
        }).join('')}</div><div class="wp-mp-rlbl">Sus últimos guardados</div>` : ''}`;
      extra.querySelectorAll('.wp-mp-rc').forEach(b => {
        b.onclick = () => this._openPlace(rec[+b.dataset.i]);
      });
    } else {
      extra.innerHTML = '';
    }

    // Memory vivo → aro de color en el avatar; al tocarlo se ve
    MomentsService.listActiveOf(uid).then(list => {
      if (this._root !== root || !list?.length) return;
      const ring = root.querySelector('.wp-mp-ring');
      ring.classList.add('live');
      ring.onclick = () => { this._haptic('light'); this.close(); window.wpApp?.momentsUI?.open?.(list, 0); };
    }).catch(() => {});

    // Seguir
    const btn = root.querySelector('[data-act="follow"]');
    let on = !!d.i_follow;
    const paint = () => { btn.textContent = on ? 'Siguiendo' : '+ Seguir'; btn.classList.toggle('on', on); };
    btn.disabled = false; paint();
    btn.onclick = async () => {
      const me = this.getCurrentUser();
      if (!me) { this._toast('Inicia sesión para seguir a otras personas'); return; }
      on = !on; paint(); this._haptic(on ? 'success' : 'light');
      const fol = root.querySelector('[data-k="fol"]');
      const n0 = Number(d.followers) || 0;
      d.followers = Math.max(0, n0 + (on ? 1 : -1));
      if (fol) fol.textContent = fmtN(d.followers);
      try {
        const myName = me.user_metadata?.display_name || me.user_metadata?.full_name || me.email?.split('@')[0] || '';
        if (on) await SocialService.follow(me.id, uid, myName);
        else    await SocialService.unfollow(me.id, uid);
        document.dispatchEvent(new CustomEvent('wp:follow-changed', { detail: { uid, on } }));
      } catch (e) {
        console.warn('[DIAG-MINIPF] seguir:', e.message || e);
        on = !on; paint(); d.followers = n0; if (fol) fol.textContent = fmtN(n0);
        this._toast('No se pudo actualizar');
      }
    };
  }

  async _openPlace(p) {
    if (!p) return;
    this._haptic('light');
    const pm = window.wpApp?.placeModal;
    if (!pm) return;
    let place = (window.wpApp?.mapView?.allPlaces || []).find(x => String(x.place_id) === String(p.place_id));
    if (!place && p.category) {
      try {
        const res = await fetch('/api/supabase-places?category=' + encodeURIComponent(p.category));
        const j = await res.json();
        place = (j.places || []).find(x => String(x.place_id) === String(p.place_id));
      } catch (_) {}
    }
    if (!place) { this._toast('No se pudo abrir este lugar'); return; }
    this.close();
    setTimeout(() => { pm._fromSearch = false; pm.show(place); }, 140);
  }

  close(instant = false) {
    const root = this._root;
    if (!root) return;
    this._root = null;
    if (instant) { root.remove(); return; }
    // Si se estaba arrastrando, el transform en línea le ganaba a la
    // regla .out del CSS: la hoja se quedaba parada a medio camino hasta
    // que se borraba (el "congelón"). Ahora la salida sale desde donde
    // está el dedo, en línea.
    const sheet = root.querySelector('.wp-mp-sheet');
    const dim = root.querySelector('.wp-mp-dim');
    if (sheet) {
      sheet.style.transition = 'transform .24s cubic-bezier(0.4,0,1,1)';
      sheet.style.transform = 'translate3d(0,110%,0)';
    }
    if (dim) { dim.style.transition = 'opacity .24s ease'; dim.style.opacity = '0'; }
    root.classList.remove('in');
    root.style.pointerEvents = 'none';
    setTimeout(() => root.remove(), 280);
  }

  // Arrastrar hacia abajo para cerrar. Captura el dedo (aunque salga de
  // la hoja sigue el gesto), mueve con requestAnimationFrame (un cambio
  // por cuadro) y el fondo se aclara conforme baja.
  _wireDrag(sheet) {
    const dim = sheet.parentElement?.querySelector('.wp-mp-dim');
    let y0 = null, dy = 0, lastY = 0, lastT = 0, vy = 0, raf = 0, id = null;
    const paint = () => {
      raf = 0;
      sheet.style.transform = `translate3d(0,${dy}px,0)`;
      if (dim) dim.style.opacity = String(Math.max(0, 1 - dy / 420));
    };
    sheet.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      y0 = e.clientY; dy = 0; lastY = e.clientY; lastT = performance.now(); vy = 0; id = e.pointerId;
      try { sheet.setPointerCapture(id); } catch (_) {}
      sheet.style.transition = 'none';
      if (dim) dim.style.transition = 'none';
    });
    sheet.addEventListener('pointermove', (e) => {
      if (y0 === null || e.pointerId !== id) return;
      const raw = e.clientY - y0;
      dy = raw > 0 ? raw : raw / 6; // hacia arriba: resistencia elástica
      const t = performance.now();
      if (t > lastT) vy = (e.clientY - lastY) / (t - lastT); // px/ms
      lastY = e.clientY; lastT = t;
      if (!raf) raf = requestAnimationFrame(paint);
    });
    const up = (e) => {
      if (y0 === null || (e && e.pointerId !== id)) return;
      y0 = null;
      try { sheet.releasePointerCapture(id); } catch (_) {}
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (dy > 110 || (dy > 24 && vy > 0.55)) { this.close(); return; }
      sheet.style.transition = 'transform .34s cubic-bezier(0.32,1.25,0.5,1)';
      sheet.style.transform = 'translate3d(0,0,0)';
      if (dim) { dim.style.transition = 'opacity .25s ease'; dim.style.opacity = ''; }
    };
    sheet.addEventListener('pointerup', up);
    sheet.addEventListener('pointercancel', up);
  }

  // Color promedio del avatar (si la imagen lo permite) → fondo suave
  _tintFrom(url, root) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 12;
          const g = c.getContext('2d'); g.drawImage(img, 0, 0, 12, 12);
          const px = g.getImageData(0, 0, 12, 12).data;
          let r = 0, gg = 0, b = 0, n = 0;
          for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 128) continue; r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++; }
          if (!n || this._root !== root) return;
          r = Math.round(r / n); gg = Math.round(gg / n); b = Math.round(b / n);
          root.querySelector('.wp-mp-tint').style.background =
            `linear-gradient(180deg, rgba(${r},${gg},${b},0.42) 0%, rgba(${r},${gg},${b},0.14) 58%, rgba(255,255,255,0) 100%)`;
        } catch (_) {}
      };
      img.src = url;
    } catch (_) {}
  }

  _toast(msg) {
    let t = document.getElementById('wp-mp-toast');
    if (!t) { t = document.createElement('div'); t.id = 'wp-mp-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), 2400);
  }

  _css() {
    if (document.getElementById('wp-mp-css')) return;
    const st = document.createElement('style');
    st.id = 'wp-mp-css';
    st.textContent = `
      #wp-mp { position:fixed; inset:0; z-index:1500400; font-family:var(--wp-font, system-ui); }
      #wp-mp .wp-mp-dim { position:absolute; inset:0; background:rgba(17,24,39,0.32); opacity:0; transition:opacity .28s ease; }
      #wp-mp.in .wp-mp-dim { opacity:1; }
      #wp-mp .wp-mp-sheet {
        position:absolute; left:10px; right:10px; bottom:calc(10px + env(safe-area-inset-bottom,0px));
        border-radius:30px; background:#fff; overflow:hidden; touch-action:none; will-change:transform;
        transform:translateY(110%); transition:transform .38s cubic-bezier(0.32,1.25,0.5,1);
        box-shadow:0 0 0 .5px rgba(17,24,39,.07), 0 1px 2px rgba(17,24,39,.07), 0 8px 16px -4px rgba(17,24,39,.12), 0 26px 48px -12px rgba(17,24,39,.3);
      }
      #wp-mp.in .wp-mp-sheet { transform:translateY(0); }
      #wp-mp.out .wp-mp-sheet { transform:translateY(110%); transition:transform .26s ease-in; }
      #wp-mp.out .wp-mp-dim { opacity:0; }
      .wp-mp-tint { position:absolute; left:0; right:0; top:0; height:180px; pointer-events:none;
        background:linear-gradient(180deg, rgba(167,139,250,.42), rgba(236,72,153,.14) 58%, rgba(255,255,255,0)); transition:background .4s; }
      .wp-mp-grab { position:relative; width:38px; height:5px; border-radius:3px; background:rgba(17,24,39,.18); margin:8px auto 0; }
      .wp-mp-x { position:absolute; top:12px; right:12px; z-index:2; width:36px; height:36px; border:none; border-radius:50%;
        background:rgba(255,255,255,.88); color:#111; display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,.12); cursor:pointer; -webkit-tap-highlight-color:transparent; }
      .wp-mp-x:active { transform:scale(.9); }
      .wp-mp-in { position:relative; display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; padding:12px 20px 18px; }
      .wp-mp-ring { padding:3px; border-radius:50%; background:#fff; }
      .wp-mp-ring.live { background:conic-gradient(#1a5cf5,#8b5cf6,#ec4899,#f59e0b,#1a5cf5); cursor:pointer; }
      .wp-mp-av { display:block; width:84px; height:84px; border-radius:50%; border:3px solid #fff; background:#eef0f3 center/cover no-repeat;
        box-shadow:0 6px 16px rgba(17,24,39,.18); }
      .wp-mp-name { margin-top:4px; display:flex; align-items:center; justify-content:center; gap:6px; max-width:100%;
        font-size:20px; font-weight:800; color:#0a0a0a; min-height:27px; }
      .wp-mp-name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wp-mp-chk { flex-shrink:0; width:17px; height:17px; border-radius:50%; background:#1a5cf5; display:inline-flex; align-items:center; justify-content:center; }
      .wp-mp-user { font-size:13px; color:#8a8f99; min-height:18px; }
      .wp-mp-bio { font-size:13.5px; line-height:1.4; color:#374151; max-width:300px;
        display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
      .wp-mp-stats { display:flex; width:100%; margin:10px 0 4px; }
      .wp-mp-st { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; min-width:0; }
      .wp-mp-ic { width:30px; height:30px; border-radius:10px; display:flex; align-items:center; justify-content:center;
        box-shadow:inset 0 -2px 3px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.4); }
      .wp-mp-st b { font-size:18px; font-weight:800; color:#0a0a0a; min-height:24px; }
      .wp-mp-st small { font-size:11.5px; color:#8a8f99; }
      .wp-mp-extra { width:100%; display:flex; flex-direction:column; gap:8px; }
      .wp-mp-extra:empty { display:none; }
      .wp-mp-conn { display:flex; align-items:center; justify-content:center; gap:8px; background:#f4f5f7; border-radius:14px;
        padding:9px 12px; font-size:12.5px; color:#374151; text-align:left; }
      .wp-mp-conn svg { flex-shrink:0; }
      .wp-mp-recent { display:flex; gap:8px; }
      .wp-mp-rc { flex:1; height:66px; border:none; border-radius:14px; padding:0; position:relative; overflow:hidden; cursor:pointer;
        background:#eef0f3 center/cover no-repeat; -webkit-tap-highlight-color:transparent; transition:transform .15s; }
      .wp-mp-rc:active { transform:scale(.95); }
      .wp-mp-rc span { position:absolute; left:0; right:0; bottom:0; padding:12px 7px 5px; font-size:10.5px; font-weight:700; color:#fff; text-align:left;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; background:linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0)); }
      .wp-mp-rlbl { font-size:11.5px; color:#8a8f99; text-align:left; margin-top:-2px; }
      .wp-mp-btns { display:flex; gap:8px; width:100%; margin-top:8px; }
      .wp-mp-btn { height:46px; border:none; border-radius:999px; font-family:inherit; font-size:14.5px; font-weight:700; cursor:pointer;
        -webkit-tap-highlight-color:transparent; transition:transform .15s, background .2s, color .2s, box-shadow .2s; }
      .wp-mp-btn:active { transform:scale(.96); }
      .wp-mp-sec { flex:1; background:#f1f2f5; color:#111827; }
      .wp-mp-pri { flex:1.3; color:#fff; background:linear-gradient(150deg,#4a74f5,#1a5cf5 60%,#1540cc);
        box-shadow:0 6px 16px rgba(26,92,245,.35), inset 0 1px 0 rgba(255,255,255,.3); }
      .wp-mp-pri.on { background:#f1f2f5; color:#6b7280; box-shadow:none; }
      .wp-mp-pri:disabled { opacity:.6; }
      .wp-mp-sk { display:inline-block; border-radius:8px; background:linear-gradient(90deg,#eef0f3 0%,#f6f7f9 50%,#eef0f3 100%);
        background-size:200% 100%; animation:wpMpSk 1.1s linear infinite; color:transparent; }
      @keyframes wpMpSk { to { background-position:-200% 0; } }
      .wp-mp-empty { padding:40px 0 8px; font-size:14px; color:#8a8f99; }
      #wp-mp-toast { position:fixed; left:50%; bottom:calc(120px + env(safe-area-inset-bottom,0px)); z-index:1500500;
        transform:translateX(-50%) translateY(8px); opacity:0; pointer-events:none; transition:opacity .2s, transform .2s;
        max-width:86vw; padding:10px 16px; border-radius:999px; background:rgba(17,24,39,.94); color:#fff;
        font:600 13px var(--wp-font, system-ui); text-align:center; }
      #wp-mp-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
    `;
    document.head.appendChild(st);
  }
}
