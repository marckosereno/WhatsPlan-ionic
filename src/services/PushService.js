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
    if (!isNative() || !P || !user || !/WPPush\/\d/.test(navigator.userAgent)) return;
    try {
      if (!wired) { wired = true; this._wire(P); }
      await this._channel(P);
      // El permiso ya NO se pide aquí: se ofrece con offer() tras unirse o crear un plan
      const perm = await P.checkPermissions();
      if (perm.receive === 'granted') await P.register();   // → evento 'registration'
    } catch (e) { console.warn('push:', e?.message || e); }
  },

  // Canales de Android 8+ (importancia alta = aviso emergente). Uno por tipo, cada uno con su sonido:
  //   wp_chat → mensajes · wp_recordatorio → "tu plan es en 1 hora" · wp_planes → todo lo demás
  // Los sonidos viven en la app (android/.../res/raw) y solo existen desde el APK WPPush/2; con el APK anterior
  // los canales se crean con el sonido por defecto. La importancia y el sonido de un canal ya creado no se pueden
  // cambiar desde la app: para cambiarlos, usar otro id (y el mismo en supabase/functions/push-send: channel_id).
  async _channel(P) {
    if (platform() !== 'android' || !P.createChannel) return;
    const snd = /WPPush\/([2-9]|\d\d)/.test(navigator.userAgent);
    const base = { importance: 4, visibility: 1, vibration: true, lights: true, lightColor: '#2563EB' };
    try {
      await P.createChannel({ ...base, id: 'wp_chat', name: 'Mensajes del chat', description: 'Mensajes de tus planes', ...(snd ? { sound: 'wp_chat.ogg' } : {}) });
      await P.createChannel({ ...base, id: 'wp_planes', name: 'Planes', description: 'Invitaciones, gente que se une y cambios', ...(snd ? { sound: 'wp_plan.ogg' } : {}) });
      await P.createChannel({ ...base, id: 'wp_recordatorio', name: 'Recordatorios', description: 'Una hora antes de tus planes', ...(snd ? { sound: 'wp_recordatorio.ogg' } : {}) });
      P.deleteChannel?.({ id: 'avisos' }).catch(() => {});   // el canal de la versión anterior
    } catch (e) { console.warn('push canales:', e?.message || e); }
  },

  ready() { return isNative() && !!plugin() && /WPPush\/\d/.test(navigator.userAgent); },

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

  // Al tocar el aviso la app puede estar fría (sesión aún cargando): espera a que haya usuario
  async _open(d) {
    const app = window.wpApp; if (!app) return;
    try {
      if ((d.kind === 'plan' || d.kind === 'chat') && d.activity_id) {
        for (let i = 0; i < 20 && !window.wpApp?.currentUser; i++) await new Promise(r => setTimeout(r, 400));
        // _openPlan necesita la fila completa de la actividad, no solo el id
        const { data: a } = await getSupabase().from('activities').select('*').eq('id', d.activity_id).maybeSingle();
        if (!a) app.notifPanel?.open?.();
        else if (d.kind === 'chat') {
          const { openPlanChat } = await import('/src/components/chat/plan-chat.js');
          openPlanChat(app.plansTab?.getPM?.() || app.placeModal, a, {});
        } else app.plansTab?._openPlan?.(a);
      }
      else if (d.kind === 'follow' && d.user_id) app.socialTab?.openProfile?.(d.user_id);
      else app.notifPanel?.open?.();
    } catch (_) {}
  },
};

// Unirse a un plan o crear uno = buen momento para ofrecer los avisos
window.addEventListener('wp:plan-action', () => setTimeout(() => PushService.offer(), 1300));
