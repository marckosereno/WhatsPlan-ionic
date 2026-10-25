// ====================================================================
// WHATSPLAN — MomentsUI.js
// Cámara → compartir momento (12 h) · visor tipo stories · stickers en el
// mapa · sección "Memories" del perfil.
// Datos: MomentsService (moments.sql). Las fotos se comprimen en el
// teléfono antes de subir: 720px (~70 KB) + miniatura 200px.
// ====================================================================
import { MomentsService as MS } from '/src/services/MomentsService.js';
import { getAvatarUrl } from '/src/services/AvatarService.js';

const MOODS = ['😋', '🤩', '😎', '🥰', '🔥', '✨'];
const SEEN_KEY = 'wpMomentsSeen';
const ESC = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PIN = (fill = '#1a5cf5', dot = '#fff') => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 10.4C19 16.1 12 21 12 21S5 16.1 5 10.4a7 7 0 0 1 14 0Z" fill="${fill}"/><circle cx="12" cy="10" r="2.6" fill="${dot}"/></svg>`;
const X_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M17 7 7 17M7 7l10 10" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
const HEART = (c = '#ec4899') => `<svg width="17" height="17" viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.6 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.3 3.4 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" fill="${c}"/></svg>`;

function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch (_) {} }
function seenSet() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (_) { return new Set(); } }
function markSeen(id) {
  try {
    const s = seenSet(); s.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-400)));
  } catch (_) {}
}
function ago(iso) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
function left(iso) {
  const m = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000));
  return m >= 60 ? `quedan ${Math.round(m / 60)} h` : `quedan ${m} min`;
}
function lifeFrac(m) { // 1 = recién publicado, 0 = por vencer
  const t0 = Date.parse(m.created_at), t1 = Date.parse(m.expires_at);
  return Math.max(0, Math.min(1, (t1 - Date.now()) / Math.max(1, t1 - t0)));
}
function distM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export class MomentsUI {
  constructor(opts = {}) {
    this.getCurrentUser = opts.getCurrentUser || (() => null);
    this.getMap         = opts.getMap || (() => null);
    this.getPlaces      = opts.getPlaces || (() => []);
    this.getGpsPos      = opts.getGpsPos || (() => null);
    this.onOpenPlace    = opts.onOpenPlace || (() => {});
    this.onNeedLogin    = opts.onNeedLogin || (() => {});
    this._markers = [];
    this._css();
  }

  // ════ CÁMARA ════════════════════════════════════════════════════════
  async openCamera() {
    const me = this.getCurrentUser();
    if (!me) { this._toast('Inicia sesión para compartir momentos'); this.onNeedLogin(); return; }
    let quota = null;
    try { quota = await MS.quota(); } catch (_) {}
    if (quota && quota.today >= MS.DAY_LIMIT) { this._toast(`Ya compartiste ${MS.DAY_LIMIT} momentos hoy`); return; }
    // Cámara del teléfono (en la app abre la cámara nativa)
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment');
    input.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      try {
        const prepared = await this._prepare(file);
        this._compose(prepared, quota);
      } catch (e) {
        console.error('[MO] foto:', e);
        this._toast('No se pudo leer la foto');
      }
    };
    input.click();
  }

  // Comprime: foto 720px (lado corto) máx. 1280 de alto, WebP ~0.72 +
  // miniatura 200px + color promedio
  async _prepare(file) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) {
      src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    }
    const W = src.width, H = src.height;
    const draw = (maxW, maxH) => {
      const k = Math.min(1, maxW / W, maxH / H);
      const c = document.createElement('canvas');
      c.width = Math.round(W * k); c.height = Math.round(H * k);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c;
    };
    const toBlob = (c, q) => new Promise(res => c.toBlob(b => {
      if (b && b.type === 'image/webp') res(b);
      else c.toBlob(j => res(j), 'image/jpeg', q); // sin WebP → JPEG
    }, 'image/webp', q));
    const portrait = H >= W;
    const big = draw(portrait ? 720 : 1280, portrait ? 1280 : 720);
    const small = draw(200, 200);
    const photo = await toBlob(big, 0.72);
    const thumb = await toBlob(small, 0.6);
    const px = draw(1, 1).getContext('2d').getImageData(0, 0, 1, 1).data;
    const color = '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    return { photo, thumb, color, previewUrl: URL.createObjectURL(photo) };
  }

  async _detectPlaces() {
    let pos = this.getGpsPos();
    if (!pos && navigator.geolocation) {
      pos = await new Promise(res => navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null),
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }));
    }
    if (!pos) return { pos: null, list: [] };
    const list = (this.getPlaces() || [])
      .map(p => ({ p, lat: p.location?.lat ?? p.lat, lng: p.location?.lng ?? p.lng }))
      .filter(x => x.lat && x.lng)
      .map(x => ({ id: String(x.p.place_id || x.p.id), name: x.p.name, lat: x.lat, lng: x.lng, d: distM(pos, x) }))
      .filter(x => x.d <= 300)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
    return { pos, list };
  }

  // ════ COMPARTIR ═════════════════════════════════════════════════════
  async _compose(prep, quota) {
    document.getElementById('wp-mo-compose')?.remove();
    const root = document.createElement('div');
    root.id = 'wp-mo-compose';
    const monthLeft = quota ? Math.max(0, MS.MONTH_LIMIT - quota.monthSaved) : null;
    root.innerHTML = `
      <div class="wp-mo-photo" style="background-color:${prep.color};background-image:url('${prep.previewUrl}')"></div>
      <div class="wp-mo-top">
        <button type="button" class="wp-mo-round wp-mo-glass" data-a="back" aria-label="Volver"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M11 6l-6 6 6 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button type="button" class="wp-mo-pill wp-mo-glass wp-mo-place" data-a="place">${PIN('#fff', '#1a5cf5')}<span>Buscando lugar…</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg></button>
        <span style="width:42px"></span>
      </div>
      <div class="wp-mo-sheet">
        <div class="wp-mo-handle"></div>
        <input class="wp-mo-input" type="text" maxlength="140" placeholder="Escribe algo…" enterkeyhint="done" autocomplete="off">
        <div class="wp-mo-moods">${MOODS.map(m => `<button type="button" class="wp-mo-mood" data-mood="${m}">${m}</button>`).join('')}</div>
        <div class="wp-mo-seg">
          <button type="button" class="on" data-vis="followers">Seguidores</button>
          <button type="button" data-vis="public">Público</button>
          <button type="button" data-vis="private">Solo yo</button>
        </div>
        <label class="wp-mo-row">
          <span><b>Guardar también como memory</b><small>${monthLeft === null ? `Hasta ${MS.MONTH_LIMIT} al mes` : monthLeft ? `Te quedan ${monthLeft} de ${MS.MONTH_LIMIT} este mes` : 'Ya usaste tus 14 de este mes'}</small></span>
          <span class="wp-mo-sw${monthLeft === 0 ? ' off-dis' : ''}" data-a="mem"></span>
        </label>
        <button type="button" class="wp-mo-cta" data-a="send">Compartir momento</button>
        <div class="wp-mo-note">Se borra en ${MS.HOURS} h, a menos que lo guardes como memory</div>
      </div>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('in'));

    let place = null, mood = null, vis = 'followers', mem = false, busy = false;
    const placeBtn = root.querySelector('[data-a=place]');
    const setPlace = (p) => { place = p; placeBtn.querySelector('span').textContent = p?.name || 'Ubicación actual'; };
    const det = await this._detectPlaces();
    if (!root.isConnected) return;
    if (det.list[0] && det.list[0].d <= 120) setPlace(det.list[0]);
    else setPlace(det.pos ? { id: null, name: null, lat: det.pos.lat, lng: det.pos.lng } : null);
    if (!det.pos) placeBtn.querySelector('span').textContent = 'Sin ubicación';

    const close = () => { root.classList.remove('in'); setTimeout(() => { root.remove(); URL.revokeObjectURL(prep.previewUrl); }, 260); };
    root.querySelector('[data-a=back]').onclick = close;
    placeBtn.onclick = () => {
      if (!det.pos) { this._toast('Activa tu ubicación para ubicar el momento'); return; }
      const items = [...det.list.map(p => ({ label: p.name, sub: `${Math.round(p.d)} m`, p })),
        { label: 'Solo mi ubicación', sub: 'Sin lugar', p: { id: null, name: null, lat: det.pos.lat, lng: det.pos.lng } }];
      this._pickList(placeBtn, items, (it) => setPlace(it.p));
    };
    root.querySelectorAll('.wp-mo-mood').forEach(b => b.onclick = () => {
      const m = b.dataset.mood; mood = mood === m ? null : m; haptic();
      root.querySelectorAll('.wp-mo-mood').forEach(x => x.classList.toggle('on', x.dataset.mood === mood));
    });
    root.querySelectorAll('[data-vis]').forEach(b => b.onclick = () => {
      vis = b.dataset.vis; haptic();
      root.querySelectorAll('[data-vis]').forEach(x => x.classList.toggle('on', x === b));
    });
    const sw = root.querySelector('[data-a=mem]');
    sw.parentElement.onclick = (e) => {
      e.preventDefault();
      if (monthLeft === 0) { this._toast(`Ya guardaste tus ${MS.MONTH_LIMIT} memories de este mes`); return; }
      mem = !mem; sw.classList.toggle('on', mem); haptic();
    };
    const cta = root.querySelector('[data-a=send]');
    cta.onclick = async () => {
      if (busy) return;
      const me = this.getCurrentUser();
      if (!me) { this._toast('Inicia sesión para compartir'); return; }
      if (!place || (place.lat == null)) { this._toast('Necesito tu ubicación para ponerlo en el mapa'); return; }
      busy = true; cta.classList.add('busy'); cta.innerHTML = '<span class="wp-mo-spin"></span>Compartiendo…';
      try {
        await MS.create({ userId: me.id, photo: prep.photo, thumb: prep.thumb, color: prep.color, place,
          caption: root.querySelector('.wp-mo-input').value.trim(), mood, visibility: vis, saveAsMemory: mem });
        haptic(18);
        this._toast(mem ? '✓ Momento compartido y guardado' : '✓ Momento compartido');
        close();
        this.refreshMap();
        this._profileRefresh?.();
      } catch (e) {
        console.error('[MO] compartir:', e);
        this._toast(e.message || 'No se pudo compartir');
        busy = false; cta.classList.remove('busy'); cta.textContent = 'Compartir momento';
      }
    };
  }

  // ════ VISOR ═════════════════════════════════════════════════════════
  open(list, start = 0) {
    if (!list?.length) return;
    document.getElementById('wp-mo-viewer')?.remove();
    const me = this.getCurrentUser();
    const root = document.createElement('div');
    root.id = 'wp-mo-viewer';
    root.innerHTML = `
      <div class="wp-mo-photo"></div>
      <div class="wp-mo-shade"></div>
      <div class="wp-mo-bars">${list.map(() => '<i><b></b></i>').join('')}</div>
      <div class="wp-mo-head">
        <span class="wp-mo-av"></span>
        <span class="wp-mo-who"><b></b><small></small></span>
        <button type="button" class="wp-mo-round wp-mo-glass wp-mo-more" aria-label="Opciones"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>
        <button type="button" class="wp-mo-round wp-mo-glass" data-a="close" aria-label="Cerrar" style="color:#fff">${X_ICON}</button>
      </div>
      <div class="wp-mo-tap wp-mo-tap-l"></div><div class="wp-mo-tap wp-mo-tap-r"></div>
      <div class="wp-mo-foot">
        <div class="wp-mo-cap"></div>
        <button type="button" class="wp-mo-pill wp-mo-white wp-mo-placechip"></button>
        <div class="wp-mo-own"></div>
      </div>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('in'));

    const photo = root.querySelector('.wp-mo-photo');
    const bars = [...root.querySelectorAll('.wp-mo-bars b')];
    let i = start, t0 = 0, paused = false, pausedAt = 0, raf = 0, closed = false;
    const DUR = 5500;

    const close = () => {
      if (closed) return; closed = true;
      cancelAnimationFrame(raf);
      root.classList.remove('in');
      setTimeout(() => root.remove(), 240);
      this.refreshMap(true); // repinta aros (vistos)
    };
    const show = (k) => {
      i = k; const m = list[i];
      if (!m) { close(); return; }
      bars.forEach((b, j) => { b.style.width = j < i ? '100%' : '0%'; });
      photo.style.backgroundColor = m.color || '#111';
      photo.style.backgroundImage = `url('${MS.url(m.thumb_path)}')`; // miniatura al instante (ya en caché)
      const full = new Image();
      full.onload = () => { if (list[i] === m) photo.style.backgroundImage = `url('${full.src}')`; };
      full.src = MS.url(m.photo_path);
      if (list[i + 1]) { const nx = new Image(); nx.src = MS.url(list[i + 1].photo_path); } // precarga solo el siguiente
      const prof = m.profiles || {};
      const mine = me && m.user_id === me.id;
      const alive = Date.parse(m.expires_at) > Date.now();
      root.querySelector('.wp-mo-av').style.backgroundImage = `url('${ESC(prof.avatar_url || getAvatarUrl(prof.name || 'user'))}')`;
      root.querySelector('.wp-mo-who b').textContent = mine ? 'Tu momento' : (prof.name || 'Usuario');
      root.querySelector('.wp-mo-who small').textContent = alive ? `${ago(m.created_at)} · ${left(m.expires_at)}` : `Memory · ${new Date(m.saved_at || m.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      root.querySelector('.wp-mo-more').style.display = mine ? '' : 'none';
      const cap = root.querySelector('.wp-mo-cap');
      cap.textContent = [m.caption, m.mood].filter(Boolean).join(' ');
      cap.style.display = cap.textContent ? '' : 'none';
      const chip = root.querySelector('.wp-mo-placechip');
      chip.style.display = m.place_name ? '' : 'none';
      chip.innerHTML = `${PIN()}<span>${ESC(m.place_name || '')}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="#111827" stroke-width="2.6" stroke-linecap="round"/></svg>`;
      chip.onclick = (e) => { e.stopPropagation(); if (!m.place_id) return; close(); setTimeout(() => this.onOpenPlace(m.place_id), 200); };
      // Pie: en los míos, vistas + "Guardar como memory"
      const own = root.querySelector('.wp-mo-own');
      own.innerHTML = '';
      if (mine) {
        own.innerHTML = `<div class="wp-mo-views"></div>
          <button type="button" class="wp-mo-pill wp-mo-white wp-mo-save">${m.saved ? '✓ Guardada en tus memories' : alive ? `${HEART()}Guardar como memory <em></em>` : ''}</button>`;
        const save = own.querySelector('.wp-mo-save');
        if (!m.saved && !alive) save.style.display = 'none';
        if (!m.saved && alive) {
          MS.quota().then(q => { const em = save.querySelector('em'); if (em) em.textContent = `${q.monthSaved}/${MS.MONTH_LIMIT}`; }).catch(() => {});
          save.onclick = async (e) => {
            e.stopPropagation(); paused = true; pausedAt = performance.now();
            save.disabled = true;
            try {
              const upd = await MS.saveAsMemory(m.id);
              Object.assign(m, upd); haptic(18);
              save.innerHTML = '✓ Guardada en tus memories';
              this._toast('♥ Guardado en tus memories');
              this._profileRefresh?.();
            } catch (err) { this._toast(err.message || 'No se pudo guardar'); save.disabled = false; }
            resume();
          };
        } else if (m.saved) {
          save.classList.add('done');
          save.onclick = (e) => e.stopPropagation();
        }
        if (alive) MS.viewers(m.id).then(vs => {
          if (list[i] !== m) return;
          const box = own.querySelector('.wp-mo-views');
          if (!vs.length) { box.textContent = 'Nadie lo ha visto todavía'; return; }
          const first = (vs[0].name || 'Alguien').split(' ')[0];
          box.innerHTML = `<span class="wp-mo-fp">${vs.slice(0, 3).map(v => `<i style="background-image:url('${ESC(v.avatar_url || getAvatarUrl(v.name || 'user'))}')"></i>`).join('')}</span>${ESC(first)}${vs.length > 1 ? ` y ${vs.length - 1} más lo vieron` : ' lo vio'}`;
        }).catch(() => {});
      } else if (alive) {
        MS.markViewed(m.id);
      }
      markSeen(m.id);
      t0 = performance.now();
    };
    const resume = () => { if (!paused) return; t0 += performance.now() - pausedAt; paused = false; };
    const tick = (now) => {
      if (closed) return;
      if (!paused) {
        const k = Math.min(1, (now - t0) / DUR);
        if (bars[i]) bars[i].style.width = (k * 100) + '%';
        if (k >= 1) { if (i < list.length - 1) show(i + 1); else { close(); return; } }
      }
      raf = requestAnimationFrame(tick);
    };
    show(start);
    raf = requestAnimationFrame(tick);

    // Tocar izquierda/derecha = anterior/siguiente · mantener = pausa ·
    // deslizar hacia abajo = cerrar
    let downAt = 0, y0 = 0, dy = 0;
    const onDown = (e) => { downAt = performance.now(); y0 = e.clientY; dy = 0; paused = true; pausedAt = downAt; };
    const onMove = (e) => { if (!downAt) return; dy = Math.max(0, e.clientY - y0); root.style.transform = dy ? `translateY(${dy}px) scale(${1 - dy / 3000})` : ''; };
    const onUp = (side) => (e) => {
      const held = performance.now() - downAt; downAt = 0;
      root.style.transform = '';
      if (dy > 110) { close(); return; }
      resume();
      if (held < 250 && dy < 10) { haptic(6); if (side === 'l') show(Math.max(0, i - 1)); else if (i < list.length - 1) show(i + 1); else close(); }
    };
    ['l', 'r'].forEach(side => {
      const z = root.querySelector('.wp-mo-tap-' + side);
      z.addEventListener('pointerdown', onDown);
      z.addEventListener('pointermove', onMove);
      z.addEventListener('pointerup', onUp(side));
      z.addEventListener('pointercancel', () => { downAt = 0; root.style.transform = ''; resume(); });
    });
    root.querySelector('[data-a=close]').onclick = close;
    root.querySelector('.wp-mo-more').onclick = (e) => {
      e.stopPropagation();
      const m = list[i];
      paused = true; pausedAt = performance.now();
      this._pickList(e.currentTarget, [
        ...(m.saved ? [{ label: 'Quitar de mis memories', p: 'unsave' }] : []),
        { label: 'Eliminar', sub: 'No se puede deshacer', p: 'del', danger: true },
      ], async (it) => {
        try {
          if (it.p === 'unsave') { await MS.unsave(m.id); m.saved = false; this._toast('Quitada de tus memories'); this._profileRefresh?.(); show(i); }
          if (it.p === 'del') {
            await MS.remove(m); this._toast('Momento eliminado'); this._profileRefresh?.();
            list.splice(i, 1); bars[i]?.parentElement.remove(); bars.splice(i, 1);
            if (!list.length) { close(); return; }
            show(Math.min(i, list.length - 1));
          }
        } catch (err) { this._toast(err.message || 'No se pudo'); }
        resume();
      }, () => resume());
    };
  }

  // ════ MAPA ══════════════════════════════════════════════════════════
  // Un sticker por lugar (o por punto cercano): aro azul con el arco del
  // tiempo que le queda; gris si ya lo viste. Mis memories vencidas →
  // polaroid con ♥.
  async refreshMap(soft = false) {
    const map = this.getMap();
    if (!map || !window.maplibregl) return;
    if (!soft || !this._cache) {
      try {
        const me = this.getCurrentUser();
        const [active, mine] = await Promise.all([
          MS.listActive().catch(() => []),
          me ? MS.listMemories(me.id, 40).catch(() => []) : Promise.resolve([]),
        ]);
        this._cache = { active, memories: mine.filter(m => Date.parse(m.expires_at) <= Date.now()) };
      } catch (_) { return; }
    }
    this._markers.forEach(mk => mk.remove());
    this._markers = [];
    const seen = seenSet();
    const groups = new Map();
    this._cache.active.forEach(m => {
      if (m.lat == null || m.lng == null) return;
      const k = m.place_id || `${(m.lat * 2500).toFixed(0)}:${(m.lng * 2500).toFixed(0)}`; // ~40 m
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    });
    groups.forEach(items => {
      items.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      const newest = items[items.length - 1];
      const unseen = items.some(m => !seen.has(m.id));
      const pct = Math.round(lifeFrac(newest) * 100);
      const prof = newest.profiles || {};
      const el = document.createElement('div');
      el.className = 'wp-mo-mk';
      el.innerHTML = `
        <div class="wp-mo-ring" style="background:${unseen ? `conic-gradient(#1a5cf5 0 ${pct}%, #c7d2fe ${pct}% 100%)` : '#d1d5db'}">
          <div class="wp-mo-in" style="background-color:${newest.color || '#ddd'};background-image:url('${MS.url(newest.thumb_path)}')"></div>
        </div>
        <span class="wp-mo-mk-av" style="background-image:url('${ESC(prof.avatar_url || getAvatarUrl(prof.name || 'user'))}')"></span>
        ${items.length > 1 ? `<span class="wp-mo-mk-n">${items.length}</span>` : ''}`;
      el.addEventListener('click', (e) => { e.stopPropagation(); haptic(); this.open(items, Math.max(0, items.findIndex(m => !seen.has(m.id)))); });
      const mk = new window.maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([newest.lng, newest.lat]).addTo(map);
      el.style.zIndex = '650';
      this._markers.push(mk);
    });
    (this._cache.memories || []).forEach(m => {
      if (m.lat == null || m.lng == null) return;
      const el = document.createElement('div');
      el.className = 'wp-mo-pol';
      el.innerHTML = `<div class="wp-mo-pol-ph" style="background-color:${m.color || '#ddd'};background-image:url('${MS.url(m.thumb_path)}')"></div><span>${HEART('#fff').replace('width="17" height="17"', 'width="10" height="10"')}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); haptic(); this.open([m]); });
      const mk = new window.maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([m.lng, m.lat]).addTo(map);
      el.style.zIndex = '640';
      this._markers.push(mk);
    });
  }

  startMap() {
    const me = this.getCurrentUser();
    if (me) MS.cleanupMine(me.id).catch(() => {}); // borra mis vencidos sin guardar
    this.refreshMap();
    clearInterval(this._mapTimer); clearInterval(this._ringTimer);
    this._mapTimer = setInterval(() => this.refreshMap(), 3 * 60 * 1000);   // nuevos momentos
    this._ringTimer = setInterval(() => this.refreshMap(true), 60 * 1000);  // arcos de tiempo
  }

  // ════ PERFIL ════════════════════════════════════════════════════════
  async renderProfile(box, uid, isMe) {
    if (!box) return;
    const paint = async () => {
      let active = [], mems = [], q = null;
      try {
        [active, mems, q] = await Promise.all([
          MS.listActiveOf(uid).catch(() => []),
          MS.listMemories(uid).catch(() => []),
          isMe ? MS.quota().catch(() => null) : Promise.resolve(null),
        ]);
      } catch (_) {}
      if (!box.isConnected) return;
      if (!isMe && !active.length && !mems.length) { box.innerHTML = ''; return; }
      const used = q ? q.monthSaved : 0;
      box.innerHTML = `
        <div class="wp-pf-sec"><span>Memories</span><span class="wp-pf-sec-n">${isMe ? `${used} de ${MS.MONTH_LIMIT} este mes` : mems.length || ''}</span></div>
        ${isMe ? `<div class="wp-mo-bar"><i style="width:${Math.round(used / MS.MONTH_LIMIT * 100)}%"></i></div>` : ''}
        ${active.length || isMe ? `<div class="wp-mo-act">
          ${active.map((m, k) => `<button type="button" class="wp-mo-act-it" data-k="${k}">
            <span class="wp-mo-ring" style="background:conic-gradient(#1a5cf5 0 ${Math.round(lifeFrac(m) * 100)}%, #c7d2fe 0 100%)"><span class="wp-mo-in" style="background-color:${m.color || '#ddd'};background-image:url('${MS.url(m.thumb_path)}')"></span></span>
            <small>${left(m.expires_at)}</small></button>`).join('')}
          ${isMe ? `<button type="button" class="wp-mo-act-it" data-new="1"><span class="wp-mo-new">+</span><small>Nuevo</small></button>` : ''}
        </div>` : ''}
        ${mems.length ? `<div class="wp-mo-grid">${mems.map((m, k) => `<button type="button" class="wp-mo-g" data-g="${k}" style="background-color:${m.color || '#ddd'};background-image:url('${MS.url(m.thumb_path)}')"><span>${ESC(m.place_name || '')}</span></button>`).join('')}</div>`
          : isMe ? '<p class="wp-mo-empty">Toca + para compartir tu primer momento. Guarda los que quieras conservar.</p>' : ''}`;
      box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => this.open(active, +b.dataset.k));
      box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => this.open(mems, +b.dataset.g));
      box.querySelector('[data-new]')?.addEventListener('click', () => this.openCamera());
    };
    if (isMe) this._profileRefresh = () => { if (box.isConnected) paint(); };
    await paint();
  }

  // ════ Utilidades ════════════════════════════════════════════════════
  _pickList(anchor, items, onPick, onCancel) {
    document.getElementById('wp-mo-pick')?.remove();
    const w = document.createElement('div');
    w.id = 'wp-mo-pick';
    w.innerHTML = `<div class="wp-mo-pick-catch"></div><div class="wp-mo-pick-menu">${items.map((it, k) =>
      `<button type="button" data-k="${k}" class="${it.danger ? 'danger' : ''}"><b>${ESC(it.label)}</b>${it.sub ? `<small>${ESC(it.sub)}</small>` : ''}</button>`).join('')}</div>`;
    document.body.appendChild(w);
    const menu = w.querySelector('.wp-mo-pick-menu');
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth;
    menu.style.left = Math.max(10, Math.min(innerWidth - mw - 10, r.left + r.width / 2 - mw / 2)) + 'px';
    menu.style.top = (r.bottom + 8) + 'px';
    const done = () => w.remove();
    w.querySelector('.wp-mo-pick-catch').onclick = () => { done(); onCancel?.(); };
    menu.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { done(); onPick(items[+b.dataset.k]); });
  }

  _toast(msg) {
    document.getElementById('wp-mo-toast')?.remove();
    const t = document.createElement('div');
    t.id = 'wp-mo-toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2400);
  }

  _css() {
    if (document.getElementById('wp-mo-css')) return;
    const s = document.createElement('style');
    s.id = 'wp-mo-css';
    s.textContent = `
      #wp-mo-compose, #wp-mo-viewer { position:fixed; inset:0; z-index:1500500; background:#000; font-family:var(--wp-font); opacity:0; transition:opacity 0.22s ease, transform 0.2s; }
      #wp-mo-compose.in, #wp-mo-viewer.in { opacity:1; }
      .wp-mo-photo { position:absolute; inset:0; background-size:cover; background-position:center; }
      .wp-mo-top { position:absolute; top:calc(env(safe-area-inset-top,0px) + 12px); left:14px; right:14px; display:flex; align-items:center; justify-content:space-between; z-index:3; }
      .wp-mo-round { width:42px; height:42px; border:none; border-radius:50%; display:flex; align-items:center; justify-content:center; padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent; flex-shrink:0; }
      .wp-mo-glass { background:rgba(0,0,0,0.38); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); color:#fff; }
      .wp-mo-white { background:#fff; color:#111827; }
      .wp-mo-pill { display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 15px; border:none; border-radius:999px; font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer; -webkit-tap-highlight-color:transparent; max-width:100%; }
      .wp-mo-pill span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .wp-mo-place { max-width:64%; }
      .wp-mo-sheet { position:absolute; left:0; right:0; bottom:0; background:#fff; border-radius:28px 28px 0 0; padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px)); display:flex; flex-direction:column; gap:12px; z-index:3; transform:translateY(30px); transition:transform 0.3s cubic-bezier(0.22,1,0.36,1); }
      #wp-mo-compose.in .wp-mo-sheet { transform:none; }
      .wp-mo-handle { width:36px; height:4px; border-radius:2px; background:#d4d7dd; margin:0 auto 2px; }
      .wp-mo-input { height:44px; border-radius:999px; background:#f3f4f6; border:none; outline:none; padding:0 18px; font-family:inherit; font-size:15px; color:#111827; }
      .wp-mo-moods { display:flex; gap:8px; }
      .wp-mo-mood { width:44px; height:44px; border-radius:50%; border:none; background:#f1f2f4; font-size:22px; cursor:pointer; transition:transform 0.18s cubic-bezier(0.34,1.7,0.64,1); }
      .wp-mo-mood.on { background:#e8efff; box-shadow:0 0 0 2px #1a5cf5; transform:scale(1.08); }
      .wp-mo-seg { display:flex; background:#f3f4f6; border-radius:999px; padding:4px; }
      .wp-mo-seg button { flex:1; height:36px; border:none; border-radius:999px; background:none; font-family:inherit; font-size:13px; font-weight:600; color:#6b7280; cursor:pointer; }
      .wp-mo-seg button.on { background:#fff; color:#111827; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
      .wp-mo-row { display:flex; align-items:center; gap:12px; padding:2px; cursor:pointer; }
      .wp-mo-row > span:first-child { flex:1; display:flex; flex-direction:column; gap:2px; }
      .wp-mo-row b { font-size:14.5px; font-weight:600; color:#111827; }
      .wp-mo-row small { font-size:12px; color:#8e8e93; }
      .wp-mo-sw { position:relative; width:44px; height:26px; border-radius:999px; background:#e5e7eb; transition:background 0.2s; flex-shrink:0; }
      .wp-mo-sw::after { content:''; position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.25); transition:transform 0.22s cubic-bezier(0.34,1.4,0.64,1); }
      .wp-mo-sw.on { background:#1a5cf5; } .wp-mo-sw.on::after { transform:translateX(18px); }
      .wp-mo-sw.off-dis { opacity:0.4; }
      .wp-mo-cta { height:50px; border:none; border-radius:999px; background:#1a5cf5; color:#fff; font-family:inherit; font-size:15.5px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:10px; cursor:pointer; }
      .wp-mo-cta.busy { opacity:0.75; }
      .wp-mo-spin { width:16px; height:16px; border-radius:50%; border:2.5px solid rgba(255,255,255,0.4); border-top-color:#fff; animation:wpMoSpin 0.7s linear infinite; }
      @keyframes wpMoSpin { to { transform:rotate(360deg); } }
      .wp-mo-note { text-align:center; font-size:11.5px; color:#9ca3af; margin-top:-4px; }
      /* visor */
      .wp-mo-shade { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0.45) 0,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 62%,rgba(0,0,0,0.55) 100%); pointer-events:none; }
      .wp-mo-bars { position:absolute; top:calc(env(safe-area-inset-top,0px) + 8px); left:10px; right:10px; display:flex; gap:4px; z-index:3; }
      .wp-mo-bars i { flex:1; height:3px; border-radius:2px; background:rgba(255,255,255,0.35); overflow:hidden; }
      .wp-mo-bars b { display:block; height:100%; width:0; background:#fff; }
      .wp-mo-head { position:absolute; top:calc(env(safe-area-inset-top,0px) + 20px); left:12px; right:12px; display:flex; align-items:center; gap:10px; z-index:4; color:#fff; }
      .wp-mo-head .wp-mo-round { width:36px; height:36px; }
      .wp-mo-av { width:38px; height:38px; border-radius:50%; border:2px solid #fff; background:#334 center/cover; flex-shrink:0; }
      .wp-mo-who { flex:1; min-width:0; display:flex; flex-direction:column; }
      .wp-mo-who b { font-size:14px; } .wp-mo-who small { font-size:12px; opacity:0.85; }
      .wp-mo-tap { position:absolute; top:90px; bottom:150px; z-index:2; -webkit-tap-highlight-color:transparent; touch-action:none; }
      .wp-mo-tap-l { left:0; width:33%; } .wp-mo-tap-r { right:0; width:67%; }
      .wp-mo-foot { position:absolute; left:14px; right:14px; bottom:calc(env(safe-area-inset-bottom,0px) + 22px); display:flex; flex-direction:column; align-items:flex-start; gap:10px; z-index:4; }
      .wp-mo-cap { color:#fff; font-size:16px; font-weight:600; text-shadow:0 1px 6px rgba(0,0,0,0.45); }
      .wp-mo-own { width:100%; display:flex; flex-direction:column; gap:10px; }
      .wp-mo-own:empty { display:none; }
      .wp-mo-views { display:flex; align-items:center; gap:8px; color:#fff; font-size:12.5px; min-height:26px; }
      .wp-mo-fp { display:flex; } .wp-mo-fp i { width:26px; height:26px; border-radius:50%; border:2px solid #fff; background:#556 center/cover; margin-left:-8px; } .wp-mo-fp i:first-child { margin-left:0; }
      .wp-mo-save { width:100%; height:50px; justify-content:center; font-size:15px; }
      .wp-mo-save em { font-style:normal; color:#8e8e93; font-weight:500; }
      .wp-mo-save.done { background:rgba(255,255,255,0.85); color:#16a34a; }
      /* mapa */
      .wp-mo-mk { position:relative; width:62px; height:62px; cursor:pointer; filter:drop-shadow(0 4px 8px rgba(0,0,0,0.22)); }
      .wp-mo-ring { display:block; width:100%; height:100%; border-radius:50%; padding:3px; box-sizing:border-box; }
      .wp-mo-in { display:block; width:100%; height:100%; border-radius:50%; border:3px solid #fff; box-sizing:border-box; background-size:cover; background-position:center; }
      .wp-mo-mk-av { position:absolute; right:-4px; bottom:-4px; width:24px; height:24px; border-radius:50%; border:2px solid #fff; background:#556 center/cover; }
      .wp-mo-mk-n { position:absolute; right:-4px; top:-4px; min-width:20px; height:20px; padding:0 5px; box-sizing:border-box; border-radius:999px; background:#111827; color:#fff; border:2px solid #fff; font:700 10.5px/16px var(--wp-font); text-align:center; }
      .wp-mo-pol { position:relative; width:52px; padding:4px 4px 11px; background:#fff; border-radius:8px; box-shadow:0 6px 14px rgba(0,0,0,0.2); transform:rotate(5deg); cursor:pointer; }
      .wp-mo-pol-ph { height:44px; border-radius:5px; background-size:cover; background-position:center; }
      .wp-mo-pol > span { position:absolute; right:-6px; top:-6px; width:20px; height:20px; border-radius:50%; background:#ec4899; border:2px solid #fff; display:flex; align-items:center; justify-content:center; }
      /* perfil */
      .wp-mo-bar { height:6px; border-radius:3px; background:#eef0f3; margin:-2px 2px 12px; overflow:hidden; }
      .wp-mo-bar i { display:block; height:100%; background:#1a5cf5; border-radius:3px; }
      .wp-mo-act { display:flex; gap:12px; overflow-x:auto; scrollbar-width:none; margin:0 -2px 12px; padding:2px; }
      .wp-mo-act::-webkit-scrollbar { display:none; }
      .wp-mo-act-it { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:4px; border:none; background:none; padding:0; cursor:pointer; font-family:inherit; }
      .wp-mo-act-it .wp-mo-ring { width:62px; height:62px; }
      .wp-mo-act-it small { font-size:11px; color:#6b7280; }
      .wp-mo-new { width:62px; height:62px; border-radius:50%; border:2px dashed #c4c8cf; display:flex; align-items:center; justify-content:center; font-size:24px; color:#9ca3af; box-sizing:border-box; }
      .wp-mo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
      .wp-mo-g { position:relative; aspect-ratio:3/4; border:none; border-radius:12px; background-size:cover; background-position:center; cursor:pointer; padding:0; overflow:hidden; }
      .wp-mo-g span { position:absolute; left:0; right:0; bottom:0; padding:14px 6px 6px; text-align:left; font:700 10px var(--wp-font); color:#fff; background:linear-gradient(transparent,rgba(0,0,0,0.5)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .wp-mo-empty { margin:4px 2px 8px; font-size:13px; color:#8e8e93; }
      /* menú chico + toast */
      #wp-mo-pick { position:fixed; inset:0; z-index:1500600; }
      .wp-mo-pick-catch { position:absolute; inset:0; }
      .wp-mo-pick-menu { position:absolute; min-width:220px; max-width:300px; background:#fff; border-radius:14px; padding:5px 0; box-shadow:0 10px 38px rgba(0,0,0,0.25); font-family:var(--wp-font); }
      .wp-mo-pick-menu button { width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:1px; padding:10px 16px; border:none; background:none; text-align:left; cursor:pointer; font-family:inherit; }
      .wp-mo-pick-menu b { font-size:14.5px; font-weight:600; color:#111827; } .wp-mo-pick-menu small { font-size:11.5px; color:#8e8e93; }
      .wp-mo-pick-menu button.danger b { color:#e11d48; }
      #wp-mo-toast { position:fixed; left:50%; top:calc(env(safe-area-inset-top,0px) + 14px); transform:translate(-50%,-20px); z-index:1500700; background:#111827; color:#fff; padding:10px 18px; border-radius:999px; font:600 13.5px var(--wp-font); opacity:0; transition:opacity 0.25s, transform 0.25s; white-space:nowrap; }
      #wp-mo-toast.in { opacity:1; transform:translate(-50%,0); }
    `;
    document.head.appendChild(s);
  }
}
