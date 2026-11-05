// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/stop-flow.js
// Pantalla completa "Nueva parada": todo en UNA pantalla, en tarjetas
// (sin pasos). Arriba la ruta del plan; abajo qué van a hacer, dónde,
// a qué hora y una indicación opcional. Un solo botón fijo: "Agregar".
// Se mezcla en PlaceModal2.prototype (usa _hhmm, _distM, _stopEmoji,
// _planEmoji, _planPlaces, _planRpc, _openMyPlanSheet, _esc…).
// Estilos: /styles/plan-stop-flow.css (#wp-sf, .wp-sf-*)
// ════════════════════════════════════════════════════════════════════

const R3 = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';

// [categoría, emoji, nombre, color de fondo de sus íconos]
const GROUPS = [
  ['RESTAURANTS', '🍽️', 'Comer y beber', '#fff3e4'],
  ['ENTERTAINMENT', '🎉', 'Salir', '#ffeef5'],
  ['SHOPPING', '🛍️', 'Compras', '#f2eeff'],
  ['PARKS', '🌳', 'Aire libre', '#ebf7e4'],
  ['HEALTH', '💆', 'Bienestar', '#e9f2ff'],
  ['WORKSHOPS', '🔧', 'Talleres', '#eff1f4'],
];
const TINT = Object.fromEntries(GROUPS.map(g => [g[0], g[3]]));

// Si ActivityModal no exporta su catálogo, se usan estos genéricos
const FALLBACK_ACTS = [
  ['food', '🍔', 'Comer', 'RESTAURANTS', 'Hamburger/3D/hamburger_3d.png'],
  ['drinks', '☕', 'Café', 'RESTAURANTS', 'Hot beverage/3D/hot_beverage_3d.png'],
  ['music', '🎵', 'Música', 'ENTERTAINMENT', 'Musical note/3D/musical_note_3d.png'],
  ['hangout', '🎈', 'Pasar el rato', 'ENTERTAINMENT', 'Balloon/3D/balloon_3d.png'],
  ['shop', '🛍️', 'Compras', 'SHOPPING', 'Shopping bags/3D/shopping_bags_3d.png'],
  ['sport', '🏃', 'Deporte', 'PARKS', 'Person running/3D/person_running_3d.png'],
  ['photo', '📸', 'Fotos', 'PARKS', 'Camera with flash/3D/camera_with_flash_3d.png'],
  ['spa', '💆', 'Spa', 'HEALTH', 'Person getting massage/3D/person_getting_massage_3d.png'],
].map(([key, emoji, label, cat, ic]) => ({ key, emoji, label, cat, icon3d: R3 + ic }));

