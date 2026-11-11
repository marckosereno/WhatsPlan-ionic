// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/plan-group.js
// Menú del grupo del plan: al tocar las caras de arriba en el chat se abre
// una tarjeta bajo el encabezado (como el menú de Discover) con los que
// van en avatares — quien organiza primero— y un ⋯ con las opciones del
// chat (Silenciar / Ver el plan). Tocar a alguien abre su mini perfil.
// Estilos: /styles/chat.css (.wp-gm-*)
// ════════════════════════════════════════════════════════════════════
import { wave } from '/src/components/place-plans/wave.js';

const MORE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/></svg>';

export function openPlanMenu(ctx, anchor, headMenu) {
  const { pm, a, page } = ctx, me = window.wpApp?.currentUser?.id, root = page.root;
  if (root.querySelector('.wp-gm-pop')) return;
  const ids = [...new Set([a.creator_id, ...(a.participants || [])])].filter(Boolean);
  const max = a.max_participants || 0, n = ids.length;
  const row = (id) => {
    const name = id === me ? 'Tú' : pm._phName(id, false) || 'Alguien', org = id === a.creator_id;
    return `<button type="button" class="wp-gm-row" data-uid="${pm._esc(id)}"${id === me ? ' data-me' : ''}>
      <span class="wp-gm-f">${pm._planFace(id)}</span><b>${pm._esc(name)}</b><em${org ? ' class="org"' : ''}>${org ? 'Organiza' : 'Va'}</em></button>`;
  };
  const pop = document.createElement('div');
  pop.className = 'wp-gm-pop';
  pop.innerHTML = `<div class="wp-gm-scrim" data-x></div><div class="wp-gm" role="menu">
    <div class="wp-gm-h"><span><b>Los que van</b><small>${max ? `${n} de ${max}` : n} · ${pm._esc(a.title || 'Plan')}</small></span>
      <button type="button" class="wp-gm-more" data-more aria-label="Opciones del chat">${MORE}</button></div>
    <div class="wp-gm-list">${ids.map(row).join('')}</div></div>`;
  root.appendChild(pop);
  const rr = root.getBoundingClientRect(), ar = anchor.getBoundingClientRect(), card = pop.querySelector('.wp-gm');
  card.style.top = `${ar.bottom - rr.top + 8}px`;
  pm._haptic?.('light');
  requestAnimationFrame(() => { pop.classList.add('go'); wave(card, '.wp-gm-row', { max: 6 }); });
  const close = () => { pop.classList.remove('go'); setTimeout(() => pop.remove(), 180); };
  pop.addEventListener('click', (e) => {
    if (e.target.closest('[data-x]')) { close(); return; }
    if (e.target.closest('[data-more]')) { headMenu(ctx, e.target.closest('[data-more]')); return; }
    const b = e.target.closest('[data-uid]'); if (!b || b.hasAttribute('data-me')) return;
    const p = pm._profCache?.get(b.dataset.uid);
    close(); setTimeout(() => pm._openMiniProfile?.(b.dataset.uid, 'saved', p?.name || '', p?.avatar_url || ''), 120);
  });
}
