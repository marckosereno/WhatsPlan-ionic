// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — native/native.js
// Puente con la app nativa (Capacitor). En la web no hace nada.
//  · API_ORIGIN: en la app empaquetada las rutas /api/... hay que mandarlas
//    al servidor de Vercel (cambia la constante si cambia el dominio)
// ════════════════════════════════════════════════════════════════════
export const API_ORIGIN = 'https://whats-plan-ionic.vercel.app';   // dominio de producción en Vercel

export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const platform = () => window.Capacitor?.getPlatform?.() || 'web';

export function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add('wp-native', `wp-${platform()}`);
  // fetch('/api/...') → servidor de Vercel
  const f = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/')) input = API_ORIGIN + input;
    return f(input, init);
  };
}
