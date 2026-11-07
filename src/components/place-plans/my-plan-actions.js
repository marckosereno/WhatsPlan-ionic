// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/my-plan-actions.js
// Lo que hacen los botones de "Tu plan" (my-plan.js). Todo lo que se
// edita abre una tarjeta en zoom con lo de atrás borroso:
//  · Hora → hora a tu gusto (time-picker.js), conserva la duración
//  · Dura → chips 1 h · 2 h · 3 h · 5 h · Todo el día
//  · Cupos → número grande con − / +, y "Cerrar el plan con los que van"
//  · Nombre (lápiz junto al título) → campo con sugerencia según los lugares
//  · Invitar → buscador de a quién sigues (people-picker.js)
//  · Cancelar / Ya no puedo ir → segundo toque para confirmar
// Al guardar se cierra la hoja (los datos se recargan solos).
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (.wp-mp-z-*)
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { getAvatarUrl } from '/src/services/AvatarService.js';
import { openZoom } from '/src/components/place-plans/focus-zoom.js';
import { openTimePicker } from '/src/components/place-plans/time-picker.js';
import { openPeoplePicker } from '/src/components/place-plans/people-picker.js';
import { pulse } from '/src/components/place-plans/pulse.js';
import { DURS } from '/src/components/place-plans/plan-when.js';

export class MyPlanActions {
  _mpClick(ctx, e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const { a, close } = ctx, act = b.dataset.a;
    if (b.dataset.rm) { this._mpRemoveStop(ctx, b); return; }
    if (act === 'share') this._planShare(a);
    else if (act === 'route') { close(); setTimeout(() => this._planShowRoute(a), 200); }
    else if (act === 'others') { close(); setTimeout(() => this._openPlansHereSheet(), 360); }
    else if (act === 'addstop') { close(); setTimeout(() => this._openStopFlow(a), 140); }
    else if (act === 'time') this._mpTime(ctx, b);
    else if (act === 'dur') this._mpDur(ctx, b);
    else if (act === 'cupo') this._mpCupo(ctx, b);
    else if (act === 'invite') this._mpInvite(ctx, b);
    else if (act === 'rename') this._mpRename(ctx, b);
    else if (act === 'pick') this._mpPick(ctx, +b.dataset.i);
    else if (act === 'leg') this._mpLeg(ctx, b);
    else if (act === 'summary') this._mpSummary(ctx, b);
    else if (act === 'more') this._mpMoreInfo(b);
  }

  // "Más info": muestra los renglones escondidos (cupos, quién puede, reglas, nota)
  _mpMoreInfo(b) {
    const rows = b.closest('.wp-mp-rows'), open = !rows.classList.contains('open');
    rows.classList.toggle('open', open);
    b.querySelector('span').textContent = open ? 'Menos info' : 'Más info';
  }

  async _mpSave(ctx, fn, args, msg, opts) {
    if (await this._planRpc(fn, args, msg, opts)) { ctx.close(); return true; }
    return false;
  }

  _mpTime(ctx, b) {
    const t0 = new Date(ctx.a.scheduled_at);
    openTimePicker({
      from: b, mins: t0.getHours() * 60 + t0.getMinutes(), label: '¿A qué hora empieza?', haptic: (k) => this._haptic?.(k),
      onPick: (m) => {
        const at = new Date(t0); at.setHours(0, m, 0, 0);
        if (at.getTime() === t0.getTime()) return;
        if (at < new Date()) { this._showToast('Esa hora ya pasó · elige otra'); return; }
        this._mpSave(ctx, 'reschedule_plan', { p_activity: ctx.a.id, p_at: at.toISOString() }, `Nueva hora · ${this._planWhen(at)} · ya les avisamos`);
      },
    });
  }

