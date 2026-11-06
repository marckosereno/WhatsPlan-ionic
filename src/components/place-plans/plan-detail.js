// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-detail.js
// Detalle de un plan en pantalla completa (para quien NO va todavía):
// foto del lugar, quién organiza, cuándo / cupos / paradas, quién va,
// la ruta, reglas y la nota — y un botón fijo para unirse.
// Pensado para motivar: prueba social ("Ana y 2 más ya van"), cupos
// que quedan y cuánto falta.
// Se mezcla en PlaceModal2.prototype. Estilos: /styles/plan-detail.css
// ════════════════════════════════════════════════════════════════════

const ICONS = {
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  people: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
  route: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/></svg>',
};

export class PlanDetail {
  // ── Abrir ────────────────────────────────────────────────────────────
  _openPlanDetail(a) {
    const d = this._pdContext(a);
    d.root = document.createElement('div');
    d.root.id = 'wp-pd';
    d.root.innerHTML = this._pdHero(d) + `<main class="wp-pd-body">${this._pdHead(d)}${this._pdStats(d)}${this._pdWho(d)}${this._pdExtras(d)}</main>` + this._pdFoot(d);
    document.body.appendChild(d.root);
    this._pdBind(d);
    requestAnimationFrame(() => d.root.classList.add('in'));
  }

  _pdContext(a) {
    const me = window.wpApp?.currentUser?.id || null;
    const going = (a.participants || []).length;
    return {
      a, me, going,
      full: this._planFull(a),
      left: a.max_participants ? Math.max(0, a.max_participants - going) : null,
      invited: !!me && (a.invited || []).includes(me) && !(a.participants || []).includes(me) && !(a.declined || []).includes(me),
      inIt: !!me && (a.participants || []).includes(me),
      waiting: !!me && (a.waitlist || []).includes(me),
    };
  }

  _pdName(id, full = false) {
    const p = this._profCache?.get(id) || {};
    const n = String(p.name || (p.username ? '@' + p.username : 'Alguien'));
    return this._esc(full ? n : n.split(' ')[0]);
  }

  // "en 3 h", "en 2 días", "ahora"
  _pdCountdown(at) {
    const min = Math.round((new Date(at) - Date.now()) / 60000);
    if (min <= 0) return 'Es ahora';
    if (min < 60) return `en ${min} min`;
    if (min < 36 * 60) return `en ${Math.round(min / 60)} h`;
    return `en ${Math.round(min / 1440)} días`;
  }

  // ── Partes ───────────────────────────────────────────────────────────
  _pdHero(d) {
    const p = this._place || {};
    const ph = p.photosUrls?.[0] || p.photoUrl || p.photo_url || '';
    const ico = d.a.icon_url ? `<img src="${this._esc(d.a.icon_url)}" alt="" onerror="this.replaceWith(document.createTextNode('${this._planEmoji(d.a.type)}'))">` : this._planEmoji(d.a.type);
    return `<header class="wp-pd-hero"${ph ? ` style="background-image:url('${this._esc(ph)}')"` : ''}>
        <button type="button" class="wp-pd-round" data-a="close" aria-label="Volver">${ICONS.back}</button>
        <button type="button" class="wp-pd-round" data-a="share" aria-label="Compartir">${ICONS.share}</button>
        <span class="wp-pd-badge">${ico}</span>
      </header>`;
  }

  _pdHead(d) {
    const a = d.a;
    return `<section class="wp-pd-head">
        ${d.invited ? `<span class="wp-pd-inv">💌 ${this._pdName(a.creator_id)} te invitó</span>` : ''}
        <h1>${this._esc(a.title)}</h1>
        <div class="wp-pd-host"><span class="wp-pd-av">${this._planFace(a.creator_id)}</span>
          <span>Organiza <b>${this._pdName(a.creator_id, true)}</b> · ${this._esc(this._placeInfo().name)}</span></div>
      </section>`;
  }

