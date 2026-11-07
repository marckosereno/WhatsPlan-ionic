// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plans-here-days.js
// Calendario de "Planes aquí" (plans-here.js): una tarjeta con las
// próximas 2 semanas en cuadrícula (D L M M J V S). Hoy con aro; los días
// con planes llevan un puntito por plan (hasta 3); los que ya pasaron se
// ven tenues. Tocar un día lo elige (círculo azul) y la lista muestra
// solo ese día; tocarlo otra vez (o "Ver todos") regresa a todos.
//
// Mixin de PlaceModal2. Estilos: /styles/plans-here.css (.wp-ph3-cal*)
// ════════════════════════════════════════════════════════════════════
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const INI = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export class PlansHereDays {
  _phDayKey(a) { return key(new Date(a.scheduled_at)); }
  _phMonth(d) { return MON[new Date(d).getMonth()]; }
  _phDow(d) { return DOW[new Date(d).getDay()]; }

  _phDayLabel(d) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    const n = Math.round((x - t) / 86400000);
    return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : DOW[x.getDay()];
  }

  // Dos semanas desde el domingo de esta semana
  _phMountDays(v, box) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const start = new Date(t); start.setDate(t.getDate() - t.getDay());
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    const count = (k) => v.list.filter(a => this._phDayKey(a) === k).length;
    const m0 = MON[days[0].getMonth()], m1 = MON[days[13].getMonth()];
    box.innerHTML = `
      <div class="wp-ph3-cal-h"><b>Próximas 2 semanas</b><span>${m0 === m1 ? m0 : `${m0} – ${m1}`}</span>
        <button type="button" class="wp-ph3-all" data-day="all" hidden>Ver todos</button></div>
      <div class="wp-ph3-cal-g">${INI.map(x => `<small>${x}</small>`).join('')}
        ${days.map(d => {
          const n = count(key(d)), past = d < t, today = +d === +t;
          return `<button type="button" class="wp-ph3-d${today ? ' today' : ''}${past ? ' past' : ''}${n ? ' has' : ''}" data-day="${key(d)}"${past && !n ? ' disabled' : ''}>
            <b>${d.getDate()}</b><span>${'<i></i>'.repeat(Math.min(3, n))}</span></button>`;
        }).join('')}</div>`;
  }

  _phPickDay(v, k) {
    v.day = k === v.day || k === 'all' ? 'all' : k;
    v.sheet.body.querySelectorAll('.wp-ph3-d').forEach(b => b.classList.toggle('on', b.dataset.day === v.day));
    v.sheet.body.querySelector('.wp-ph3-all').hidden = v.day === 'all';
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
