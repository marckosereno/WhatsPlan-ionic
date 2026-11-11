// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/plan-group.js
// "Los que van": la hoja con el grupo del plan, que se abre al tocar las
// caras de arriba en el chat. Quién organiza primero, luego los demás;
// tocar a alguien abre su mini perfil. Estilos: /styles/chat.css (.wp-gp-*)
// ════════════════════════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';

export function openPlanGroup(pm, a) {
  const me = window.wpApp?.currentUser?.id;
  const ids = [...new Set([a.creator_id, ...(a.participants || [])])].filter(Boolean);
  const max = a.max_participants || 0, n = ids.length;
  const row = (id) => {
    const name = id === me ? 'Tú' : pm._phName(id, false), role = id === a.creator_id ? 'Organiza' : 'Va';
    return `<button type="button" class="wp-gp-row" data-uid="${pm._esc(id)}"${id === me ? ' data-me' : ''}>
      <span class="wp-gp-f">${pm._planFace(id)}</span>
      <span class="wp-gp-n"><b>${pm._esc(name)}</b></span><em class="${role === 'Organiza' ? 'org' : ''}">${role}</em></button>`;
  };
  const page = openSheetPage({
    title: `<span class="wp-ch-t"><b>Los que van</b><small>${max ? `${n} de ${max}` : n} · ${pm._esc(a.title || 'Plan')}</small></span>`,
    theme: 'explore',
    html: `<div class="wp-gp-list">${ids.map(row).join('')}</div>`,
  });
  page.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-uid]'); if (!b || b.hasAttribute('data-me')) return;
    const p = pm._profCache?.get(b.dataset.uid);
    pm._openMiniProfile?.(b.dataset.uid, 'saved', p?.name || '', p?.avatar_url || '');
  });
  return page;
}
