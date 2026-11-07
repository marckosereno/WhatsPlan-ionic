// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here-days.js
// Calendario de "Planes aquí" (plans-here.js), como una tira de
// tarjetitas: arriba el mes en grande (con el anterior y el siguiente
// tenues a los lados) y abajo los próximos 21 días en tarjetas blancas:
// puntitos arriba (uno por plan, hasta 3), el número grande y el día.
// La elegida sube, crece y lleva una rayita azul. Tocar un día filtra la
// lista; tocarlo otra vez (o "Ver todos") regresa a todos.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph4-cal*)
// ════════════════════════════════════════════════════════════════════
import { addElastic } from '/src/components/place-plans/elastic.js';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MON = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = 21;
const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export class PlansHereDays {
  _phDayKey(a) { return key(new Date(a.scheduled_at)); }

  _phDayLabel(d) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    const n = Math.round((x - t) / 86400000);
    return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `${DOW[x.getDay()]} ${x.getDate()} ${MON[x.getMonth()].slice(0, 3).toLowerCase()}`;
  }

  _phMountDays(v, box) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const count = (k) => v.list.filter(a => this._phDayKey(a) === k).length;
    const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(t); d.setDate(t.getDate() + i); return d; });
    box.innerHTML = `
      <div class="wp-ph4-cal-h"><span class="side">${MON[(t.getMonth() + 11) % 12]}</span>
        <b class="wp-ph4-mon"></b><span class="side">${MON[(t.getMonth() + 1) % 12]}</span></div>
      <div class="wp-ph4-strip">${days.map((d, i) => {
        const n = count(key(d));
        return `<button type="button" class="wp-ph4-d${n ? ' has' : ''}" data-day="${key(d)}" data-m="${d.getMonth()}" data-y="${d.getFullYear()}">
          <span class="dots">${'<i></i>'.repeat(Math.min(3, n))}</span><b>${String(d.getDate()).padStart(2, '0')}</b><small>${i === 0 ? 'Hoy' : DOW[d.getDay()]}</small><em></em></button>`;
      }).join('')}</div>
      <button type="button" class="wp-ph4-all" data-day="all" hidden>Ver todos los planes</button>`;
    addElastic(box.querySelector('.wp-ph4-strip'), 'x');
    this._phPaintMonth(v, box, t);
  }

  _phPaintMonth(v, box, d) {
    box.querySelector('.wp-ph4-mon').innerHTML = `${MON[d.getMonth()]} <small>${d.getFullYear()}</small>`;
  }

  _phPickDay(v, k) {
    v.day = k === v.day || k === 'all' ? 'all' : k;
    const box = v.sheet.body.querySelector('.wp-ph4-cal');
    let picked = null;
    box.querySelectorAll('.wp-ph4-d').forEach(b => { const on = b.dataset.day === v.day; b.classList.toggle('on', on); if (on) picked = b; });
    box.querySelector('.wp-ph4-all').hidden = v.day === 'all';
    this._phPaintMonth(v, box, picked ? new Date(+picked.dataset.y, +picked.dataset.m, 1) : new Date());
    const strip = box.querySelector('.wp-ph4-strip');   // centrar el día elegido (solo de lado)
    if (picked) strip.scrollTo({ left: picked.offsetLeft - (strip.clientWidth - picked.offsetWidth) / 2, behavior: 'smooth' });
    this._haptic?.('light');
    this._phPaintList(v, true);
  }

  // Planes a mostrar, agrupados por día y en orden de hora
  _phGroups(v) {
    const groups = new Map();
    v.list.forEach((a, i) => {
      const k = this._phDayKey(a);
      if (v.day !== 'all' && k !== v.day) return;
      if (!groups.has(k)) groups.set(k, { at: a.scheduled_at, items: [] });
      groups.get(k).items.push([a, i]);
    });
    return [...groups.values()];
  }
}
