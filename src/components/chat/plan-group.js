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

export const CHEV = '<span class="wp-gm-more" data-more aria-label="Opciones del chat"><svg width="13" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg></span>';

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
      </div>
    <div class="wp-gm-list">${ids.map(row).join('')}</div></div>`;
  root.appendChild(pop);
  const rr = root.getBoundingClientRect(), ar = anchor.getBoundingClientRect(), card = pop.querySelector('.wp-gm');
  card.style.top = `${ar.bottom - rr.top + 8}px`;
  pm._haptic?.('light');
  requestAnimationFrame(() => { pop.classList.add('go'); wave(card, '.wp-gm-row', { max: 6 }); });
  const close = () => { pop.classList.remove('go'); setTimeout(() => pop.remove(), 180); };
  pop.addEventListener('click', (e) => {
    if (e.target.closest('[data-x]')) { close(); return; }

    const b = e.target.closest('[data-uid]'); if (!b || b.hasAttribute('data-me')) return;
    const p = pm._profCache?.get(b.dataset.uid);
    close(); setTimeout(() => pm._openMiniProfile?.(b.dataset.uid, 'saved', p?.name || '', p?.avatar_url || ''), 120);
  });
}

// Opciones del chat: desplegable bajo el nombre del plan (las flechitas), sin velo
export function openChatOpts(ctx, anchor) {
  const { pm, page } = ctx, root = page.root;
  if (root.querySelector('.wp-gm-pop.opts')) return;
  const items = headItems(ctx);
  const pop = document.createElement('div');
  pop.className = 'wp-gm-pop opts';
  pop.innerHTML = `<div class="wp-gm-scrim" data-x></div><div class="wp-gm wp-gm-opt" role="menu">${items.map((it, i) => `<button type="button" role="menuitem" data-opt="${i}">${pm._esc(it.label)}</button>`).join('')}</div>`;
  root.appendChild(pop);
  const rr = root.getBoundingClientRect(), ar = anchor.getBoundingClientRect(), card = pop.querySelector('.wp-gm');
  card.style.top = `${ar.bottom - rr.top + 8}px`;
  card.style.left = `${Math.max(12, Math.min(rr.width - 202, ar.left - rr.left + ar.width / 2 - 95))}px`; card.style.right = 'auto';
  pm._haptic?.('light');
  requestAnimationFrame(() => { pop.classList.add('go'); wave(card, 'button', { max: 3 }); });
  const close = () => { pop.classList.remove('go'); setTimeout(() => pop.remove(), 180); };
  pop.addEventListener('click', (e) => {
    const op = e.target.closest('[data-opt]');
    close();
    if (op) setTimeout(() => items[+op.dataset.opt].onClick(), 120);
  });
}
