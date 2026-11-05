// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-wizard.js
// Asistente "Planear visita" (3 pasos: cuándo · con quién · último
// toque) → RPC create_plan. Se mezcla en PlaceModal2.prototype.
// Estilos: /styles/place-plans.css (.wp-pv-*)
// ════════════════════════════════════════════════════════════════════
import { getSupabase, ActivityService } from '/src/services/SupabaseService.js';
import { getAvatarUrl } from '/src/services/AvatarService.js';

export class PlanWizard {
  // ── Planear visita: crear un plan (actividad) en este lugar ─────────
  // Misma hoja y mismo lenguaje que "Añadir a una colección", en 3 PASOS:
  //   1 · Qué y cuándo (tipo, día, hora)
  //   2 · Con quién (cuántos, invitados, quién lo ve)
  //   3 · Listo para crear (título, nota y resumen)
  // Guarda con la RPC create_plan (activities_plans.sql); sin ese SQL cae a
  // ActivityService.createActivity (público, sin invitados ni nota).
  _openPlanSheet() {
    const user = this._requireUser('Inicia sesión para planear una visita');
    if (!user || !this._place) return;
    const place = this._place;
    const info = this._placeInfo();
    const { body, close } = this._openSheet('Planear visita', info.name);
    const TYPES = [
      ['food', '🍔', 'Comer'], ['drinks', '☕', 'Café'], ['hangout', '🎈', 'Pasar el rato'],
      ['explore', '🚀', 'Explorar'], ['shop', '🛍️', 'Compras'], ['music', '🎵', 'Música'],
      ['sport', '🏃', 'Deporte'], ['photo', '📸', 'Fotos'], ['spa', '💆', 'Spa'],
    ];
    // Tipo sugerido por la categoría del lugar
    const cat = `${place.category || ''} ${(place.types || []).join(' ')} ${place.subcategory || ''}`.toLowerCase();
    let type = /caf|coffee|bakery|pan/.test(cat) ? 'drinks' : /restaur|food|taco|comida|meal/.test(cat) ? 'food'
      : /bar|night|antro|music/.test(cat) ? 'music' : /store|shop|tienda|mall/.test(cat) ? 'shop'
      : /gym|sport|park|parque|campo/.test(cat) ? 'sport' : /spa|beauty|salon|barber/.test(cat) ? 'spa' : 'hangout';
    // Solo los planes que tienen sentido en ESTE tipo de lugar (antes salían
    // los 9 en todos: "Spa" en un restaurante, "Comer" en un spa…)
    const CAT_TYPES = {
      RESTAURANTS:   ['food', 'drinks', 'hangout', 'music', 'photo'],
      HEALTH:        ['spa', 'sport', 'hangout'],
      SHOPPING:      ['shop', 'hangout', 'drinks', 'food', 'photo'],
      ENTERTAINMENT: ['hangout', 'music', 'drinks', 'food', 'photo', 'explore'],
      PARKS:         ['hangout', 'sport', 'explore', 'photo'],
      WORKSHOPS:     ['explore', 'hangout', 'shop', 'photo'],
    };
    let allowed = CAT_TYPES[String(place.category || '').toUpperCase()];
    if (!allowed) { // categoría desconocida: lo que diga el texto del lugar, si no, todos
      allowed = TYPES.map(t => t[0]);
    }
    if (!allowed.includes(type)) type = allowed[0];
    // el sugerido va primero
    allowed = [type, ...allowed.filter(k => k !== type)];
    let SHOWN = allowed.map(k => TYPES.find(t => t[0] === k)).filter(Boolean);
    // Como en "Crear actividad": si el lugar es de una categoría con
    // actividades (Restaurantes → tacos, birria, mariscos…), salen las de SU
    // subcategoría (una taquería → tacos; un café → café) y al final
    // "Pasar el rato" y "Fotos". Sin subcategoría: todas las de la categoría.
    const ACTS = (this._actTypes || []).filter(t => t.cat === String(place.category || '').toUpperCase());
    const ICON = {};
    if (ACTS.length) {
      const tags = new Set([...(Array.isArray(place.subcategoryTags) ? place.subcategoryTags : []),
        ...String(place.subcategory_tags || '').split(','), place.subcategory, place.subcategory_id]
        .map(x => String(x || '').trim().toLowerCase()).filter(Boolean));
      let mine = ACTS.filter(t => (t.subcats || []).some(sc => tags.has(sc)));
      if (!mine.length) mine = ACTS;
      SHOWN = [...mine.map(t => { ICON[t.key] = t.icon3d; return [t.key, t.emoji, t.label]; }),
        ...['hangout', 'photo'].map(k => TYPES.find(t => t[0] === k))];
      type = SHOWN[0][0];
    }
    const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 6 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; });
    const dayLabel = (d, i) => i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${DOW[d.getDay()]} ${d.getDate()}`;
    let day = 0, customDay = null, time = null, timeCustom = false, n = 4, nTouched = false, vis = 'public', step = 0;
    const invited = new Set();
    const people = new Map(); // id → perfil (para el resumen)
    const pad = (x) => String(x).padStart(2, '0');
    const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    const BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
    const STEP_T = ['Cuándo', 'Con quién', 'Último toque'];

    body.innerHTML = `
      <div class="wp-pv">
        <div class="wp-pv-progress"><i></i><i></i><i></i><span class="wp-pv-step-t"></span></div>
        <div class="wp-pv-viewport"><div class="wp-pv-track">
          <section class="wp-pv-step">
            <div class="wp-pv-lbl">¿Cuándo?</div>
            <div class="wp-pv-chips" data-k="day">
              ${days.map((d, i) => `<button type="button" data-v="${i}">${dayLabel(d, i)}</button>`).join('')}
              <button type="button" data-v="other" class="wp-pv-other">Otro día<input type="date" class="wp-pv-native" tabindex="-1"></button>
            </div>
            <div class="wp-pv-lbl">¿A qué hora?</div>
            <div class="wp-pv-chips" data-k="time"></div>
          </section>
          <section class="wp-pv-step">
            <div class="wp-pv-lbl">¿Quién puede unirse?</div>
            <div class="wp-pv-chips wp-pv-seg" data-k="vis">
              <button type="button" data-v="public">Cualquiera</button>
              <button type="button" data-v="followers">Seguidores</button>
              <button type="button" data-v="invited">Invitados</button>
            </div>
            <div class="wp-pv-vis-hint"></div>
            <div class="wp-pv-lbl">¿A quién invitas? <span class="wp-pv-hint wp-pv-inv-count">opcional</span></div>
            <div class="wp-pv-people"><span class="wp-pv-empty">Cargando…</span></div>
            <div class="wp-pv-cupo">
              <div class="wp-pv-lbl">¿Cuántos cupos? <span class="wp-pv-hint">contándote</span></div>
              <div class="wp-pv-chips" data-k="n"></div>
            </div>
          </section>
          <section class="wp-pv-step">
            <div class="wp-pv-lbl">Nombre del plan <span class="wp-pv-hint">toca el ícono para cambiarlo</span></div>
            <div class="wp-pm2-col-field wp-pv-titlef">
              <button type="button" class="wp-pv-ico" aria-label="Cambiar ícono del plan"><span></span></button>
              <input class="wp-pm2-col-input2 wp-pv-title" type="text" maxlength="60" enterkeyhint="done" autocapitalize="sentences" autocomplete="off">
            </div>
            <div class="wp-pm2-col-strip wp-pv-strip" hidden><div class="wp-pm2-col-strip-track">
              ${SHOWN.map(([k, e, l]) => `<button type="button" data-t="${k}" aria-label="${l}">${e}</button>`).join('')}
            </div></div>
            <div class="wp-pv-lbl">Reglas del plan <span class="wp-pv-hint">opcional</span></div>
            <div class="wp-pv-rules">${this._planRules().map(([k, e, t]) => `<button type="button" data-r="${k}">${e} ${t}</button>`).join('')}</div>
            <button type="button" class="wp-pv-addnote">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>
              Agregar una nota</button>
            <div class="wp-pv-postit" hidden>
              <i class="wp-pv-tape"></i>
              <textarea class="wp-pv-note" rows="3" maxlength="280" placeholder="Ej. Yo llevo el pastel · nos vemos en la entrada" autocapitalize="sentences"></textarea>
              <div class="wp-pv-postit-foot"><span class="wp-pv-note-n">0/280</span><button type="button" class="wp-pv-note-x">Quitar nota</button></div>
            </div>
            <div class="wp-pv-card">
              <div class="wp-pv-card-emo"></div>
              <div class="wp-pv-card-txt"><b class="wp-pv-card-t"></b><span class="wp-pv-card-w"></span><span class="wp-pv-card-v"></span></div>
              <div class="wp-pv-card-faces"></div>
            </div>
          </section>
        </div></div>
        <div class="wp-pv-sum"></div>
        <div class="wp-pv-foot">
          <button type="button" class="wp-pv-back" aria-label="Atrás">${BACK}</button>
          <button type="button" class="wp-pv-cta" disabled></button>
        </div>
      </div>`;
    { const f = body.querySelector('.wp-pv > .wp-pv-foot'); if (f) body.appendChild(f); }
    const $ = (s) => body.querySelector(s);
    const typeName = $('.wp-pv-type-name'), timeBox = $('[data-k="time"]'), titleIn = $('.wp-pv-title');
    const sumEl = $('.wp-pv-sum'), cta = $('.wp-pv-cta'), backBtn = $('.wp-pv-back');
    const viewport = $('.wp-pv-viewport'), track = $('.wp-pv-track');
    const steps = [...body.querySelectorAll('.wp-pv-step')];
    const dateIn = $('[data-k="day"] .wp-pv-native');
    const tName = () => (SHOWN.find(t => t[0] === type) || TYPES.find(t => t[0] === type) || TYPES[2])[2];
    const tEmo = () => (SHOWN.find(t => t[0] === type) || TYPES.find(t => t[0] === type) || TYPES[2])[1];
    const autoTitle = () => `Plan en ${info.name}`.slice(0, 60);

    const dayDate = () => customDay ? new Date(customDay) : days[day];
    const isToday = () => !customDay && day === 0;
    const paintTimes = () => {
      const now = new Date();
      const hours = [];
      for (let h = 8; h <= 23; h++) if (!isToday() || h > now.getHours()) hours.push(h);
      const opts = [...(isToday() ? [['now', 'Ahora']] : []), ...hours.map(h => [`${pad(h)}:00`, `${h > 12 ? h - 12 : h}${h >= 12 ? ' pm' : ' am'}`])];
      if (time && time !== 'now' && !timeCustom && !opts.some(o => o[0] === time)) time = null;
      if (time === 'now' && !isToday()) time = null;
      timeBox.innerHTML = opts.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('') +
        `<button type="button" data-v="other" class="wp-pv-other">Otra hora<input type="time" class="wp-pv-native" tabindex="-1"></button>`;
      const tIn = timeBox.querySelector('.wp-pv-native');
      tIn.onchange = () => { if (tIn.value) { time = tIn.value; timeCustom = true; paint(); } };
      if (!time) time = (opts.find(o => o[0] !== 'now') || opts[0])?.[0] || '18:00'; // de entrada, la próxima hora
    };
    const when = () => {
      if (time === 'now') return new Date(Date.now() + 5 * 60000);
      const d = dayDate(); const [h, m] = String(time || '18:00').split(':').map(Number);
      const r = new Date(d); r.setHours(h || 0, m || 0, 0, 0); return r;
    };
    const fmtWhen = () => {
      if (time === 'now') return 'Ahora';
      const d = when(); const i = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 86400000);
      const dl = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${DOW[d.getDay()]} ${d.getDate()}`;
      const h = d.getHours();
      return `${dl} · ${h > 12 ? h - 12 : h || 12}:${pad(d.getMinutes())} ${h >= 12 ? 'pm' : 'am'}`;
    };
    const VIS = { public: 'Abierto a cualquiera', followers: 'Para tus seguidores', invited: 'Solo invitados' };

    // Alto de la hoja = alto del paso actual (anima al cambiar de paso)
    const fitStep = (animate = true) => {
      const h = steps[step].offsetHeight;
      viewport.style.transition = animate ? 'height 0.32s cubic-bezier(0.32,0.72,0,1)' : 'none';
      viewport.style.height = h + 'px';
    };
    const goStep = (s) => {
      step = Math.max(0, Math.min(2, s));
      track.style.transform = `translateX(${-step * 100}%)`;
      steps.forEach((el, i) => { el.inert = i !== step; el.setAttribute('aria-hidden', String(i !== step)); });
      this._haptic?.('light');
      paint();
      fitStep(true);
    };

    const paint = () => {
      // Paso 1
      body.querySelectorAll('.wp-pv-strip button').forEach(b => b.classList.toggle('wp-pm2-on', b.dataset.t === type));
      $('.wp-pv-ico span').textContent = tEmo();
      body.querySelectorAll('[data-k="day"] button').forEach(b => b.classList.toggle('on', customDay ? b.dataset.v === 'other' : b.dataset.v === String(day)));
      const oDay = $('[data-k="day"] .wp-pv-other');
      oDay.firstChild.textContent = customDay ? (() => { const d = new Date(customDay); return `${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; })() : 'Otro día';
      const custom = time && time !== 'now' && !timeBox.querySelector(`[data-v="${time}"]`);
      timeBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', custom ? b.dataset.v === 'other' : b.dataset.v === time));
      const oT = timeBox.querySelector('.wp-pv-other'); if (oT) oT.firstChild.textContent = custom ? time : 'Otra hora';
      // Paso 2
      // Cupo: con "Invitados" es tú + tus invitados (sin elegir). Abierto:
      // eliges cuántos lugares, nunca menos que tú + los que ya invitaste.
      const minN = invited.size + 1;
      if (vis === 'invited') n = Math.max(2, minN);
      else if (n < minN || !nTouched) n = Math.max(nTouched ? n : 4, minN);
      const NOPTS = [...new Set([2, 3, 4, 6, 8, 10, 15, 20].filter(v => v >= minN).concat(minN >= 2 ? [minN] : []))].sort((a, b) => a - b).slice(0, 8);
      $('[data-k="n"]').innerHTML = NOPTS.map(v => `<button type="button" data-v="${v}">${v}</button>`).join('');
      $('.wp-pv-cupo').hidden = vis === 'invited';
      body.querySelectorAll('[data-k="n"] button').forEach(b => b.classList.toggle('on', b.dataset.v === String(n)));
      body.querySelectorAll('[data-k="vis"] button').forEach(b => b.classList.toggle('on', b.dataset.v === vis));
      body.querySelectorAll('.wp-pv-person').forEach(b => b.classList.toggle('on', invited.has(b.dataset.id)));
      $('.wp-pv-inv-count').textContent = invited.size ? `${invited.size} invitad${invited.size === 1 ? 'o' : 'os'}` : (vis === 'invited' ? 'elige al menos 1' : 'opcional');
      $('.wp-pv-vis-hint').textContent = vis === 'public' ? 'Aparece en el mapa y cualquiera puede pedir unirse.'
        : vis === 'followers' ? 'Solo lo ve y se puede unir la gente que te sigue.'
        : 'Privado: solo lo ven las personas que invites. Van tú y ellos.';
      // Paso 3
      if (!titleIn.dataset.touched) titleIn.value = autoTitle();
      titleIn.placeholder = autoTitle();
      $('.wp-pv-card-emo').textContent = tEmo();
      $('.wp-pv-card-t').textContent = titleIn.value.trim() || autoTitle();
      $('.wp-pv-card-w').textContent = vis === 'invited' ? `${fmtWhen()} · tú + ${invited.size}` : `${fmtWhen()} · ${n} cupos`;
      $('.wp-pv-card-v').textContent = VIS[vis];
      $('.wp-pv-card-faces').innerHTML = [...invited].slice(0, 4).map(id => {
        const p = people.get(id) || {};
        return `<i class="wp-seal" style="background-image:url('${this._esc(p.avatar_url || getAvatarUrl(p.name || p.username || 'user'))}')"></i>`;
      }).join('') + (invited.size > 4 ? `<b>+${invited.size - 4}</b>` : '');
      // Encabezado de pasos
      body.querySelectorAll('.wp-pv-progress i').forEach((el, i) => el.classList.toggle('on', i <= step));
      $('.wp-pv-step-t').textContent = `${step + 1} de 3 · ${STEP_T[step]}`;
      backBtn.hidden = step === 0;
      // Condiciones de cada paso
      const past = time !== 'now' && when() < new Date();
      const noInv = vis === 'invited' && !invited.size;
      const msg = step === 0 ? (past ? 'Elige una hora que no haya pasado' : fmtWhen())
        : step === 1 ? (noInv ? 'Elige a quién invitas, o deja que se una cualquiera'
          : vis === 'invited' ? `Tú + ${invited.size} invitad${invited.size === 1 ? 'o' : 'os'}`
          : `${n} cupos · ${invited.size ? invited.size + ' invitad' + (invited.size === 1 ? 'o' : 'os') + ' · ' : ''}${VIS[vis].toLowerCase()}`)
        : '';
      sumEl.textContent = msg;
      sumEl.hidden = !msg;
      sumEl.classList.toggle('warn', (step === 0 && past) || (step === 1 && noInv));
      const ok = step === 0 ? !past : step === 1 ? !noInv : (!past && !noInv && !!titleIn.value.trim());
      cta.disabled = !ok;
      cta.innerHTML = step < 2 ? `<span>Siguiente</span>${ARROW}` : `${CHECK}<span>Crear plan</span>`;
      if (step === 2) requestAnimationFrame(() => fitStep(false));
    };

    // Ícono del plan: solo para identificarlo (no es un paso)
    const icoStrip = body.querySelector('.wp-pv-strip');
    $('.wp-pv-ico').onclick = () => {
      icoStrip.hidden = !icoStrip.hidden;
      this._haptic?.('light');
      if (!icoStrip.hidden) {
        const on = icoStrip.querySelector('.wp-pm2-on');
        if (on) icoStrip.scrollLeft = Math.max(0, on.offsetLeft - (icoStrip.clientWidth - on.offsetWidth) / 2);
      }
      requestAnimationFrame(() => fitStep(false));
    };
    icoStrip.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-t]'); if (!b) return;
      type = b.dataset.t; this._scaleKeys?.(b, [0.85, 1.1, 1], 260); paint();
      this._scaleKeys?.($('.wp-pv-ico'), [0.8, 1.15, 1], 300);
      setTimeout(() => { icoStrip.hidden = true; requestAnimationFrame(() => fitStep(false)); }, 220);
    });
    $('[data-k="day"]').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v === 'other') { try { dateIn.showPicker ? dateIn.showPicker() : dateIn.click(); } catch (_) { dateIn.click(); } return; }
      day = +b.dataset.v; customDay = null; paintTimes(); paint();
    });
    dateIn.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    dateIn.onchange = () => { if (!dateIn.value) return; const [y, m, d] = dateIn.value.split('-').map(Number); customDay = new Date(y, m - 1, d).getTime(); paintTimes(); paint(); };
    timeBox.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v === 'other') { const tIn = b.querySelector('input'); try { tIn.showPicker ? tIn.showPicker() : tIn.click(); } catch (_) { tIn.click(); } return; }
      time = b.dataset.v; timeCustom = false; paint();
    });
    $('[data-k="n"]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; n = +b.dataset.v; nTouched = true; paint(); });
    $('[data-k="vis"]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; vis = b.dataset.v; paint(); });
    titleIn.addEventListener('input', () => { titleIn.dataset.touched = '1'; paint(); });
    // Reglas: se tocan; las opuestas se apagan solas (paga cada quien / yo invito)
    const rules = new Set();
    const RULES = this._planRules();
    $('.wp-pv-rules').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-r]'); if (!b) return;
      const k = b.dataset.r, ex = RULES.find(r => r[0] === k)?.[3];
      if (rules.has(k)) rules.delete(k);
      else { rules.add(k); if (ex) rules.delete(ex); }
      body.querySelectorAll('.wp-pv-rules button').forEach(x => x.classList.toggle('on', rules.has(x.dataset.r)));
      this._haptic?.('light');
      paint();
    });
    const noteBtn = $('.wp-pv-addnote'), noteF = $('.wp-pv-postit'), noteIn = $('.wp-pv-note'), noteN = $('.wp-pv-note-n');
    noteBtn.onclick = () => {
      noteBtn.hidden = true; noteF.hidden = false;
      noteF.classList.remove('in'); void noteF.offsetWidth; noteF.classList.add('in');
      fitStep(true);
      try { noteIn.focus({ preventScroll: true }); } catch (_) { noteIn.focus(); }
    };
    noteIn.addEventListener('input', () => { noteN.textContent = `${noteIn.value.length}/280`; });
    $('.wp-pv-note-x').onclick = () => { noteIn.value = ''; noteN.textContent = '0/280'; noteF.hidden = true; noteBtn.hidden = false; fitStep(true); };
    backBtn.onclick = () => goStep(step - 1);

    // ¿A quién invitas?: la gente que sigues (avatar con sello). Tocar = invitar.
    const peopleEl = $('.wp-pv-people');
    peopleEl.addEventListener('click', (e) => {
      const b = e.target.closest('.wp-pv-person'); if (!b) return;
      invited.has(b.dataset.id) ? invited.delete(b.dataset.id) : invited.add(b.dataset.id);
      this._haptic?.('light'); this._scaleKeys?.(b, [0.9, 1.06, 1], 240); paint();
    });
    (async () => {
      try {
        const sb = getSupabase();
        const { data: fl, error } = await sb.from('follows').select('following_id').eq('follower_id', user.id).limit(80);
        if (error) throw error;
        const ids = (fl || []).map(r => r.following_id);
        if (!ids.length) { peopleEl.innerHTML = '<span class="wp-pv-empty">Cuando sigas a alguien, aquí podrás invitarlo</span>'; return; }
        const { data: ps, error: e2 } = await sb.from('profiles').select('id, name, username, avatar_url').in('id', ids);
        if (e2) throw e2;
        const list = (ps || []).sort((a, b) => String(a.name || a.username || '').localeCompare(String(b.name || b.username || '')));
        list.forEach(p => people.set(p.id, p));
        const first = (p) => this._esc(String(p.name || (p.username ? '@' + p.username : 'Alguien')).split(' ')[0]);
        peopleEl.innerHTML = list.map(p => `<button type="button" class="wp-pv-person" data-id="${p.id}">
            <span class="wp-pv-pav wp-seal" style="background-image:url('${this._esc(p.avatar_url || getAvatarUrl(p.name || p.username || 'user'))}')"></span>
            <i class="wp-pv-pchk"><svg viewBox="0 0 24 24" width="11" height="11"><path d="M20 6 9 17l-5-5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i>
            <span class="wp-pv-pname">${first(p)}</span></button>`).join('');
        paint();
        if (step === 1) fitStep(true);
      } catch (e) {
        console.warn('[DIAG-PLAN] no cargó a quién sigues:', e?.message || e);
        peopleEl.innerHTML = '<span class="wp-pv-empty">No se pudo cargar a quién sigues</span>';
      }
    })();

    cta.onclick = async () => {
      if (cta.disabled || cta.classList.contains('busy')) return;
      if (step < 2) { goStep(step + 1); return; }
      cta.classList.add('busy');
      const at = when();
      const title = titleIn.value.trim() || autoTitle();
      const whenTxt = fmtWhen();
      try {
        const { error } = await getSupabase().rpc('create_plan', {
          p_title: title, p_type: type, p_place_name: info.name, p_place_id: String(place.place_id || place.id || ''),
          p_lat: Number(info.lat), p_lng: Number(info.lng), p_at: at.toISOString(), p_max: n,
          p_spontaneous: time === 'now', p_visibility: vis, p_note: noteIn.value.trim() || null, p_invited: [...invited],
          p_icon: ICON[type] || null, p_rules: [...rules],
        });
        if (error) {
          const missing = error.code === 'PGRST202' || /create_plan/.test(error.message || '');
          if (!missing) throw error;
          console.warn('[DIAG-PLAN] falta activities_plans.sql: se crea sin invitados ni visibilidad');
          await ActivityService.createActivity({
            title, type, place_name: info.name, place_id: place.place_id || place.id || null, icon_url: ICON[type] || null,
            lat: Number(info.lat), lng: Number(info.lng), scheduled_at: at.toISOString(), max_participants: n, is_spontaneous: time === 'now',
          });
        }
        this._haptic?.('success');
        try { this._loadPlaceActivities(place); } catch (_) {}
        try { this._loadPlanState(place); } catch (_) {}
        try { window.wpApp?.mapView?._loadActivities?.(); } catch (_) {}
        // Pantalla de listo: palomita + compartir por WhatsApp/otras apps
        const shareTxt = `¿Vamos? ${title} · ${whenTxt}${info.address ? ' · ' + info.address : ''}${info.url ? '\n' + info.url : ''}`;
        body.innerHTML = `<div class="wp-pv-done">
            <div class="wp-pv-done-ic">${CHECK.replace('width="18" height="18"', 'width="34" height="34"')}</div>
            <div class="wp-pv-done-t">¡Plan creado!</div>
            <div class="wp-pv-done-s">${this._esc(title)}<br>${this._esc(whenTxt)}${invited.size ? ` · ${invited.size} invitad${invited.size === 1 ? 'o' : 'os'} (ya les avisamos)` : ''}</div>
            <button type="button" class="wp-pv-cta wp-pv-share"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg><span>Compartir el plan</span></button>
            <button type="button" class="wp-pv-ok">Listo</button>
          </div>`;
        body.querySelector('.wp-pv-ok').onclick = () => close();
        body.querySelector('.wp-pv-share').onclick = async () => {
          try {
            if (navigator.share) await navigator.share({ title, text: shareTxt });
            else window.open('https://wa.me/?text=' + encodeURIComponent(shareTxt), '_blank');
          } catch (_) {}
        };
        return;
      } catch (e) {
        console.warn('[DIAG-PLAN] no se creó el plan:', e?.message || e);
        this._showToast(e?.message || 'No se pudo crear el plan');
      } finally { cta.classList.remove('busy'); }
    };

    // ── Teclado: la hoja se acomoda entre la barra de estado y el teclado
    // (mismo principio que "Añadir a una colección") y el campo en el que
    // escribes siempre queda a la vista
    const sheetEl = document.getElementById('wp-pm2-menu-sheet');
    const menuEl = sheetEl?.querySelector('.wp-pm2-ms-menu');
    const pv = $('.wp-pv');
    const safe = (() => {
      const pr = document.createElement('div');
      pr.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(pr);
      const cs = getComputedStyle(pr), r = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
      pr.remove(); return r;
    })();
    const keepVisible = () => {
      const a = document.activeElement;
      if (!a || !pv.contains(a)) return;
      const pr = pv.getBoundingClientRect(), ar = a.getBoundingClientRect();
      if (ar.bottom > pr.bottom - 8) pv.scrollTop += ar.bottom - pr.bottom + 16;
      else if (ar.top < pr.top + 8) pv.scrollTop -= pr.top - ar.top + 16;
    };
    const fitKb = () => {
      if (!sheetEl?.isConnected || !menuEl) {
        window.removeEventListener('resize', fitKb); window.visualViewport?.removeEventListener('resize', fitKb); return;
      }
      const vv = window.visualViewport;
      const visH = vv ? vv.height : window.innerHeight;
      const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      menuEl.style.bottom = kb ? `${kb + 8}px` : '';
      const vTop = vv ? vv.offsetTop : 0;
      const bottomY = kb ? vTop + visH - 8 : window.innerHeight - 12 - safe.bottom;
      const topY = vTop + safe.top + 12;
      const rest = menuEl.offsetHeight - pv.offsetHeight; // hoja sin el contenido
      pv.style.maxHeight = `${Math.max(160, Math.floor(bottomY - topY - rest))}px`;
      requestAnimationFrame(keepVisible);
    };
    window.addEventListener('resize', fitKb);
    window.visualViewport?.addEventListener('resize', fitKb);
    [titleIn, noteIn].forEach(i => i.addEventListener('focus', () => setTimeout(fitKb, 350)));
    setTimeout(fitKb, 380);

    paintTimes(); paint();
    steps.forEach((el, i) => { el.inert = i !== 0; });
    // El tipo elegido, a la vista en la tira. OJO: sin scrollIntoView — ese
    // también movía la ficha de atrás (era el "rebote" al abrir la hoja)
    requestAnimationFrame(() => {
      fitStep(false);
    });
  }
}
