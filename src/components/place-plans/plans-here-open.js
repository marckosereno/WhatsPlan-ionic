// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here-open.js
// Un plan abierto dentro de la lista de "Planes aquí" (plans-here.js):
// acordeón, uno a la vez. Al abrir, la tarjeta crece con un resorte
// suave y muestra: tres datos en fila (dura · cupos con barra · quién
// puede), quién va (caras con nombre), reglas, nota, la ruta corta y
// el botón del caso:
//   de otros → Unirme / Avísame · te invitaron → Aceptar + No puedo ·
//   tuyo o vas → "Abrir tu plan" (lleva a "Tu plan" / "Vas a ir").
// Si la tarjeta abierta queda tapada, la hoja se desliza para mostrarla.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph2-*)
// ════════════════════════════════════════════════════════════════════
const VIS = { public: '🌎 Todos', followers: '🫶 Seguidores', invited: '🔒 Invitados' };
const BELL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const OPEN = { duration: 420, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' };

export class PlansHereOpen {
  _phToggle(v, i) {
    const was = v.open;
    if (was >= 0) this._phCollapse(v, was);
    if (was === i) return;
    v.open = i;
    const it = v.sheet.body.querySelector(`.wp-ph2-it[data-open="${i}"]`), more = it.querySelector('.wp-ph2-more');
    more.innerHTML = this._phMore(v, v.list[i]);
    more.hidden = false;
    it.classList.add('open');
    it.querySelector('.wp-ph2-head').setAttribute('aria-expanded', 'true');
    const h = more.scrollHeight;
    more.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], OPEN);
    this._haptic?.('light');
    setTimeout(() => this._phReveal(v, it), 120);
  }

  _phCollapse(v, i) {
    v.open = -1;
    const it = v.sheet.body.querySelector(`.wp-ph2-it[data-open="${i}"]`); if (!it) return;
    const more = it.querySelector('.wp-ph2-more'), h = more.offsetHeight;
    it.classList.remove('open');
    it.querySelector('.wp-ph2-head').setAttribute('aria-expanded', 'false');
    more.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { ...OPEN, duration: 260 }).onfinish = () => {
      if (!it.classList.contains('open')) { more.hidden = true; more.innerHTML = ''; }
    };
  }

  // Que la tarjeta abierta se vea completa (sin taparse con el pie)
  _phReveal(v, it) {
    const vp = v.sheet.root.querySelector('.wp-st-vp'), r = it.getBoundingClientRect(), box = vp.getBoundingClientRect();
    const foot = v.sheet.foot.hidden ? 24 : v.sheet.foot.offsetHeight, top = box.top + 70;
    const over = r.bottom - (box.bottom - foot);
    if (over > 0) vp.scrollBy({ top: Math.min(over + 12, r.top - top), behavior: 'smooth' });
  }

  _phMore(v, a) {
    const P = a.participants || [], max = a.max_participants || 0;
    const dur = a.ends_at ? this._pwDurTxt(Math.round((new Date(a.ends_at) - new Date(a.scheduled_at)) / 60000)) : '—';
    const bar = max ? `<i class="wp-ph2-bar"><i style="width:${Math.min(100, Math.round(P.length / max * 100))}%"></i></i>` : '';
    const ppl = P.map(id => `<span class="wp-ph2-pp">${this._planFace(id)}<b>${id === v.me ? 'Tú' : this._phName(id)}</b></span>`).join('');
    return `<div class="wp-ph2-in">
        <div class="wp-ph2-stats">
          <span><small>Dura</small><b>${dur}</b></span>
          <span><small>Cupos</small><b>${this._planFull(a) ? 'Completo' : max ? `${P.length} de ${max}` : P.length}</b>${bar}</span>
          <span><small>Quién puede</small><b>${VIS[a.visibility] || VIS.public}</b></span>
        </div>
        ${ppl ? `<div class="wp-ph2-ppl">${ppl}</div>` : ''}
        ${this._planRulesHtml(a, 'sm')}
        ${a.note ? `<p class="wp-ph2-note">“${this._esc(a.note)}”</p>` : ''}
        ${this._planRouteHtml(a, { compact: true })}
        <div class="wp-ph2-acts">${this._phActs(v, a)}</div>
      </div>`;
  }

  _phActs(v, a) {
    const k = this._phKind(v, a), full = this._planFull(a), waiting = (a.waitlist || []).includes(v.me);
    if (k === 'own' || k === 'go') return `<button type="button" class="wp-ph2-btn soft" data-act="mine"><span>Abrir tu plan</span>${ARROW}</button>`;
    const no = k === 'inv' ? '<button type="button" class="wp-ph2-btn ghost" data-act="no">No puedo</button>' : '';
    if (!full) return `${no}<button type="button" class="wp-ph2-btn" data-act="yes">${k === 'inv' ? 'Aceptar' : 'Unirme'}</button>`;
    return `${no}${waiting ? '<button type="button" class="wp-ph2-btn soft on" data-act="wl-off">Te avisaremos si se libera un cupo</button>'
      : `<button type="button" class="wp-ph2-btn soft" data-act="wl-on">${BELL}<span>Avísame si se libera un cupo</span></button>`}`;
  }

  async _phDo(v, b) {
    const act = b.dataset.act;
    if (act === 'new') { v.sheet.close(); setTimeout(() => this._openPlanSheet(), 140); return; }
    const a = v.list[+b.closest('[data-open]')?.dataset.open]; if (!a) return;
    if (act === 'mine') { v.sheet.close(); setTimeout(() => this._openMyPlanSheet(a), 360); return; }
    b.disabled = true;
    if (act === 'yes' || act === 'no') {
      const yes = act === 'yes';
      if (await this._planRpc('respond_plan', { p_activity: a.id, p_accept: yes }, yes ? `¡Vas! ${this._planWhen(a.scheduled_at)}` : 'Le avisamos que no puedes')) { v.sheet.close(); return; }
    } else {
      const on = act === 'wl-on';
      if (await this._planRpc('plan_waitlist', { p_activity: a.id, p_on: on }, on ? 'Listo · te avisamos si se libera un cupo' : 'Ya no estás en la lista de espera')) {
        a.waitlist = on ? [...(a.waitlist || []), v.me] : (a.waitlist || []).filter(id => id !== v.me);
        b.closest('.wp-ph2-acts').innerHTML = this._phActs(v, a);
        return;
      }
    }
    b.disabled = false;
  }
}
