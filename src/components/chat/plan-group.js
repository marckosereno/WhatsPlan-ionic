// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/plan-group.js
// Menú del grupo del plan: al tocar las caras de arriba en el chat se abre
// una tarjeta bajo el encabezado (como el menú de Discover) con los que
// van en avatares — quien organiza primero— y un ⋯ con las opciones del
// chat (Silenciar / Ver el plan). Tocar a alguien abre su mini perfil.
// Estilos: /styles/chat.css (.wp-gm-*)
// ════════════════════════════════════════════════════════════════════
import { wave } from '/src/components/place-plans/wave.js';
import { face } from '/src/components/chat/chat-render.js';
import { headItems } from '/src/components/chat/chat-actions.js';

const CHEV = '<span class="wp-gm-more" data-more aria-label="Opciones del chat"><svg width="13" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg></span>';

export function openPlanMenu(ctx, anchor) {
  const { pm, a, page } = ctx, me = window.wpApp?.currentUser?.id, root = page.root;
  if (root.querySelector('.wp-gm-pop')) return;
  const ids = [...new Set([a.creator_id, ...(a.participants || [])])].filter(Boolean);
  const max = a.max_participants || 0, n = ids.length;
  const row = (id) => {
    const name = id === me ? 'Tú' : pm._phName(id, false) || 'Alguien', org = id === a.creator_id;
    return `<button type="button" class="wp-gm-row" data-uid="${pm._esc(id)}"${id === me ? ' data-me' : ''}>
      <span class="wp-gm-f">${face(pm, id, 'wp-gm-face')}</span><b>${pm._esc(name)}</b><em${org ? ' class="org"' : ''}>${org ? 'Organiza' : 'Va'}</em></button>`;
  };
  const pop = document.createElement('div');
  pop.className = 'wp-gm-pop';
  pop.innerHTML = `<div class="wp-gm-scrim" data-x></div><div class="wp-gm" role="menu">
    <div class="wp-gm-h"><span><b>Los que van</b><small>${max ? `${n} de ${max}` : n} · ${pm._esc(a.title || 'Plan')}</small></span>
      ${CHEV}</div>
    <div class="wp-gm-list">${ids.map(row).join('')}</div></div>`;
  root.appendChild(pop);
  const rr = root.getBoundingClientRect(), ar = anchor.getBoundingClientRect(), card = pop.querySelector('.wp-gm');
  card.style.top = `${ar.bottom - rr.top + 8}px`;
  pm._haptic?.('light');
  requestAnimationFrame(() => { pop.classList.add('go'); wave(card, '.wp-gm-row', { max: 6 }); });
  const close = () => { pop.classList.remove('go'); setTimeout(() => pop.remove(), 180); };
  // Opciones: segundo menú, como el desplegable de Discover, bajo las flechitas
  const items = headItems(ctx); let opts = null;
  const closeOpts = () => { if (!opts) return; const o = opts; opts = null; o.classList.remove('go'); setTimeout(() => o.remove(), 160); };
  const toggleOpts = () => {
    if (opts) { closeOpts(); return; }
    opts = document.createElement('div');
    opts.className = 'wp-gm wp-gm-opt'; opts.setAttribute('role', 'menu');
    opts.innerHTML = items.map((it, i) => `<button type="button" role="menuitem" data-opt="${i}">${pm._esc(it.label)}</button>`).join('');
    pop.appendChild(opts);
    const pr = pop.getBoundingClientRect(), mr = pop.querySelector('[data-more]').getBoundingClientRect();
    opts.style.top = `${mr.bottom - pr.top + 8}px`; opts.style.right = '20px';
    requestAnimationFrame(() => opts && opts.classList.add('go'));
    wave(opts, 'button', { max: 3 });
  };
  pop.addEventListener('click', (e) => {
    if (e.target.closest('[data-x]')) { close(); return; }
    if (e.target.closest('[data-more]')) { toggleOpts(); return; }
    const op = e.target.closest('[data-opt]');
    if (op) { const it = items[+op.dataset.opt]; close(); setTimeout(() => it.onClick(), 120); return; }
    if (opts) closeOpts();
    const b = e.target.closest('[data-uid]'); if (!b || b.hasAttribute('data-me')) return;
    const p = pm._profCache?.get(b.dataset.uid);
    close(); setTimeout(() => pm._openMiniProfile?.(b.dataset.uid, 'saved', p?.name || '', p?.avatar_url || ''), 120);
  });
}
