// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — discover/discover-cal.js
// Minicalendario de Discover: una tira chiquita con los próximos 14 días
// (día, número y hasta 3 puntitos por los planes de ese día). Tocar un
// día filtra la tira de planes de abajo; tocarlo otra vez lo quita.
// calStrip(plans, sel) → HTML · dayKey(iso) → "2026-11-12"
// ════════════════════════════════════════════════════════════════════
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MON = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const DAYS = 14;
export const dayKey = (x) => { const d = new Date(x); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export function calStrip(plans, sel) {
  const per = {}; (plans || []).forEach(a => { const k = dayKey(a.scheduled_at); per[k] = (per[k] || 0) + 1; });
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const cells = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(t); d.setDate(t.getDate() + i);
    const k = dayKey(d), n = per[k] || 0;
    cells.push(`<button type="button" class="wp-dc-day${k === sel ? ' on' : ''}${n ? ' has' : ''}" data-day="${k}" aria-label="${DOW[d.getDay()]} ${d.getDate()}">
      <small>${i === 0 ? 'Hoy' : DOW[d.getDay()]}</small><b>${d.getDate()}</b>
      <i>${'<u></u>'.repeat(Math.min(3, n))}</i></button>`);
  }
  return `<div class="wp-dc-cal"><span class="wp-dc-month">${MON[t.getMonth()]} ${t.getFullYear()}</span>
    <div class="wp-dc-strip wp-dc-days"><div class="wp-dc-track">${cells.join('')}</div></div></div>`;
}
