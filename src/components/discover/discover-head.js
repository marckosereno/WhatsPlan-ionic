// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — discover/discover-head.js
// El título de Discover con su flechita: al tocarlo salen los chips
// (Todo · Planes · Personas · Lugares) como badges chiquitos, ahí mismo
// bajo el título, con la entrada en ola. Se cierran al elegir uno o al
// tocar fuera. Si hay un filtro puesto, el título lo muestra con un
// puntito de su color.
//   FILTERS · titleHtml(filter) · wireHead(d) → { toggle, close }
// d = la instancia de Discover (discover.js)
import { wave } from '/src/components/place-plans/wave.js';
// ════════════════════════════════════════════════════════════════════
export const FILTERS = [['all', 'Todo', '#5b6270', '#8d93a0'], ['plans', 'Planes', '#5b63d6', '#8f95ea'], ['people', 'Personas', '#d9668f', '#ec97b4'], ['places', 'Lugares', '#5fa67a', '#8fcaa2']];
const CHEV = '<svg class="wp-dc-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

export const titleHtml = (f = 'all') => {
  const hit = FILTERS.find(x => x[0] === f), on = f !== 'all';
  return `<button type="button" class="wp-dc-ttl" data-ttl aria-haspopup="true" aria-expanded="false">${on ? `<i class="wp-dc-dot" style="--cl:${hit[3]};--cb:${hit[2]}"></i>${hit[1]}` : 'Discover'}${CHEV}</button>`;
};
export const chipsHtml = (cur) => FILTERS.map(([k, t, b, l]) => `<button type="button" data-f="${k}" style="--cb:${b};--cl:${l}"${k === cur ? ' class="on"' : ''}>${t}</button>`).join('');

export function wireHead(d) {
  const root = d.page.root;
  let pop = null, closing = 0;

  function close() {
    if (!pop) return;
    const el = pop; pop = null;
    root.querySelector('[data-ttl]')?.setAttribute('aria-expanded', 'false');
    root.querySelector('.wp-dc-ttl')?.classList.remove('open');
    el.classList.remove('go');
    clearTimeout(closing); closing = setTimeout(() => el.remove(), 260);
  }
  function open() {
    if (pop) return close();
    const t = root.querySelector('.wp-dc-ttl'); if (!t) return;
    t.classList.add('open'); t.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div');
    pop.className = 'wp-dc-pop';
    pop.innerHTML = `<div class="wp-dc-scrim" data-pop-x></div><div class="wp-dc-pbadges">${chipsHtml(d.filter)}</div>`;
    root.appendChild(pop);
    const rr = root.getBoundingClientRect(), tr = t.getBoundingClientRect();
    pop.querySelector('.wp-dc-pbadges').style.top = `${tr.bottom - rr.top + 4}px`;
    d.getPM()?._haptic?.('light');
    requestAnimationFrame(() => { pop?.classList.add('go'); wave(pop.querySelector('.wp-dc-pbadges'), 'button', { max: 4 }); });
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-ttl]')) { open(); return; }
    if (pop && e.target.closest('.wp-dc-pop [data-f]')) { d.setFilter(e.target.closest('[data-f]').dataset.f); close(); return; }
    if (pop && e.target.closest('[data-pop-x]')) close();
  });
  return { toggle: open, close, isOpen: () => !!pop };
}
