// ====================================================================
// WHATSPLAN — utils/ios-fixes.js
// Fixes para iOS Safari + Capacitor (WKWebView)
// Sin dependencia del chat — orientado al mapa
// ====================================================================

import { isIOS, isCapacitor } from './dom.js';

// ── Variable CSS --vh para viewport real en iOS ──────────────────────
export function setAppHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);

  if (!window._initialVh) {
    window._initialVh = vh;
  }
}

// ── Safe area insets para Capacitor (notch, home bar) ───────────────
function applySafeAreas() {
  if (!isCapacitor() && !isIOS()) return;

  // Exponer variables CSS para que el layout las use
  const style = document.documentElement.style;

  // Si Capacitor expone SafeArea plugin, usarlo
  if (window.Capacitor?.Plugins?.SafeArea) {
    window.Capacitor.Plugins.SafeArea.getSafeAreaInsets().then(({ insets }) => {
      style.setProperty('--safe-top',    `${insets.top}px`);
      style.setProperty('--safe-bottom', `${insets.bottom}px`);
      style.setProperty('--safe-left',   `${insets.left}px`);
      style.setProperty('--safe-right',  `${insets.right}px`);
    }).catch(() => _fallbackSafeAreas(style));
  } else {
    _fallbackSafeAreas(style);
  }
}

function _fallbackSafeAreas(style) {
  // Usar env() de CSS — funciona en Safari y WKWebView
  style.setProperty('--safe-top',    'env(safe-area-inset-top,    0px)');
  style.setProperty('--safe-bottom', 'env(safe-area-inset-bottom, 0px)');
  style.setProperty('--safe-left',   'env(safe-area-inset-left,   0px)');
  style.setProperty('--safe-right',  'env(safe-area-inset-right,  0px)');
}

// ── Fix scroll/bounce en iOS ─────────────────────────────────────────
function applyScrollFix() {
  if (!isIOS()) return;

  // Prevenir bounce del body (el mapa maneja su propio scroll)
  document.body.addEventListener('touchmove', (e) => {
    if (e.target === document.body || e.target === document.documentElement) {
      e.preventDefault();
    }
  }, { passive: false });
}

// ── Fix mapa MapLibre en iOS tras background ─────────────────────────
function applyMapResumeFix() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // MapView ya tiene su propio resize listener,
      // pero forzamos un reflow del canvas por si acaso
      setTimeout(() => {
        const canvas = document.querySelector('#map-container canvas');
        if (canvas) {
          canvas.style.opacity = '0.99';
          requestAnimationFrame(() => { canvas.style.opacity = ''; });
        }
      }, 150);
    }
  });
}

// ── Fix tap delay en iOS (300ms) ─────────────────────────────────────
function applyFastTapFix() {
  // CSS touch-action: manipulation ya elimina el delay en elementos táctiles.
  // Aseguramos que el meta viewport tenga user-scalable=no o width=device-width.
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta && !meta.content.includes('user-scalable')) {
    meta.content += ', user-scalable=no';
  }
}

// ── Fix orientationchange — recalcular --vh ──────────────────────────
function applyOrientationFix() {
  window.addEventListener('orientationchange', () => {
    // Esperar a que el browser actualice innerHeight
    setTimeout(setAppHeight, 200);
  });
}

// ── Capacitor: status bar style ──────────────────────────────────────
function applyStatusBarFix() {
  if (!isCapacitor()) return;

  // Hacer la status bar transparente sobre el mapa
  if (window.Capacitor?.Plugins?.StatusBar) {
    const { StatusBar } = window.Capacitor.Plugins;
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: 'DARK' }).catch(() => {});
  }
}

// ── API pública ──────────────────────────────────────────────────────

/**
 * Inicializa todos los fixes de iOS/Capacitor para WhatsPlan.
 * Llamar una vez al inicio, antes de montar el mapa.
 */
export function initIOSFixes() {
  // Altura real del viewport
  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  applyOrientationFix();

  // Safe areas (notch, home indicator)
  applySafeAreas();

  // Fixes específicos de iOS
  applyScrollFix();
  applyFastTapFix();
  applyMapResumeFix();

  // Capacitor native
  applyStatusBarFix();

  console.log(`✅ iOS fixes init — iOS:${isIOS()} Capacitor:${isCapacitor()}`);
}
