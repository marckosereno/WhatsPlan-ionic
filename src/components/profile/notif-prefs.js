// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — profile/notif-prefs.js
// Ajustes > Avisos: qué avisos del celular quiere recibir cada quien.
// Se guarda la lista de categorías APAGADAS (rpc push_prefs_get/set,
// supabase/43_push_prefs.sql); la Edge Function las respeta. Solo afecta
// al push: la campanita sigue mostrando todo.
// Arriba, si el teléfono tiene los avisos apagados, un renglón para activarlos.
// Reusa las clases de Ajustes (.wp-pf-group / .wp-pf-set / .wp-pf-switch).
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { PushService } from '/src/services/PushService.js';

const CATS = [
  { k: 'chat',      t: 'Mensajes del chat',   d: 'Cuando escriben en un plan al que vas' },
  { k: 'mentions',  t: 'Menciones',           d: 'Cuando te mencionan con @' },
  { k: 'joins',     t: 'Gente que se une',    d: 'Cuando alguien se une a tu plan' },
  { k: 'invites',   t: 'Invitaciones',        d: 'Cuando te invitan a un plan' },
  { k: 'changes',   t: 'Cambios del plan',    d: 'Hora, lugar, cancelaciones y cupos' },
  { k: 'reminders', t: 'Recordatorios',       d: 'Una hora antes de tus planes' },
  { k: 'social',    t: 'Seguidores y mensajes', d: 'Nuevos seguidores y solicitudes de mensaje' },
];

export async function viewNotifPrefs(sheet, view) {
  sheet._setHeader({ title: 'Avisos', right: null });
  view.innerHTML = '<div class="wp-pf-list"><p class="wp-pf-empty">Cargando…</p></div>';
  let off = [], ok = true;
  try {
    const { data, error } = await getSupabase().rpc('push_prefs_get');
    if (error) throw error;
    off = data || [];
  } catch (e) { ok = false; console.warn('[PF] avisos:', e?.message || e); }
  if (!sheet._isCurrent(view)) return;
  if (!ok) { view.innerHTML = '<div class="wp-pf-list"><p class="wp-pf-empty">No se pudieron cargar tus avisos. Intenta de nuevo.</p></div>'; return; }

  const status = await PushService.status();   // 'na' en la web
  if (!sheet._isCurrent(view)) return;
  const sysOff = status === 'denied' || status === 'prompt';
  view.innerHTML = `
    ${sysOff ? `<div class="wp-pf-group"><button type="button" class="wp-pf-set" data-a="sys"><span class="wp-pf-set-txt"><b>Los avisos del teléfono están apagados</b><span>Actívalos para recibir lo de abajo</span></span></button></div>` : ''}
    <div class="wp-pf-group">${CATS.map(c => `
      <div class="wp-pf-set"><span class="wp-pf-set-txt"><b>${c.t}</b><span>${c.d}</span></span>
        <button type="button" class="wp-pf-switch" role="switch" data-k="${c.k}" aria-label="${c.t}"></button></div>`).join('')}
    </div>
    <p class="wp-pf-empty" style="text-align:left;padding:0 18px">Esto solo cambia lo que suena en el celular. La campanita sigue mostrando todo.</p>`;

  view.querySelector('[data-a=sys]')?.addEventListener('click', async () => {
    const { openPushAsk } = await import('/src/components/notifs/push-ask.js');
    openPushAsk(status === 'denied' ? 'denied' : 'prompt');
  });
  view.querySelectorAll('.wp-pf-switch[data-k]').forEach(sw => {
    const k = sw.dataset.k;
    let on = !off.includes(k);
    const paint = () => { sw.classList.toggle('wp-pf-on', on); sw.setAttribute('aria-checked', String(on)); };
    paint();
    sw.onclick = async () => {
      const was = on; on = !on; paint(); sheet._haptic('light');
      const next = on ? off.filter(x => x !== k) : [...off.filter(x => x !== k), k];
      try {
        const { data, error } = await getSupabase().rpc('push_prefs_set', { p_off: next });
        if (error) throw error;
        off = data || next;
      } catch (e) { console.error('[PF] avisos ' + k + ':', e); on = was; paint(); sheet._toast('No se pudo cambiar'); }
    };
  });
}
