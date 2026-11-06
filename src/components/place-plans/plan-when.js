// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-when.js
// Paso 1 de "Planear visita" (¿Cuándo?): tira de días y un reloj
// "inicio → fin" grande. Tocar cualquiera de las dos horas abre la hora
// a tu gusto (time-picker.js). Abajo, chips para empezar (Ahora,
// Desayuno, Comida…) y para cuánto dura (1 h, 2 h, 3 h, 5 h, todo el día).
// La duración va de 30 min a 12 h; si el fin queda antes del inicio es
// al día siguiente (10 pm → 2 am). Al mover el inicio, el fin lo sigue.
//
// Mixin de PlaceModal2 (usa w de plan-wizard.js: day, mins, now, dur)
// Estilos: /styles/plan-steps.css (.wp-st-range, .wp-st-when)
// ════════════════════════════════════════════════════════════════════
import { openTimePicker } from '/src/components/place-plans/time-picker.js';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DUR_MIN = 30, DUR_MAX = 12 * 60;
const STARTS = [[9 * 60, 'Desayuno'], [14 * 60, 'Comida'], [19 * 60, 'Tarde'], [21 * 60, 'Noche']];
export const DURS = [[60, '1 h'], [120, '2 h'], [180, '3 h'], [300, '5 h'], [DUR_MAX, 'Todo el día']];

export class PlanWhen {
  _pwMountWhen(w, el) {
    el.innerHTML = `
      <div class="wp-st-days">${w.days.map((d, i) => `<button type="button" class="wp-st-day" data-day="${i}"><small>${i === 0 ? 'Hoy' : DOW[d.getDay()]}</small><b>${d.getDate()}</b></button>`).join('')}</div>
      <div class="wp-st-range">
        <button type="button" class="wp-st-clock-v" data-clock="start" aria-label="Hora de inicio"><b></b><small></small></button>
        <span class="wp-st-range-to" aria-hidden="true">→</span>
        <button type="button" class="wp-st-clock-v" data-clock="end" aria-label="Hora de fin"><b></b><small></small></button>
      </div>
      <p class="wp-st-clock-sub"></p>
      <div class="wp-st-lbl">Empieza</div>
      <div class="wp-st-chips" data-quick></div>
      <div class="wp-st-lbl">Dura</div>
      <div class="wp-st-chips" data-dur></div>`;
    el.classList.add('wp-st-when');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.clock) { this._pwPickTime(w, el, b); return; }
      if (b.dataset.day) { w.day = +b.dataset.day; w.now = false; }
      else if (b.dataset.t === 'now') w.now = !w.now;
      else if (b.dataset.t) { w.now = false; w.mins = +b.dataset.t; }
      else if (b.dataset.dur) w.dur = +b.dataset.dur;
      this._haptic?.('light');
      this._pwPaintWhen(w, el);
    });
    this._pwPaintWhen(w, el);
  }

  // Tocar una hora → elegirla exacta en la tarjeta en zoom
  _pwPickTime(w, el, b) {
    const start = this._pwAt(w), isEnd = b.dataset.clock === 'end';
    const t = isEnd ? this._pwEnd(w) : start;
    openTimePicker({
      from: b, mins: t.getHours() * 60 + t.getMinutes(), haptic: (k) => this._haptic?.(k),
      label: isEnd ? '¿Hasta qué hora?' : '¿A qué hora empieza?',
      onPick: (m) => {
        if (!isEnd) { w.now = false; w.mins = m; }
        else {
          const want = (m - (start.getHours() * 60 + start.getMinutes()) + 1440) % 1440 || 1440;
          w.dur = this._pwClampDur(want);
          if (want > DUR_MAX) this._showToast?.('Un plan dura máximo 12 horas');
          else if (want < DUR_MIN) this._showToast?.('Un plan dura mínimo 30 minutos');
        }
        this._pwPaintWhen(w, el);
      },
    });
  }

  _pwPaintWhen(w, el) {
    el.querySelectorAll('.wp-st-day').forEach(b => b.classList.toggle('on', +b.dataset.day === w.day));
    this._pwPaintClock(el.querySelector('[data-clock="start"]'), w.now ? ['Ahora', ''] : this._pwSplit(this._pwAt(w)));
    this._pwPaintClock(el.querySelector('[data-clock="end"]'), this._pwSplit(this._pwEnd(w)));
    const sub = el.querySelector('.wp-st-clock-sub'), past = this._pwPast(w);
    sub.textContent = past ? 'Esa hora ya pasó · elige otra' : `${this._pwDayTxt(w)} · ${this._pwDurTxt(w.dur)}`;
    sub.classList.toggle('bad', past);
    el.querySelector('[data-quick]').innerHTML = (w.day === 0 ? `<button type="button" data-t="now"${w.now ? ' class="on"' : ''}>⚡ Ahora</button>` : '')
      + STARTS.map(([m, l]) => `<button type="button" data-t="${m}"${!w.now && w.mins === m ? ' class="on"' : ''}>${l} · ${this._hhmm(new Date(2000, 0, 1, 0, m))}</button>`).join('');
    el.querySelector('[data-dur]').innerHTML = DURS.map(([m, l]) => `<button type="button" data-dur="${m}"${w.dur === m ? ' class="on"' : ''}>${l}</button>`).join('');
    w.screen?.refresh();
  }

  // Una hora del reloj: número grande + am/pm chiquito (late si cambia)
  _pwPaintClock(btn, [main, ap]) {
    const b = btn.querySelector('b');
    if (b.textContent && b.textContent !== main) { b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); }
    b.textContent = main;
    btn.querySelector('small').textContent = ap;
  }

  _pwEnd(w) { return new Date(this._pwAt(w).getTime() + w.dur * 60000); }
  _pwClampDur(m) { return Math.max(DUR_MIN, Math.min(DUR_MAX, Math.round(m))); }
  _pwSplit(d) { const t = this._hhmm(d), k = t.lastIndexOf(' '); return [t.slice(0, k), t.slice(k + 1)]; }
  _pwDayTxt(w) { return w.day === 0 ? 'Hoy' : w.day === 1 ? 'Mañana' : `${DOW[w.days[w.day].getDay()]} ${w.days[w.day].getDate()}`; }
  _pwDurTxt(m) {
    if (m >= DUR_MAX) return 'todo el día (12 h)';
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return `${r} min`;
    return `${h} hora${h > 1 ? 's' : ''}${r ? ` ${r} min` : ''}`;
  }
}