  _pdStats(d) {
    const a = d.a, stops = (a.stops || []).length;
    const [day, hour] = this._planWhen(a.scheduled_at).split(' · ');   // "Mañana" · "10 am"
    const tile = (ico, k, v, sub = '', cls = '') => `<div class="wp-pd-stat ${cls}">${ico}<small>${k}</small><b>${v}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
    const cupo = !a.max_participants ? tile(ICONS.people, 'Van', String(d.going), 'sin límite')
      : d.full ? tile(ICONS.people, 'Cupos', `${d.going}/${a.max_participants}`, 'Completo', 'full')
      : tile(ICONS.people, 'Cupos', `${d.going}/${a.max_participants}`, `Queda${d.left === 1 ? '' : 'n'} ${d.left}`, d.left <= 2 ? 'hot' : '');
    return `<section class="wp-pd-stats">
        ${tile(ICONS.clock, 'Cuándo', this._esc(day), `${this._esc(hour)} · ${this._pdCountdown(a.scheduled_at)}`)}
        ${cupo}
        ${tile(ICONS.route, stops ? 'Paradas' : 'Lugar', stops ? String(stops + 1) : '1', stops ? 'con ruta' : 'aquí')}
      </section>`;
  }

  _pdWho(d) {
    const ids = d.a.participants || [];
    if (!ids.length) return '';
    const names = ids.slice(0, 2).map(id => this._pdName(id));
    const proof = ids.length === 1 ? `${names[0]} ya va` : ids.length === 2 ? `${names[0]} y ${names[1]} ya van` : `${names[0]}, ${names[1]} y ${ids.length - 2} más ya van`;
    return `<section class="wp-pd-card">
        <h2>Quién va</h2>
        <div class="wp-pd-faces">${ids.slice(0, 6).map(id => `<span class="wp-pd-face">${this._planFace(id)}<small>${this._pdName(id)}</small></span>`).join('')}
          ${ids.length > 6 ? `<span class="wp-pd-face more"><i>+${ids.length - 6}</i></span>` : ''}</div>
        <p class="wp-pd-proof">${proof}${d.left && d.left > 0 && !d.full ? ' · ¡súmate!' : ''}</p>
      </section>`;
  }

  _pdExtras(d) {
    const a = d.a;
    const route = (a.stops || []).length ? `<section class="wp-pd-card">${this._planRouteHtml(a)}</section>` : '';
    const rules = this._planRulesHtml(a);
    const note = a.note ? `<section class="wp-pd-card wp-pd-note"><span class="wp-pd-av">${this._planFace(a.creator_id)}</span>
        <p><small>${this._pdName(a.creator_id)} dice</small>“${this._esc(a.note)}”</p></section>` : '';
    return `${note}${route}${rules ? `<section class="wp-pd-card"><h2>Reglas del plan</h2>${rules}</section>` : ''}`;
  }

  _pdFoot(d) {
    const btn = (a, cls, txt) => `<button type="button" class="${cls}" data-a="${a}">${txt}</button>`;
    let html;
    if (d.inIt) html = btn('close', 'wp-pd-cta done', '✓ Ya vas a este plan');
    else if (d.full) html = btn(d.waiting ? 'unwait' : 'wait', 'wp-pd-cta' + (d.waiting ? ' done' : ''), d.waiting ? '✓ Te avisaremos si se libera un cupo' : '🔔 Avísame si se libera un cupo');
    else if (d.invited) html = btn('no', 'wp-pd-ghost', 'No puedo') + btn('yes', 'wp-pd-cta', 'Aceptar invitación');
    else html = btn('yes', 'wp-pd-cta', 'Unirme al plan');
    const sub = !d.inIt && !d.full && d.left ? `<p class="wp-pd-left">${d.left === 1 ? '¡Queda 1 cupo!' : `Quedan ${d.left} cupos`}</p>` : '';
    return `<footer class="wp-pd-foot">${sub}<div class="wp-pd-btns">${html}</div></footer>`;
  }

  // ── Acciones ────────────────────────────────────────────────────────
  _pdBind(d) {
    d.root.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return;
      const k = b.dataset.a;
      if (k === 'close') return this._pdClose(d);
      if (k === 'share') return this._planShare(d.a);
      b.disabled = true;
      let ok = false;
      if (k === 'yes' || k === 'no') {
        ok = await this._planRpc('respond_plan', { p_activity: d.a.id, p_accept: k === 'yes' },
          k === 'yes' ? `¡Vas! ${this._planWhen(d.a.scheduled_at)}` : 'Le avisamos que no puedes');
      } else if (k === 'wait' || k === 'unwait') {
        ok = await this._planRpc('plan_waitlist', { p_activity: d.a.id, p_on: k === 'wait' },
          k === 'wait' ? 'Listo · te avisamos si se libera un cupo' : 'Ya no estás en la lista de espera');
      }
      if (ok) this._pdClose(d); else b.disabled = false;
    });
  }

  _pdClose(d) {
    d.root.classList.remove('in');
    setTimeout(() => d.root.remove(), 320);
  }
}
