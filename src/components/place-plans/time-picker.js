// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/time-picker.js
// "Hora a tu gusto": al tocar la hora grande sale una tarjeta en zoom
// (focus-zoom.js) con la hora en grande, las 12 horas, los minutos
// (00 · 15 · 30 · 45) y am / pm. Cada toque late y cambia la vista
// previa al instante; "Listo" la aplica.
//
// Uso: openTimePicker({ from: el, mins: 19 * 60 + 30, onPick: (mins) => {}, haptic })
//      mins = minutos desde la medianoche (0 … 1439)
// Estilos: /styles/plan-steps.css (.wp-tp-*)
// ════════════════════════════════════════════════════════════════════
import { openZoom } from '/src/components/place-plans/focus-zoom.js';
import { pulse } from '/src/components/place-plans/pulse.js';

const MINS = [0, 15, 30, 45];

export function openTimePicker({ from, mins, label = 'Hora a tu gusto', onPick, haptic = () => {} }) {
  const s = split(mins);
  const box = document.createElement('div');
  box.className = 'wp-tp';
  box.innerHTML = `
    <div class="wp-tp-big"><b></b><small></small></div>
    <div class="wp-tp-h">${Array.from({ length: 12 }, (_, k) => `<button type="button" data-h="${k + 1}">${k + 1}</button>`).join('')}</div>
    <div class="wp-tp-row">
      <div class="wp-tp-m">${MINS.map(m => `<button type="button" data-m="${m}">:${String(m).padStart(2, '0')}</button>`).join('')}</div>
      <div class="wp-tp-ap"><button type="button" data-ap="am">am</button><button type="button" data-ap="pm">pm</button></div>
    </div>`;
  const big = box.querySelector('.wp-tp-big');
  const paint = () => {
    const txt = `${s.h}:${String(s.m).padStart(2, '0')}`;
    if (big.querySelector('b').textContent !== txt) pulse(big, 'wp-tp-tick');
    big.querySelector('b').textContent = txt;
    big.querySelector('small').textContent = s.pm ? 'pm' : 'am';
    box.querySelectorAll('[data-h]').forEach(b => b.classList.toggle('on', +b.dataset.h === s.h));
    box.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', +b.dataset.m === s.m));
    box.querySelectorAll('[data-ap]').forEach(b => b.classList.toggle('on', (b.dataset.ap === 'pm') === s.pm));
  };
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.h) s.h = +b.dataset.h;
    else if (b.dataset.m) s.m = +b.dataset.m;
    else if (b.dataset.ap) s.pm = b.dataset.ap === 'pm';
    haptic('light');
    paint();
  });
  paint();
  openZoom({ from: from?.getBoundingClientRect(), label, content: box, onClose: () => onPick?.(join(s)) });
}

// minutos ↔ { h: 1…12, m, pm }
function split(mins) {
  const H = Math.floor(mins / 60) % 24;
  const m = MINS.reduce((a, x) => (Math.abs(x - (mins % 60)) < Math.abs(a - (mins % 60)) ? x : a), 0);
  return { h: H % 12 || 12, m, pm: H >= 12 };
}
function join({ h, m, pm }) { return ((h % 12) + (pm ? 12 : 0)) * 60 + m; }