  _mpDur(ctx, b) {
    const a = ctx.a, cur = a.ends_at ? Math.round((new Date(a.ends_at) - new Date(a.scheduled_at)) / 60000) : 0;
    let pick = cur;
    const box = document.createElement('div');
    box.className = 'wp-mp-z-durs';
    const paint = () => { box.innerHTML = DURS.map(([m, l]) => `<button type="button" data-m="${m}"${m === pick ? ' class="on"' : ''}>${l}</button>`).join(''); };
    paint();
    box.addEventListener('click', (e) => {
      const c = e.target.closest('[data-m]'); if (!c) return;
      pick = +c.dataset.m; this._haptic?.('light'); paint();
      pulse(box.querySelector(`[data-m="${pick}"]`));
    });
    openZoom({
      from: b.getBoundingClientRect(), label: '¿Cuánto dura?', content: box,
      onClose: () => {
        if (!pick || pick === cur) return;
        this._mpSave(ctx, 'reschedule_plan', { p_activity: a.id, p_at: a.scheduled_at, p_duration: pick }, `Ahora dura ${this._pwDurTxt(pick)} · ya les avisamos`);
      },
    });
  }

  // Nombre del plan: con más lugares puede que ya no se llame igual
  _mpRename(ctx, b) {
    const a = ctx.a, names = ctx.stops.map(s => s.name);
    const tip = names.length > 1 ? (names.length === 2 ? `${names[0]} y ${names[1]}` : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`) : '';
    const box = document.createElement('div');
    box.innerHTML = `<input class="wp-st-in" maxlength="60" autocapitalize="sentences" enterkeyhint="done" value="${this._esc(a.title)}">
      ${tip && tip.length <= 60 && tip !== a.title ? `<p class="wp-mp-z-sub" style="margin:14px 0 8px;text-align:center">Sugerencia</p><div class="wp-st-chips wrap"><button type="button" class="wp-mp-z-tip" data-tip>${this._esc(tip)}</button></div>` : ''}`;
    const inp = box.querySelector('input');
    box.querySelector('[data-tip]')?.addEventListener('click', () => { inp.value = tip; inp.focus(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    openZoom({
      from: b.closest('.wp-mp-hero-t').getBoundingClientRect(), label: 'Nombre del plan', content: box, field: inp, doneLabel: 'Guardar',
      onClose: () => {
        const t = inp.value.trim().replace(/\s+/g, ' ');
        if (t.length < 3 || t === a.title) return;
        this._mpSave(ctx, 'rename_plan', { p_activity: a.id, p_title: t }, 'Listo · nuevo nombre');
      },
    });
    setTimeout(() => inp.focus(), 60);
  }

  // Cupos: número grande con − / +; "Listo" guarda si cambió
  _mpCupo(ctx, b) {
    const a = ctx.a, going = (a.participants || []).length, max0 = a.max_participants, min = Math.max(1, going);
    let max = max0, done = false;
    const box = document.createElement('div');
    box.className = 'wp-mp-z-cupo';
    box.innerHTML = `<div class="wp-mp-z-num"><button type="button" data-n="-1" aria-label="Un cupo menos">−</button><b></b><button type="button" data-n="1" aria-label="Un cupo más">+</button></div>
      <p class="wp-mp-z-sub"></p>${!this._planFull(a) && going > 1 ? `<button type="button" class="wp-mp-z-close">🔒 Cerrar el plan con los ${going} que van</button>` : ''}`;
    const paint = () => {
      const n = box.querySelector('b'); n.textContent = max; pulse(n, 'tick');
      box.querySelector('[data-n="-1"]').disabled = max <= min;
      box.querySelector('[data-n="1"]').disabled = max >= 50;
      const left = max - going;
      box.querySelector('.wp-mp-z-sub').textContent = left ? `Van ${going} · queda${left === 1 ? '' : 'n'} ${left}` : `Van ${going} · quedará ✓ Completo`;
    };
    box.addEventListener('click', (e) => {
      const c = e.target.closest('[data-n]'); if (!c || c.disabled) return;
      max = Math.max(min, Math.min(50, max + +c.dataset.n)); this._haptic?.('light'); paint();
    });
    const apply = (n) => {
      if (done || n === max0) return;
      done = true;
      const d = n - max0;
      const msg = n <= going ? `Plan cerrado · ${going} de ${going} ✓ Completo` : d > 0 ? `Abriste ${d} cupo${d === 1 ? '' : 's'}` : `Quitaste ${-d} cupo${d === -1 ? '' : 's'}`;
      this._mpSave(ctx, 'set_plan_cupo', { p_activity: a.id, p_max: n }, msg);
    };
    const z = openZoom({ from: b.getBoundingClientRect(), label: 'Cupos', content: box, doneLabel: 'Guardar', onClose: () => apply(max) });
    box.querySelector('.wp-mp-z-close')?.addEventListener('click', () => { apply(going); z.close(); });
    paint();
  }

  // Invitar: buscador en zoom; al tocar "Invitar" se mandan
  async _mpInvite(ctx, b) {
    const a = ctx.a, already = new Set([...(a.participants || []), ...(a.invited || [])]);
    let people = [];
    try {
      const sb = getSupabase();
      const { data: fl } = await sb.from('follows').select('following_id').eq('follower_id', ctx.me).limit(200);
      const ids = (fl || []).map(r => r.following_id).filter(id => !already.has(id));
      if (ids.length) people = (await sb.from('profiles').select('id, name, username, avatar_url').in('id', ids)).data || [];
      people.forEach(p => this._profCache?.set(p.id, p));
    } catch (_) { this._showToast('No se pudo cargar a quién sigues'); return; }
    if (!people.length) { this._showToast('Ya invitaste a todos los que sigues'); return; }
    const sel = new Set();
    openPeoplePicker({
      from: b, people, label: 'Invitar al plan', doneLabel: 'Invitar', haptic: (k) => this._haptic?.(k),
      face: (p) => this._esc(p?.avatar_url || getAvatarUrl(p?.name || p?.username || 'user')), esc: (t) => this._esc(t),
      isOn: (id) => sel.has(id), onToggle: (id) => { sel.has(id) ? sel.delete(id) : sel.add(id); },
      onClose: () => { if (sel.size) this._mpSendInvites(ctx, [...sel], false); },
    });
  }

  _mpSendInvites(ctx, ids, expand) {
    const n = ids.length;
    this._mpSave(ctx, 'invite_to_plan', { p_activity: ctx.a.id, p_invited: ids, p_expand: expand },
      `Invitaste a ${n}${expand ? ' · abriste más cupos' : ''} · ya les avisamos`, {
        onError: (err) => {
          const m = /PLAN_LLENO:(\d+)/.exec(err?.message || '');
          if (!m) return false;
          const k = +m[1];
          setTimeout(() => this._mpAsk(`Tu plan está lleno: ¿abrir ${k} cupo${k === 1 ? '' : 's'} más para invitar a ${n}?`, 'Abrir e invitar',
            () => this._mpSendInvites(ctx, ids, true)), 260);
          return true;
        },
      });
  }

  // Pregunta sí / no en una tarjeta en zoom
  _mpAsk(q, yes, onYes) {
    const box = document.createElement('div');
    box.className = 'wp-mp-z-ask';
    box.innerHTML = `<p>${this._esc(q)}</p><button type="button" class="wp-mp-z-yes">${this._esc(yes)}</button>`;
    const z = openZoom({ content: box, doneLabel: 'Ahora no' });
    box.querySelector('.wp-mp-z-yes').addEventListener('click', () => { z.close(); onYes(); });
  }

  async _mpRemoveStop(ctx, b) {
    const cur = Array.isArray(ctx.a.stops) ? ctx.a.stops : [];
    b.disabled = true;
    const ok = await this._mpSave(ctx, 'set_plan_stops', { p_activity: ctx.a.id, p_stops: cur.filter((_, i) => i !== +b.dataset.rm - 1) }, 'Parada quitada · ya les avisamos');
    if (!ok) b.disabled = false;
  }

  // Cancelar / salirme: segundo toque para confirmar
  _mpDanger(ctx) {
    const d = ctx.root.querySelector('.wp-mp-danger'), label = d.textContent;
    let armed = false, t = 0;
    d.addEventListener('click', async () => {
      if (!armed) {
        armed = true; d.classList.add('armed'); d.textContent = '¿Seguro? Toca otra vez';
        clearTimeout(t); t = setTimeout(() => { armed = false; d.classList.remove('armed'); d.textContent = label; }, 3000);
        this._haptic?.('light');
        return;
      }
      clearTimeout(t);
      if (ctx.owner) this._mpSave(ctx, 'cancel_plan', { p_activity: ctx.a.id }, 'Plan cancelado · ya les avisamos');
      else this._mpSave(ctx, 'respond_plan', { p_activity: ctx.a.id, p_accept: false }, 'Listo, ya no vas');
    });
  }
}
