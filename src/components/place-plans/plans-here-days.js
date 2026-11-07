// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here-days.js
// Mini calendario de "Planes aquí" (plans-here.js): una tira de días
// ("Todos" + los próximos 14) con un puntito por cada plan de ese día;
// con más de 3 sale el número chiquito en lugar de los puntos (un
// badge en cada día sería ruido). Los días sin planes se ven tenues. Tocar un día filtra la
// lista; con "Todos" la lista va agrupada por fecha (Hoy · Mañana ·
// Sáb 8) y dentro de cada día por hora.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph2-days,
// .wp-ph2-day-h) + la tira de días de los pasos (.wp-st-day).
// ════════════════════════════════════════════════════════════════════
import { addElastic } from '/src/components/place-plans/elastic.js';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS = 14;
const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export class PlansHereDays {
  _phDayKey(a) { return key(new Date(a.scheduled_at)); }

  _phDayLabel(d) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    const n = Math.round((x - t) / 86400000);
    return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `${DOW[x.getDay()]} ${x.getDate()}`;
  }

  // La tira se pinta una vez (así conserva su scroll); al elegir un día
  // solo se cambia cuál está encendido
  _phMountDays(v, box) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const count = (k) => v.list.filter(a => this._phDayKey(a) === k).length;
    const days = Array.from({ length: DAYS }, (_, i) => new Date(t.getTime() + i * 86400000));
    box.innerHTML = `<button type="button" class="wp-st-day wp-ph2-all on" data-day="all"><small>Todos</small><b>${v.list.length}</b></button>`
      + days.map((d, i) => {
        const n = count(key(d));
        return `<button type="button" class="wp-st-day${n ? '' : ' empty'}" data-day="${key(d)}"><small>${i === 0 ? 'Hoy' : DOW[d.getDay()]}</small><b>${d.getDate()}</b><span class="wp-ph2-dots">${n > 3 ? `<em>${n}</em>` : '<i></i>'.repeat(n)}</span></button>`;
      }).join('');
    addElastic(box, 'x');
  }

  _phPickDay(v, k) {
    v.day = k;
    v.sheet.body.querySelectorAll('.wp-ph2-days .wp-st-day').forEach(b => b.classList.toggle('on', b.dataset.day === k));
    this._haptic?.('light');
    this._phPaintList(v, true);
  }

  // Planes a mostrar, agrupados por día y en orden de hora
  _phGroups(v) {
    const shown = v.list.map((a, i) => [a, i]).filter(([a]) => v.day === 'all' || this._phDayKey(a) === v.day);
    const groups = new Map();
    shown.forEach(([a, i]) => {
      const k = this._phDayKey(a);
      if (!groups.has(k)) groups.set(k, { label: this._phDayLabel(a.scheduled_at), items: [] });
      groups.get(k).items.push([a, i]);
    });
    return [...groups.values()];
  }
}