const GAPS = [15, 30, 45, 60, 90, 120, 150, 180, 240];   // minutos después de la parada anterior
const SUGGESTED = 4;                                       // lugares sugeridos visibles

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const gapTxt = (g) => (g < 60 ? `+${g} min` : `+${Math.floor(g / 60)}${g % 60 ? ':' + String(g % 60).padStart(2, '0') : ''} h`);
const kmTxt = (d) => (d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`);

export class StopFlow {
  // ── Abrir ────────────────────────────────────────────────────────────
  _openStopFlow(a) {
    const f = this._sfContext(a);
    f.root = document.createElement('div');
    f.root.id = 'wp-sf';
    f.root.innerHTML = this._sfShell(f);
    document.body.appendChild(f.root);
    f.$ = (q) => f.root.querySelector(q);
    this._sfBind(f);
    this._sfPaintActs(f);
    this._sfPaintTimes(f);
    this._sfPaint(f);
    requestAnimationFrame(() => f.root.classList.add('in'));
    this._planPlaces().then((ps) => {
      f.all = (ps || []).filter(p => p.place_id && p.lat && p.lng);
      if (f.root.isConnected) this._sfPaintPlaces(f);
    });
  }

  // Todo lo que la pantalla necesita saber del plan
  _sfContext(a) {
    const cur = Array.isArray(a.stops) ? a.stops : [];
    const last = cur[cur.length - 1];
    const t0 = new Date(a.scheduled_at);
    const acts = (this._actTypes || []).length ? this._actTypes : FALLBACK_ACTS;
    let cat = String(last?.cat || this._place?.category || 'RESTAURANTS').toUpperCase();
    if (!GROUPS.some(g => g[0] === cat)) cat = 'RESTAURANTS';
    return {
      a, cur, last, t0, acts, cat,
      lastT: new Date(t0.getTime() + (last?.after || 0) * 60000),
      origin: last?.lat ? { lat: Number(last.lat), lng: Number(last.lng) } : { lat: Number(a.lat), lng: Number(a.lng) },
      fromName: last?.name || a.place_name || 'la parada anterior',
      exclude: new Set([String(a.place_id || ''), ...cur.map(x => String(x.place_id))]),
      act: null, place: null, custom: null, gap: 60, note: '', all: [], searching: false,
    };
  }

  _sfAt(f) { return new Date(f.lastT.getTime() + f.gap * 60000); }
  _sfAct(f) { return f.acts.find(x => x.key === f.act) || null; }
  _sfWhere(f) { return f.custom || f.place; }

  // ── Estructura (se pinta una vez; las partes se repintan solas) ──────
  _sfShell(f) {
    const back = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
    const search = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    return `
      <header class="wp-sf-top">
        <button type="button" class="wp-sf-iconbtn" data-a="close" aria-label="Volver al plan">${back}</button>
        <h1>Nueva parada</h1>
        <span class="wp-sf-iconbtn wp-sf-n" aria-hidden="true">${f.cur.length + 2}</span>
      </header>
      <main class="wp-sf-scroll">
        <section class="wp-sf-route" aria-label="Ruta del plan"><div class="wp-sf-route-track"></div></section>

        <section class="wp-sf-card">
          <div class="wp-sf-card-h"><h2>¿Qué van a hacer?</h2><span class="wp-sf-card-v" data-v="act"></span></div>
          <div class="wp-sf-cats">${GROUPS.map(([k, e, l]) => `<button type="button" data-c="${k}">${e} ${l}</button>`).join('')}</div>
          <div class="wp-sf-acts"></div>
        </section>

        <section class="wp-sf-card">
          <div class="wp-sf-card-h"><h2>¿Dónde?</h2><button type="button" class="wp-sf-link" data-a="search">${search}Buscar</button></div>
          <div class="wp-sf-search" hidden><input type="search" placeholder="Nombre o dirección" enterkeyhint="search" autocomplete="off"><button type="button" data-a="nosearch" aria-label="Cerrar búsqueda">×</button></div>
          <div class="wp-sf-places"></div>
          <button type="button" class="wp-sf-own" data-a="own"><span>📍</span><span><b>Un lugar que no está en el mapa</b><small>Casa de alguien, un parque sin nombre…</small></span></button>
          <div class="wp-sf-ownf" hidden>
            <input class="wp-sf-in" data-f="name" type="text" maxlength="80" placeholder="Nombre (ej. Casa de Ana)" autocapitalize="sentences" autocomplete="off">
            <input class="wp-sf-in" data-f="address" type="text" maxlength="160" placeholder="Dirección o referencia (opcional)" autocapitalize="sentences" autocomplete="off">
            <button type="button" class="wp-sf-gps" data-a="gps">📡 <span>Usar mi ubicación actual</span></button>
          </div>
        </section>

        <section class="wp-sf-card">
          <div class="wp-sf-card-h"><h2>¿A qué hora?</h2><span class="wp-sf-card-v" data-v="time"></span></div>
          <div class="wp-sf-times"></div>
        </section>

        <section class="wp-sf-card">
          <div class="wp-sf-card-h"><h2>Indicación <small>opcional</small></h2></div>
          <input class="wp-sf-in" data-f="note" type="text" maxlength="140" placeholder="Ej. Aquí cada quien pide lo suyo" autocapitalize="sentences" autocomplete="off">
          <p class="wp-sf-hint">Las reglas (quién paga, puntualidad…) son de todo el plan.</p>
        </section>
      </main>
      <footer class="wp-sf-foot"><button type="button" class="wp-sf-go" data-a="save" disabled><span></span></button></footer>`;
  }

  // ── Eventos (delegados en la raíz) ──────────────────────────────────
  _sfBind(f) {
    f.root.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.c) { f.cat = b.dataset.c; this._haptic?.('light'); this._sfPaintActs(f); return; }
      if (b.dataset.k) { this._sfPickAct(f, b.dataset.k, b); return; }
      if (b.dataset.i != null && b.classList.contains('wp-sf-place')) { this._sfPickPlace(f, +b.dataset.i); return; }
      if (b.dataset.g) { f.gap = +b.dataset.g; this._haptic?.('light'); this._sfPaintTimes(f); this._sfPaint(f); return; }
      const act = b.dataset.a;
      if (act === 'close') this._sfClose(f);
      else if (act === 'search') this._sfToggleSearch(f, true);
      else if (act === 'nosearch') this._sfToggleSearch(f, false);
      else if (act === 'own') this._sfToggleOwn(f);
      else if (act === 'gps') this._sfGps(f, b);
      else if (act === 'save') this._sfSave(f);
    });
    let qt = 0;
    f.$('.wp-sf-search input').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => this._sfPaintPlaces(f), 120); });
    f.root.querySelectorAll('.wp-sf-ownf .wp-sf-in').forEach(i => i.addEventListener('input', () => this._sfSyncOwn(f)));
    f.$('[data-f="note"]').addEventListener('input', (e) => { f.note = e.target.value; });
  }

  _sfPickAct(f, key, btn) {
    f.act = f.act === key ? null : key;
    this._haptic?.('light');
    f.root.querySelectorAll('.wp-sf-act').forEach(x => x.classList.toggle('on', x.dataset.k === f.act));
    if (f.act) this._scaleKeys?.(btn.firstElementChild, [0.8, 1.15, 1], 300);
    if (!f.custom && !f.searching) f.place = null;   // los sugeridos cambian con la actividad
    this._sfPaintPlaces(f);
    this._sfPaint(f);
  }

  _sfPickPlace(f, i) {
    const p = f.res?.[i]; if (!p) return;
    const same = f.place && String(f.place.place_id) === String(p.place_id);
    f.place = same ? null : p;
    if (f.place) this._sfClearOwn(f);
    this._haptic?.('light');
    this._sfPaintPlaces(f);
    this._sfPaint(f);
  }

  _sfToggleSearch(f, on) {
    f.searching = on;
    const box = f.$('.wp-sf-search'), inp = box.querySelector('input');
    box.hidden = !on;
    f.$('[data-a="search"]').hidden = on;
    if (on) setTimeout(() => { try { inp.focus(); } catch (_) {} }, 40);
    else inp.value = '';
    this._sfPaintPlaces(f);
  }

  _sfToggleOwn(f) {
    const box = f.$('.wp-sf-ownf'), open = box.hidden;
    box.hidden = !open;
    f.$('.wp-sf-own').classList.toggle('on', open);
    if (open) setTimeout(() => { try { box.querySelector('input').focus(); } catch (_) {} }, 40);
    else this._sfClearOwn(f);
    this._sfPaint(f);
  }

  _sfSyncOwn(f) {
    const name = f.$('[data-f="name"]').value.trim();
    const address = f.$('[data-f="address"]').value.trim();
    f.custom = name ? {
      place_id: f.custom?.place_id || `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name, address, lat: f.custom?.lat, lng: f.custom?.lng, own: true,
    } : null;
    if (f.custom) { f.place = null; this._sfPaintPlaces(f); }
    this._sfPaint(f);
  }

  _sfClearOwn(f) {
    f.custom = null;
    f.root.querySelectorAll('.wp-sf-ownf .wp-sf-in').forEach(i => { i.value = ''; });
  }

  _sfGps(f, btn) {
    const label = btn.querySelector('span');
    if (!navigator.geolocation) { this._showToast?.('Tu teléfono no comparte ubicación'); return; }
    btn.disabled = true; label.textContent = 'Buscando…';
    navigator.geolocation.getCurrentPosition((pos) => {
      const n = f.$('[data-f="name"]');
      if (!n.value.trim()) n.value = 'Aquí';
      this._sfSyncOwn(f);
      f.custom.lat = +pos.coords.latitude.toFixed(6);
      f.custom.lng = +pos.coords.longitude.toFixed(6);
      btn.disabled = false; btn.classList.add('ok'); label.textContent = 'Ubicación agregada';
    }, () => { btn.disabled = false; label.textContent = 'No se pudo · intenta otra vez'; }, { enableHighAccuracy: true, timeout: 10000 });
  }

  // ── Pintar partes ───────────────────────────────────────────────────
  // Ruta: las paradas que ya tiene el plan + la nueva (punteada hasta elegir)
  _sfPaintRoute(f) {
    const A = this._sfAct(f), W = this._sfWhere(f);
    const node = (n, ico, name, time, cls = '') => `<div class="wp-sf-stop ${cls}">
        <span class="wp-sf-stop-i">${ico}<b>${n}</b></span><span class="wp-sf-stop-t"><small>${time}</small><em>${this._esc(name)}</em></span></div>`;
    const img = (url, emoji) => (url ? `<img src="${this._esc(url)}" alt="" onerror="this.replaceWith(document.createTextNode('${emoji}'))">` : emoji);
    const rows = [node(1, img(f.a.icon_url, this._planEmoji(f.a.type)), f.a.place_name || 'Inicio', this._hhmm(f.t0))]
      .concat(f.cur.map((x, i) => node(i + 2, img(x.icon, x.emoji || this._stopEmoji(x.cat)), x.name,
        this._hhmm(new Date(f.t0.getTime() + (x.after || 0) * 60000)))))
      .concat(node(f.cur.length + 2, A ? img(A.icon3d, A.emoji) : '?', W?.name || A?.label || '¿Siguiente?', this._hhmm(this._sfAt(f)), 'new' + (A || W ? ' set' : '')));
    f.$('.wp-sf-route-track').innerHTML = rows.join('<i class="wp-sf-dash"></i>');
    const r = f.$('.wp-sf-route'); requestAnimationFrame(() => { r.scrollLeft = r.scrollWidth; });
  }

  // Íconos 3D de la categoría (fila que se desliza)
  _sfPaintActs(f) {
    f.root.querySelectorAll('.wp-sf-cats button').forEach(b => b.classList.toggle('on', b.dataset.c === f.cat));
    const list = f.acts.filter(x => x.cat === f.cat);
    const box = f.$('.wp-sf-acts');
    box.innerHTML = list.map(x => `<button type="button" class="wp-sf-act${x.key === f.act ? ' on' : ''}" data-k="${x.key}" style="--t:${TINT[x.cat] || '#f3f4f6'}">
        <span class="wp-sf-act-i">${x.icon3d ? `<img src="${this._esc(x.icon3d)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${x.emoji}'))">` : x.emoji}</span>
        <span class="wp-sf-act-l">${this._esc(x.label)}</span></button>`).join('');
    box.scrollLeft = 0;
  }

  // Lugares: los que encajan con la actividad, cerca de la parada anterior
  _sfPaintPlaces(f) {
    const A = this._sfAct(f);
    const k = f.searching ? norm(f.$('.wp-sf-search input').value.trim()) : '';
    let base = f.all.filter(p => !f.exclude.has(String(p.place_id)));
    if (k) base = base.filter(p => norm(p.name).includes(k) || norm(p.formattedAddress).includes(k));
    else if (A) {
      const subs = new Set(A.subcats || []);
      const tags = (p) => [...(Array.isArray(p.subcategoryTags) ? p.subcategoryTags : []), p.subcategory].map(x => String(x || '').toLowerCase());
      const sameCat = base.filter(p => String(p.category || '').toUpperCase() === A.cat);
      const fit = subs.size ? sameCat.filter(p => tags(p).some(t => subs.has(t))) : [];
      base = fit.length ? fit : sameCat;
    }
    const res = base.map(p => [p, this._distM(f.origin, p)]).sort((x, y) => x[1] - y[1]).slice(0, k ? 12 : SUGGESTED);
    f.res = res.map(r => r[0]);
    const box = f.$('.wp-sf-places');
    if (!f.all.length) { box.innerHTML = '<p class="wp-sf-empty">Cargando lugares…</p>'; return; }
    box.innerHTML = res.length ? res.map(([p, d], i) => {
      const ph = p.photoUrl || p.photosUrls?.[0] || '', c = String(p.category || '').toUpperCase();
      const on = f.place && String(f.place.place_id) === String(p.place_id);
      return `<button type="button" class="wp-sf-place${on ? ' on' : ''}" data-i="${i}">
          <span class="wp-sf-place-ph" style="${ph ? `background-image:url('${this._esc(ph)}')` : `background-color:${TINT[c] || '#eef0f3'}`}">${ph ? '' : this._stopEmoji(c)}</span>
          <span class="wp-sf-place-t"><b>${this._esc(p.name)}</b><small>${p.rating ? `★ ${parseFloat(p.rating).toFixed(1)} · ` : ''}${kmTxt(d)}</small></span>
          <i class="wp-sf-radio"></i></button>`;
    }).join('') : `<p class="wp-sf-empty">${k ? 'No encontramos ese lugar' : 'No hay lugares así cerca · usa Buscar o agrega uno propio'}</p>`;
  }

  // Horas: tira como la de días de un calendario (+tiempo arriba, hora abajo)
  _sfPaintTimes(f) {
    f.$('.wp-sf-times').innerHTML = GAPS.map(g => {
      const d = new Date(f.lastT.getTime() + g * 60000);
      return `<button type="button" class="wp-sf-time${g === f.gap ? ' on' : ''}" data-g="${g}"><small>${gapTxt(g)}</small><b>${this._hhmm(d)}</b></button>`;
    }).join('');
    const on = f.$('.wp-sf-time.on');
    if (on) requestAnimationFrame(() => { const s = on.parentElement; s.scrollLeft = on.offsetLeft - (s.clientWidth - on.offsetWidth) / 2; });
  }

  // Lo que cambia con cada elección: ruta, resúmenes de tarjeta y botón
  _sfPaint(f) {
    const A = this._sfAct(f), W = this._sfWhere(f), at = this._hhmm(this._sfAt(f));
    this._sfPaintRoute(f);
    f.$('[data-v="act"]').textContent = A ? `${A.emoji} ${A.label}` : '';
    f.$('[data-v="time"]').textContent = `después de ${f.fromName}`;
    const go = f.$('.wp-sf-go');
    go.disabled = !(A && W);
    go.querySelector('span').textContent = !A ? 'Elige qué van a hacer' : !W ? 'Elige dónde' : `Agregar parada · ${at}`;
  }

  // ── Guardar / cerrar ────────────────────────────────────────────────
  async _sfSave(f) {
    const A = this._sfAct(f), W = this._sfWhere(f);
    if (!A || !W) return;
    const go = f.$('.wp-sf-go');
    go.disabled = true;
    const stop = {
      place_id: String(W.place_id), name: W.name || W.displayName || 'Lugar',
      lat: W.lat != null ? Number(W.lat) : undefined, lng: W.lng != null ? Number(W.lng) : undefined,
      cat: W.category || A.cat || '', after: (f.last?.after || 0) + f.gap,
      act: A.key, emoji: A.emoji, icon: A.icon3d,
      note: f.note.trim() || undefined, address: W.address || W.formattedAddress || undefined,
    };
    const next = [...f.cur, stop];
    const ok = await this._planRpc('set_plan_stops', { p_activity: f.a.id, p_stops: next }, `Agregaste ${stop.name} · ya les avisamos`);
    if (!ok) { go.disabled = false; return; }
    f.a.stops = next;
    this._sfClose(f);
  }

  _sfClose(f) {
    f.root.classList.remove('in');
    setTimeout(() => f.root.remove(), 320);
    setTimeout(() => this._openMyPlanSheet(f.a), 120);
  }
}
