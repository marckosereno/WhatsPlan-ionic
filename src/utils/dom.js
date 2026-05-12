// ====================================================================
// WHATSPLAN — utils/dom.js
// Utilidades DOM para app de mapa + Capacitor
// ====================================================================

/**
 * Detecta si el dispositivo es iOS (Safari o WKWebView de Capacitor)
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detecta si el dispositivo es Android
 */
export function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

/**
 * Detecta si corre dentro de Capacitor (app nativa)
 */
export function isCapacitor() {
  return !!(window.Capacitor && window.Capacitor.isNative);
}

/**
 * Detecta si es dispositivo móvil
 */
export function isMobile() {
  return isIOS() || isAndroid();
}

/**
 * Oculta un elemento agregando clase 'hidden'
 */
export function hideElement(element) {
  if (!element) return;
  element.classList.add('hidden');
}

/**
 * Muestra un elemento removiendo clase 'hidden'
 */
export function showElement(element) {
  if (!element) return;
  element.classList.remove('hidden');
}

/**
 * Toggle de visibilidad
 */
export function toggleElement(element) {
  if (!element) return;
  element.classList.toggle('hidden');
}

/**
 * Activa vibración háptica
 * @param {number} duration - ms
 */
export function vibrateDevice(duration = 15) {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}

/**
 * Espera un tiempo (promesa)
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
