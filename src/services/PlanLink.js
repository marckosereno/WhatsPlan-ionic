// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — services/PlanLink.js
// Enlace para compartir un plan y abrirlo desde ese enlace.
//   · PlanLink.url(id)    → https://…/?plan=<id>
//   · PlanLink.share(p)   → hoja de compartir (Capacitor Share → Web Share → copiar). Devuelve
//                           'shared' | 'copied' | 'cancel'
//   · al cargar la web con ?plan=<id> se guarda el id (aguanta el login, aunque la página se recargue)
//   · PlanLink.openPending() → con sesión iniciada, abre ese plan (la persona puede "Unirme")
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { API_ORIGIN, isNative } from '/src/native/native.js';

const KEY = 'wpPendingPlan', DAY = 864e5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guarda el id del enlace y limpia la dirección (se ejecuta al cargar la app)
(function capture() {
  try {
    const q = new URLSearchParams(location.search), id = q.get('plan');
    if (!id || !UUID.test(id)) return;
    localStorage.setItem(KEY, JSON.stringify({ id, t: Date.now() }));
    q.delete('plan');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  } catch (_) {}
})();

export const PlanLink = {
  url(id) { return (isNative() ? API_ORIGIN : location.origin) + '/?plan=' + encodeURIComponent(id); },

  async share({ id, title, when, address }) {
    const url = this.url(id);
    const text = `¿Vamos? ${title}${when ? ' · ' + when : ''}${address ? '\n' + address : ''}`;
    try {
      const cap = window.Capacitor?.Plugins?.Share;
      if (cap?.share) { await cap.share({ title, text, url, dialogTitle: 'Invitar al plan' }); return 'shared'; }
      if (navigator.share) { await navigator.share({ title, text, url }); return 'shared'; }
    } catch (e) {
      if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return 'cancel';
    }
    const full = `${text}\n${url}`;
    try { await navigator.clipboard.writeText(full); return 'copied'; } catch (_) {}
    const ta = document.createElement('textarea'); ta.value = full; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    ta.remove(); return 'copied';
  },

  async openPending() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
    if (!p?.id) return;
    try { localStorage.removeItem(KEY); } catch (_) {}
    if (Date.now() - (p.t || 0) > DAY) return;
    const app = window.wpApp;
    try {
      const { data: a } = await getSupabase().from('activities').select('*').eq('id', p.id).maybeSingle();
      if (!a) { app?.placeModal?._showToast?.('Ese plan ya no está disponible'); return; }
      app?.plansTab?._openPlan?.(a);
    } catch (e) { console.warn('plan-link:', e?.message || e); }
  },
};
