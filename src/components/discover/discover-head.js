// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — discover/discover-head.js
// El título de Discover con su flechita: al tocarlo salen los chips
// (Todo · Planes · Personas · Lugares) con un pulso que "explota" desde
// la flechita y se abren a los lados con ola. Se cierran al elegir uno o
// al tocar fuera. Si hay un filtro puesto, el título lo muestra con un
// puntito de su color.
//   FILTERS · titleHtml(filter) · wireHead(d) → { toggle, close }
// d = la instancia de Discover (discover.js)
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
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    pop.innerHTML = `<div class="wp-dc-scrim" data-pop-x></div><i class="wp-dc-pulse"></i><div class="wp-dc-pchips">${chipsHtml(d.filter)}</div>`;
    root.appendChild(pop);
    const rr = root.getBoundingClientRect(), tr = t.getBoundingClientRect(), cv = t.querySelector('.wp-dc-chev').getBoundingClientRect();
    const cx = cv.left + cv.width / 2 - rr.left;
    const row = pop.querySelector('.wp-dc-pchips'); row.style.top = `${tr.bottom - rr.top + 10}px`;
    const pulse = pop.querySelector('.wp-dc-pulse'); pulse.style.left = `${cx}px`; pulse.style.top = `${cv.top + cv.height / 2 - rr.top}px`;
    // cada chip nace en la flechita y se abre hacia su lugar (los de afuera tardan un poco más)
    const chips = [...row.children], mid = (chips.length - 1) / 2;
    chips.forEach((c, i) => {
      const b = c.getBoundingClientRect();
      c.style.setProperty('--dx', `${cx - (b.left + b.width / 2 - rr.left)}px`);
      c.style.setProperty('--dl', `${reduce ? 0 : Math.abs(i - mid) * 55 + 60}ms`);
    });
    d.getPM()?._haptic?.('light');
    requestAnimationFrame(() => requestAnimationFrame(() => pop?.classList.add('go')));
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-ttl]')) { open(); return; }
    if (pop && e.target.closest('.wp-dc-pop [data-f]')) { d.setFilter(e.target.closest('[data-f]').dataset.f); close(); return; }
    if (pop && e.target.closest('[data-pop-x]')) close();
  });
  return { toggle: open, close, isOpen: () => !!pop };
}
