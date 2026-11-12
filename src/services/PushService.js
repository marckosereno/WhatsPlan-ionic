// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — services/PushService.js
// Push nativo (Capacitor + FCM). Pide permiso, registra el token del
// teléfono en public.push_tokens y abre la pantalla correcta al tocar el
// aviso. En la web no hace nada. SQL: supabase/41_push_tokens.sql
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';
import { isNative, platform } from '/src/native/native.js';

const KEY = 'wpPushToken';
const ASK = 'wpPushAsk';   // última vez que se mostró el sheet
let wired = false;

const plugin = () => window.Capacitor?.Plugins?.PushNotifications;

export const PushService = {
  // Llamar con la sesión: pide permiso (una vez) y guarda el token
  async start(user) {
    const P = plugin();
    // register() sin Firebase configurado TUMBA la app nativa (no se puede atrapar desde JS).
    // Solo se activa en el APK compilado con google-services.json, que se marca con
    // appendUserAgent "WPPush/1" en capacitor.config.json. Los APK viejos no lo traen.
    if (!isNative() || !P || !user || !/WPPush\/1/.test(navigator.userAgent)) return;
    try {
      if (!wired) { wired = true; this._wire(P); }
      // El permiso ya NO se pide aquí: se ofrece con offer() tras unirse o crear un plan
      const perm = await P.checkPermissions();
      if (perm.receive === 'granted') await P.register();   // → evento 'registration'
    } catch (e) { console.warn('push:', e?.message || e); }
  },

  ready() { return isNative() && !!plugin() && /WPPush\/1/.test(navigator.userAgent); },

  // 'granted' | 'denied' | 'prompt' | 'na'
  async status() {
    if (!this.ready()) return 'na';
    try {
      const r = (await plugin().checkPermissions()).receive;
      return r === 'granted' ? 'granted' : r === 'denied' ? 'denied' : 'prompt';
    } catch (_) { return 'na'; }
  },

  // Diálogo del sistema (solo desde el botón "Activar" del sheet) y registro del token
  async enable() {
    if (!this.ready()) return 'na';
    try {
      const P = plugin(); if (!wired) { wired = true; this._wire(P); }
      const r = (await P.requestPermissions()).receive;
      if (r === 'granted') { await P.register(); return 'granted'; }
      return r === 'denied' ? 'denied' : 'prompt';
    } catch (e) { console.warn('push:', e?.message || e); return 'na'; }
  },

  // Tras unirse o crear un plan: si faltan los avisos, abre el sheet (no insiste: lo recuerda)
  async offer() {
    const user = window.wpApp?.currentUser; if (!user || !this.ready()) return;
    const st = await this.status();
    if (st === 'granted') return this.start(user);
    if (st === 'na') return;
    let last = 0; try { last = +localStorage.getItem(ASK) || 0; } catch (_) {}
    const wait = (st === 'denied' ? 30 : 7) * 864e5;
    if (Date.now() - last < wait) return;
    try { localStorage.setItem(ASK, String(Date.now())); } catch (_) {}
    const { openPushAsk } = await import('/src/components/notifs/push-ask.js');
    openPushAsk(st);
  },

  // Al cerrar sesión: este teléfono deja de recibir los avisos de esa cuenta
  async stop() {
    try {
      const t = localStorage.getItem(KEY); if (!t) return;
      await getSupabase().rpc('push_unregister', { p_token: t });
      localStorage.removeItem(KEY);
    } catch (_) {}
  },

  _wire(P) {
    P.addListener('registration', async ({ value }) => {
      try {
        const { error } = await getSupabase().rpc('push_register', { p_token: value, p_platform: platform() });
        if (!error) localStorage.setItem(KEY, value);
      } catch (e) { console.warn('push token:', e?.message || e); }
    });
    P.addListener('registrationError', (e) => console.warn('push registro:', e?.error || e));
    // Tocó el aviso: abre el plan, el chat o el perfil según los datos
    P.addListener('pushNotificationActionPerformed', ({ notification }) => this._open(notification?.data || {}));
  },

  _open(d) {
    const app = window.wpApp; if (!app) return;
    try {
      if (d.kind === 'plan' && d.activity_id) app.plansTab?._openPlan?.({ id: d.activity_id });
      else if (d.kind === 'follow' && d.user_id) app.socialTab?.openProfile?.(d.user_id);
      else app.notifPanel?.open?.();
    } catch (_) {}
  },
};

// Unirse a un plan o crear uno = buen momento para ofrecer los avisos
window.addEventListener('wp:plan-action', () => setTimeout(() => PushService.offer(), 1300));
