// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-stops.js
// Paradas del plan: pantalla completa "Nueva parada" (qué → dónde →
// a qué hora), la ruta en "Tu plan", ver la ruta en el mapa y helpers
// de lugares/distancias. Se mezcla en PlaceModal2.prototype.
// Estilos: /styles/place-plans.css (#wp-sf, .wp-sf-*, .wp-pv-stop*)
// ════════════════════════════════════════════════════════════════════


export class PlanStops {
  // ── Paradas del plan ─────────────────────────────────────────────────
  _stopEmoji(cat) {
    return { RESTAURANTS: '🍽️', HEALTH: '💆', SHOPPING: '🛍️', ENTERTAINMENT: '🎉', PARKS: '🌳', WORKSHOPS: '🔧' }[String(cat || '').toUpperCase()] || '📍';
  }

  _hhmm(d) {
    const h = d.getHours(), m = d.getMinutes();
    return `${h > 12 ? h - 12 : h || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}`;
  }

  _distM(a, b) {
    const R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // Todos los lugares (mismo caché que usa el modo explorar)
  async _planPlaces() {
    if (window.wpApp?._allPlacesCache?.length) return window.wpApp._allPlacesCache;
    try {
      const j = await (await fetch('/api/supabase-places?category=ALL')).json();
      if (window.wpApp) window.wpApp._allPlacesCache = j.places || [];
      return j.places || [];
    } catch (_) { return window.wpApp?.mapView?.allPlaces || []; }
  }

  // ── "Nueva parada" — pantalla completa, mismo principio que Crear
  // actividad (qué → dónde → cuándo) pero pensado para un plan que ya
  // existe: arriba siempre se ve la RUTA del plan como una cinta y la
  // parada nueva se va armando ahí mientras eliges.
  //   1 ¿Qué van a hacer?  catálogo de actividades por categoría
  //   2 ¿Dónde?            lugares que encajan cerca · o un lugar propio
  //   3 ¿A qué hora?       agenda del día (como calendario) + indicación
  _openStopFlow(a) {
    const cur = Array.isArray(a.stops) ? a.stops : [];
    const last = cur[cur.length - 1];
    const t0 = new Date(a.scheduled_at);
    const lastT = new Date(t0.getTime() + (last?.after || 0) * 60000);
    const origin = last?.lat ? { lat: Number(last.lat), lng: Number(last.lng) } : { lat: Number(a.lat), lng: Number(a.lng) };
    const fromName = last?.name || a.place_name || 'la parada anterior';
    const exclude = new Set([String(a.place_id || ''), ...cur.map(x => String(x.place_id))]);
    const R3 = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';
    const GROUPS = [
      ['RESTAURANTS', '🍽️', 'Comer y beber', '#fff1df'], ['ENTERTAINMENT', '🎉', 'Salir', '#ffe8f1'], ['SHOPPING', '🛍️', 'Compras', '#efeafe'],
      ['PARKS', '🌳', 'Aire libre', '#e7f6df'], ['HEALTH', '💆', 'Bienestar', '#e4efff'], ['WORKSHOPS', '🔧', 'Talleres', '#eceef1'],
    ];
    const TINT = Object.fromEntries(GROUPS.map(g => [g[0], g[3]]));
    const ACTS = (this._actTypes || []).length ? this._actTypes : [
      { key: 'food', emoji: '🍔', label: 'Comer', cat: 'RESTAURANTS', icon3d: R3 + 'Hamburger/3D/hamburger_3d.png' },
      { key: 'drinks', emoji: '☕', label: 'Café', cat: 'RESTAURANTS', icon3d: R3 + 'Hot beverage/3D/hot_beverage_3d.png' },
      { key: 'music', emoji: '🎵', label: 'Música', cat: 'ENTERTAINMENT', icon3d: R3 + 'Musical note/3D/musical_note_3d.png' },
      { key: 'hangout', emoji: '🎈', label: 'Pasar el rato', cat: 'ENTERTAINMENT', icon3d: R3 + 'Balloon/3D/balloon_3d.png' },
      { key: 'shop', emoji: '🛍️', label: 'Compras', cat: 'SHOPPING', icon3d: R3 + 'Shopping bags/3D/shopping_bags_3d.png' },
      { key: 'sport', emoji: '🏃', label: 'Deporte', cat: 'PARKS', icon3d: R3 + 'Person running/3D/person_running_3d.png' },
      { key: 'photo', emoji: '📸', label: 'Fotos', cat: 'PARKS', icon3d: R3 + 'Camera with flash/3D/camera_with_flash_3d.png' },
      { key: 'spa', emoji: '💆', label: 'Spa', cat: 'HEALTH', icon3d: R3 + 'Person getting massage/3D/person_getting_massage_3d.png' },
    ];
    const st = { step: 0, cat: String(last?.cat || this._place?.category || 'RESTAURANTS').toUpperCase(), act: null, place: null, custom: null, gap: 60, note: '' };
    if (!GROUPS.some(g => g[0] === st.cat)) st.cat = 'RESTAURANTS';
    let all = [];
    const hh = (d) => this._hhmm(d);
    const at = () => new Date(lastT.getTime() + st.gap * 60000);
    const gapTxt = (g) => g < 60 ? `${g} min` : `${Math.floor(g / 60)} h${g % 60 ? ' ' + (g % 60) + ' min' : ''}`;

    const root = document.createElement('div');
    root.id = 'wp-sf';
    root.innerHTML = `
      <div class="wp-sf-top">
        <button type="button" class="wp-sf-x" aria-label="Cerrar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <div class="wp-sf-ttl"><b>Nueva parada</b><small>${this._esc(a.title)}</small></div>
        <span class="wp-sf-n">Parada ${cur.length + 2}</span>
      </div>
      <div class="wp-sf-ribbon"><div class="wp-sf-rib-track"></div></div>
      <div class="wp-sf-prog"><i></i><i></i><i></i></div>
      <div class="wp-sf-vp"><div class="wp-sf-track">
        <section class="wp-sf-step" data-s="0">
          <h2>¿Qué van a hacer?</h2><p>Después de ${this._esc(fromName)}</p>
          <div class="wp-sf-cats">${GROUPS.map(([k, e, l]) => `<button type="button" data-c="${k}">${e} ${l}</button>`).join('')}</div>
          <div class="wp-sf-grid"></div>
        </section>
        <section class="wp-sf-step" data-s="1">
          <h2>¿Dónde?</h2><p class="wp-sf-p1"></p>
          <div class="wp-pm2-col-field wp-sf-q"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input class="wp-pm2-col-input2" type="search" placeholder="Buscar un lugar" enterkeyhint="search" autocomplete="off"></div>
          <button type="button" class="wp-sf-own"><span class="wp-sf-own-i">📍</span><span><b>Un lugar que no está en el mapa</b><small>Casa de alguien, un parque sin nombre…</small></span><i>›</i></button>
          <div class="wp-sf-ownf" hidden>
            <div class="wp-pm2-col-field"><input class="wp-pm2-col-input2 wp-sf-own-n" type="text" maxlength="80" placeholder="Nombre (ej. Casa de Ana)" autocapitalize="sentences" autocomplete="off"></div>
            <div class="wp-pm2-col-field"><input class="wp-pm2-col-input2 wp-sf-own-a" type="text" maxlength="160" placeholder="Dirección o referencia (opcional)" autocapitalize="sentences" autocomplete="off"></div>
            <button type="button" class="wp-sf-gps"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg><span>Usar mi ubicación actual</span></button>
          </div>
          <div class="wp-sf-lbl"></div>
          <div class="wp-sf-list"></div>
        </section>
        <section class="wp-sf-step" data-s="2">
          <h2>¿A qué hora?</h2><p>Toca la hora en la que llegan</p>
          <div class="wp-sf-agenda"></div>
          <div class="wp-sf-lbl">Indicación para esta parada <span>opcional</span></div>
          <div class="wp-pm2-col-field"><input class="wp-pm2-col-input2 wp-sf-note" type="text" maxlength="140" placeholder="Ej. Aquí cada quien pide lo suyo" autocapitalize="sentences" autocomplete="off"></div>
          <div class="wp-sf-hint">Las reglas (quién paga, puntualidad…) son de todo el plan y se cambian en "Tu plan".</div>
        </section>
      </div></div>
      <div class="wp-sf-foot">
        <button type="button" class="wp-pv-back wp-sf-back" aria-label="Atrás"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>
        <button type="button" class="wp-pv-cta wp-sf-go"><span></span></button>
      </div>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('in'));
    const $ = (q) => root.querySelector(q);
    const track = $('.wp-sf-track'), steps = [...root.querySelectorAll('.wp-sf-step')], go = $('.wp-sf-go');
    const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const actOf = () => ACTS.find(x => x.key === st.act);
    const where = () => st.custom || st.place;

    // Cinta de la ruta (arriba): paradas del plan + la nueva armándose
    const node = (n, emoji, icon, name, time, cls = '') => `<div class="wp-sf-node ${cls}"><span class="wp-sf-ico">${icon ? `<img src="${this._esc(icon)}" alt="" onerror="this.replaceWith(document.createTextNode('${emoji}'))">` : emoji}<b>${n}</b></span>
        <span class="wp-sf-nt"><small>${time}</small><em>${this._esc(name)}</em></span></div>`;
    const paintRibbon = () => {
      const A = actOf(), W = where();
      const rows = [node(1, this._planEmoji(a.type), a.icon_url, a.place_name || 'Inicio', hh(t0))]
        .concat(cur.map((x, i) => node(i + 2, x.emoji || this._stopEmoji(x.cat), x.icon, x.name, hh(new Date(t0.getTime() + (x.after || 0) * 60000)))))
        .concat([node(cur.length + 2, A ? A.emoji : '＋', A?.icon3d, W ? (W.name || 'Lugar') : (A ? A.label : 'Nueva'), st.step >= 2 || W ? hh(at()) : '¿?', 'new' + (A ? ' set' : ''))]);
      $('.wp-sf-rib-track').innerHTML = rows.join('<i class="wp-sf-link"></i>');
      const rb = $('.wp-sf-ribbon'); requestAnimationFrame(() => { rb.scrollLeft = rb.scrollWidth; });
    };

    // Paso 1 · catálogo
    const paintGrid = () => {
      root.querySelectorAll('.wp-sf-cats button').forEach(b => b.classList.toggle('on', b.dataset.c === st.cat));
      const list = ACTS.filter(x => x.cat === st.cat);
      $('.wp-sf-grid').innerHTML = list.map(x => `<button type="button" class="wp-sf-tile${x.key === st.act ? ' on' : ''}" data-k="${x.key}" style="--t:${TINT[x.cat] || '#eef0f3'}">
          <span class="wp-sf-tile-i">${x.icon3d ? `<img src="${this._esc(x.icon3d)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${x.emoji}'))">` : x.emoji}</span>
          <span class="wp-sf-tile-l">${this._esc(x.label)}</span></button>`).join('') || '<span class="wp-pv-empty">Nada por aquí</span>';
    };
    $('.wp-sf-cats').addEventListener('click', (e) => { const b = e.target.closest('button[data-c]'); if (!b) return; st.cat = b.dataset.c; this._haptic?.('light'); paintGrid(); $('.wp-sf-vp').scrollTop = 0; });
    $('.wp-sf-grid').addEventListener('click', (e) => {
      const b = e.target.closest('.wp-sf-tile'); if (!b) return;
      st.act = b.dataset.k; st.place = null; this._haptic?.('light');
      root.querySelectorAll('.wp-sf-tile').forEach(x => x.classList.toggle('on', x === b));
      this._scaleKeys?.(b.firstElementChild, [0.8, 1.15, 1], 300);
      paint();
      setTimeout(() => goStep(1), 260);   // elegir = avanzar
    });

    // Paso 2 · dónde
    const q = $('.wp-sf-q input'), ownF = $('.wp-sf-ownf');
    const paintPlaces = () => {
      const A = actOf(), k = norm(q.value.trim());
      $('.wp-sf-p1').textContent = A ? `Para ${A.label.toLowerCase()} · cerca de ${fromName}` : `Cerca de ${fromName}`;
      const subs = new Set(A?.subcats || []);
      const tagsOf = (p) => [...(Array.isArray(p.subcategoryTags) ? p.subcategoryTags : []), p.subcategory].map(x => String(x || '').toLowerCase());
      let base = all.filter(p => !exclude.has(String(p.place_id)));
      if (k) base = base.filter(p => norm(p.name).includes(k) || norm(p.formattedAddress).includes(k));
      else if (A) {
        const fit = base.filter(p => String(p.category || '').toUpperCase() === A.cat && (!subs.size || tagsOf(p).some(t => subs.has(t))));
        base = fit.length ? fit : base.filter(p => String(p.category || '').toUpperCase() === A.cat);
      }
      const res = base.map(p => [p, this._distM(origin, p)]).sort((x, y) => x[1] - y[1]).slice(0, 25);
      $('.wp-sf-list')._res = res.map(r => r[0]);
      $('.wp-sf-lbl').textContent = k ? `${res.length} resultado${res.length === 1 ? '' : 's'}` : 'Sugeridos';
      $('.wp-sf-list').innerHTML = res.length ? res.map(([p, d], i) => {
        const ph = p.photoUrl || p.photosUrls?.[0] || '', c = String(p.category || '').toUpperCase();
        const km = d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km';
        const on = !st.custom && st.place && String(st.place.place_id) === String(p.place_id);
        return `<button type="button" class="wp-sp-row${on ? ' on' : ''}" data-i="${i}">
          <span class="wp-sp-ph" style="${ph ? `background-image:url('${this._esc(ph)}')` : `background-color:${TINT[c] || '#eef0f3'}`}">${ph ? '' : this._stopEmoji(c)}</span>
          <span class="wp-sp-t"><b>${this._esc(p.name)}</b><small>${p.rating ? `<em>★ ${parseFloat(p.rating).toFixed(1)}</em> · ` : ''}${km}${p.formattedAddress ? ' · ' + this._esc(String(p.formattedAddress).split(',')[0]) : ''}</small></span>
          <i class="wp-sp-radio"></i></button>`;
      }).join('') : `<span class="wp-pv-empty">${all.length ? 'No encontramos lugares así cerca · prueba el buscador o agrega uno propio' : 'Cargando lugares…'}</span>`;
    };
    $('.wp-sf-list').addEventListener('click', (e) => {
      const b = e.target.closest('.wp-sp-row'); if (!b) return;
      const p = $('.wp-sf-list')._res?.[+b.dataset.i]; if (!p) return;
      st.place = p; st.custom = null; ownF.hidden = true; $('.wp-sf-own').classList.remove('on');
      this._haptic?.('light');
      root.querySelectorAll('.wp-sf-list .wp-sp-row').forEach(x => x.classList.toggle('on', x === b));
      paint();
    });
    let qt = 0;
    q.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(paintPlaces, 120); });
    const ownN = $('.wp-sf-own-n'), ownA = $('.wp-sf-own-a'), gpsB = $('.wp-sf-gps');
    const syncOwn = () => {
      const n = ownN.value.trim();
      st.custom = n ? { place_id: st.custom?.place_id || 'custom:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: n, address: ownA.value.trim(), lat: st.custom?.lat, lng: st.custom?.lng } : null;
      if (st.custom) { st.place = null; root.querySelectorAll('.wp-sf-list .wp-sp-row.on').forEach(x => x.classList.remove('on')); }
      paint();
    };
    $('.wp-sf-own').onclick = () => {
      ownF.hidden = !ownF.hidden;
      $('.wp-sf-own').classList.toggle('on', !ownF.hidden);
      if (!ownF.hidden) setTimeout(() => { try { ownN.focus(); } catch (_) {} }, 60);
    };
    ownN.addEventListener('input', syncOwn); ownA.addEventListener('input', syncOwn);
    gpsB.onclick = () => {
      if (!navigator.geolocation) { this._showToast('Tu teléfono no comparte ubicación'); return; }
      gpsB.classList.add('busy'); gpsB.querySelector('span').textContent = 'Buscando…';
      navigator.geolocation.getCurrentPosition((pos) => {
        if (!ownN.value.trim()) ownN.value = 'Aquí';
        syncOwn();
        st.custom.lat = +pos.coords.latitude.toFixed(6); st.custom.lng = +pos.coords.longitude.toFixed(6);
        gpsB.classList.remove('busy'); gpsB.classList.add('ok'); gpsB.querySelector('span').textContent = 'Ubicación agregada ✓';
        paint();
      }, () => { gpsB.classList.remove('busy'); gpsB.querySelector('span').textContent = 'No se pudo · intenta otra vez'; }, { enableHighAccuracy: true, timeout: 10000 });
    };

    // Paso 3 · agenda del día (cada 30 min desde la parada anterior)
    const paintAgenda = () => {
      const A = actOf(), W = where();
      const slots = [];
      for (let g = 30; g <= 360; g += 30) slots.push(g);
      const blk = (cls, emoji, title, sub) => `<div class="wp-sf-blk ${cls}"><span>${emoji}</span><span><b>${this._esc(title)}</b><small>${sub}</small></span></div>`;
      $('.wp-sf-agenda').innerHTML =
        `<div class="wp-sf-slot prev"><time>${hh(lastT)}</time>${blk('prev', last ? (last.emoji || this._stopEmoji(last.cat)) : this._planEmoji(a.type), fromName, 'Parada anterior')}</div>` +
        slots.map(g => {
          const d = new Date(lastT.getTime() + g * 60000), on = g === st.gap || (st.gap > g - 30 && st.gap < g && false);
          return `<button type="button" class="wp-sf-slot${on ? ' on' : ''}" data-g="${g}"><time>${hh(d)}</time>${on
            ? blk('new', A?.emoji || '📍', W?.name || A?.label || 'Nueva parada', `${gapTxt(st.gap)} después`)
            : `<span class="wp-sf-line"></span>`}</button>`;
        }).join('');
    };
    $('.wp-sf-agenda').addEventListener('click', (e) => {
      const b = e.target.closest('.wp-sf-slot[data-g]'); if (!b) return;
      st.gap = +b.dataset.g; this._haptic?.('light'); paintAgenda(); paint();
    });
    $('.wp-sf-note').addEventListener('input', (e) => { st.note = e.target.value; });

    // Navegación
    const PRIMARY = ['Elegir lugar', 'Elegir hora', 'Agregar parada'];
    const canGo = () => st.step === 0 ? !!st.act : st.step === 1 ? !!where() : true;
    const paint = () => {
      paintRibbon();
      root.querySelectorAll('.wp-sf-prog i').forEach((x, i) => x.classList.toggle('on', i <= st.step));
      go.disabled = !canGo();
      go.querySelector('span').textContent = st.step === 2 ? `Agregar · ${hh(at())}` : !canGo() ? (st.step === 0 ? 'Elige qué van a hacer' : 'Elige un lugar') : PRIMARY[st.step];
    };
    const goStep = (n) => {
      st.step = Math.max(0, Math.min(2, n));
      track.style.transform = `translateX(${-st.step * 100}%)`;
      steps.forEach((x, i) => { x.inert = i !== st.step; });
      $('.wp-sf-vp').scrollTop = 0;
      if (st.step === 1) paintPlaces();
      if (st.step === 2) paintAgenda();
      paint();
    };
    const finish = () => { root.classList.remove('in'); setTimeout(() => root.remove(), 320); setTimeout(() => this._openMyPlanSheet(a), 120); };
    $('.wp-sf-x').onclick = finish;
    $('.wp-sf-back').onclick = () => st.step ? goStep(st.step - 1) : finish();
    go.onclick = async () => {
      if (!canGo()) return;
      if (st.step < 2) { goStep(st.step + 1); return; }
      const A = actOf(), W = where();
      go.disabled = true;
      const stop = {
        place_id: String(W.place_id), name: W.name || W.displayName || 'Lugar',
        lat: W.lat != null ? Number(W.lat) : undefined, lng: W.lng != null ? Number(W.lng) : undefined,
        cat: W.category || A?.cat || '', after: (last?.after || 0) + st.gap,
        act: A?.key, emoji: A?.emoji, icon: A?.icon3d, note: st.note.trim() || undefined, address: W.address || W.formattedAddress || undefined,
      };
      const next = [...cur, stop];
      const ok = await this._planRpc('set_plan_stops', { p_activity: a.id, p_stops: next }, `Agregaste ${stop.name} · ya les avisamos`);
      if (!ok) { go.disabled = false; return; }
      a.stops = next;
      finish();
    };
    paintGrid();
    goStep(0);
    this._planPlaces().then(ps => { all = (ps || []).filter(p => p.place_id && p.lat && p.lng); if (root.isConnected && st.step === 1) paintPlaces(); });
  }

  // Línea de tiempo de solo lectura (Tu plan / Planes aquí)
  _planRouteHtml(a, { owner = false, compact = false } = {}) {
    const st = Array.isArray(a?.stops) ? a.stops : [];
    if (!st.length) return owner ? `<div class="wp-pv-route-ro"><button type="button" class="wp-pv-addstop-card" data-a="addstop">
        <span>🗺️</span><span><b>¿Siguen en otro lado?</b><small>Agrega una parada al plan</small></span><i>+</i></button></div>` : '';
    const t0 = new Date(a.scheduled_at);
    if (compact) return `<div class="wp-ph-route">🗺️ ${1 + st.length} paradas · ${[a.place_name, ...st.map(x => x.name)].map(n => this._esc(String(n || '').split(' ').slice(0, 3).join(' '))).join(' → ')}</div>`;
    const row = (i, name, d, cat, rm, x = {}) => `<div class="wp-pv-stop"><span class="wp-pv-stop-n">${i}</span>
        <span class="wp-pv-stop-t"><b>${this._esc(name)}</b><small>${x.emoji || this._stopEmoji(cat)} ${this._hhmm(d)}${x.custom ? ' · lugar propio' : ''}${x.address ? ' · ' + this._esc(x.address) : ''}</small>${x.note ? `<span class="wp-pv-stop-note">“${this._esc(x.note)}”</span>` : ''}</span>${rm ? `<button type="button" class="wp-pv-stop-x" data-rm="${rm}" aria-label="Quitar parada">×</button>` : ''}</div>`;
    return `<div class="wp-pv-route-ro">
        <div class="wp-pv-lbl">Ruta <span class="wp-pv-hint">${1 + st.length} paradas</span></div>
        <div class="wp-pv-route">${row(1, a.place_name || this._placeInfo().name, t0, this._place?.category, 0)}
          ${st.map((x, i) => row(i + 2, x.name, new Date(t0.getTime() + (x.after || 0) * 60000), x.cat, owner ? String(i + 1) : '', x)).join('')}</div>
        <div class="wp-pv-route-acts"><button type="button" data-a="route">🗺️ Ver ruta en el mapa</button>${owner && st.length < 3 ? '<button type="button" data-a="addstop">+ Parada</button>' : ''}</div>
      </div>`;
  }

  // Abrir el mapa solo con las paradas (ruta), y al cerrar volver a la ficha
  async _planShowRoute(a) {
    const all = await this._planPlaces();
    const byId = (id) => all.find(p => String(p.place_id) === String(id));
    const back = this._place;
    const list = [byId(a.place_id) || back, ...(a.stops || []).filter(x => x.lat != null && x.lng != null).map(x => byId(x.place_id) || { place_id: x.place_id, name: x.name, displayName: x.name, lat: x.lat, lng: x.lng, location: { lat: x.lat, lng: x.lng }, category: x.cat })].filter(Boolean);
    window.wpApp?.showPlacesOnMap?.(list, a.title, { onBack: () => { try { this.show(back); } catch (_) {} } });
  }
}
