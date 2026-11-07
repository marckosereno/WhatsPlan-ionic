// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — components/profile/saved-plans.js
// Sección "Planes guardados" del perfil (solo en tu propio perfil): los
// planes que guardaste desde "Planes aquí" para ir después. Usa el mismo
// racimo de tarjetitas y la misma lista que "Actividades" del perfil
// (ProfileSheet._actCard / _viewActivities).
//
// Uso (ProfileSheet): fillSavedPlans(sheet, view)
// Datos: place-plans/plan-saves.js (tabla plan_saves, 27_plan_saves.sql)
// Estilos: los de Actividades del perfil (.wp-pf-act-*)
// ════════════════════════════════════════════════════════════════════
import { mySavedPlans } from '/src/components/place-plans/plan-saves.js';

export async function fillSavedPlans(sheet, view) {
  const box = view.querySelector('.wp-pf-saved');
  if (!box) return;
  let plans = [];
  try { plans = await mySavedPlans(); } catch (e) { console.warn('[PF] Guardados:', e.message || e); }
  if (!view.isConnected) return;
  const all = view.querySelector('.wp-pf-saved-all');
  if (!plans.length) {
    box.innerHTML = '<p class="wp-pf-empty">Guarda planes desde "Planes aquí" para ir después.</p>';
    return;
  }
  all.textContent = 'Ver todo';
  all.classList.add('wp-pf-link');
  all.onclick = () => sheet._push(v => sheet._viewActivities(v, plans));
  const first = plans[0];
  box.innerHTML = `
    <button type="button" class="wp-pf-act-cluster">
      <div class="wp-pf-act-stack">${plans.slice(0, 3).map((a, i) => sheet._actCard(a, i)).join('')}</div>
      <div class="wp-pf-act-txt"><b>${plans.length} ${plans.length === 1 ? 'guardado' : 'guardados'}</b><span></span></div>
    </button>`;
  box.querySelector('.wp-pf-act-txt span').textContent = `${first.title || first.place_name || 'Plan'} · ${sheet._when(first.scheduled_at)}`;
  const btn = box.querySelector('.wp-pf-act-cluster');
  btn.onclick = () => { sheet._pulse(btn); sheet._push(v => sheet._viewActivities(v, plans)); };
}
