/* ====================================================================
   WHATSPLAN — app.css
   Copiado exacto de map-view.css de la PWA original
   ==================================================================== */

/* Quitar highlight de tap — igual que PWA */
* { -webkit-tap-highlight-color: transparent !important; }

/* ── VIEWPORT LOCK — exacto del original ── */
html {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
}

body {
  font-family: 'Inter Tight', system-ui, sans-serif;
  position: fixed;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

ion-app {
  position: fixed;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ── Contenedor del mapa — mismo id que PWA: map-container ── */
.map-container {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background: #e8e8e8;
  transition: background 0.3s ease;
}

/* ── Sombra blanca SUPERIOR — copiado de .map-view::before ── */
ion-app::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 90px;
  background: linear-gradient(
    to bottom,
    rgba(255,255,255,0.92) 0%,
    rgba(255,255,255,0.45) 55%,
    rgba(255,255,255,0) 100%
  );
  pointer-events: none;
  z-index: 9998;
}

/* ── Sombra blanca INFERIOR — copiado de .map-view::after ── */
ion-app::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 120px;
  background: linear-gradient(
    to top,
    rgba(255,255,255,0.95) 0%,
    rgba(255,255,255,0.55) 50%,
    rgba(255,255,255,0) 100%
  );
  pointer-events: none;
  z-index: 38;
  transition: background 0.4s ease;
}

/* ════════════════════════════════════════════════════════════
   PANEL INFERIOR — copiado exacto de .map-results-panel
   ════════════════════════════════════════════════════════════ */
.map-results-panel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: white;
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
  height: 26dvh;
  min-height: 26dvh;
  max-height: 26dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Yahoo Sans Bold Regular', system-ui, sans-serif;
  z-index: 40;
  touch-action: pan-y;
  overscroll-behavior: contain;
  padding-bottom: env(safe-area-inset-bottom);
  gap: 0;
}

/* Scroll horizontal en categorías — igual que PWA */
.map-results-panel .map-categories-footer {
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overflow-x: auto;
  overflow-y: hidden;
  will-change: scroll-position;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

/* ── Handle — copiado de .panel-drag-handle ── */
.panel-drag-handle {
  width: 100%;
  height: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: default;
  flex-shrink: 0;
  background: white;
  border-radius: 22px 22px 0 0;
}

.drag-indicator {
  width: 36px;
  height: 4px;
  background: rgba(0,0,0,0.3);
  border-radius: 2px;
}

/* ════════════════════════════════════════════════════════════
   BARRA DE BÚSQUEDA — copiado de .map-search-global-bar
   ════════════════════════════════════════════════════════════ */
.map-search-global-bar {
  position: relative;
  left: auto; right: auto; top: auto;
  z-index: 1;
  background: #f3f4f6;
  border: none;
  border-radius: 50px;
  box-shadow: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: 42px;
  margin: 0 16px 4px;
  transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
  flex-shrink: 0;
}

.map-search-global-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  font-family: 'Inter Tight', system-ui, sans-serif;
}

.map-search-global-input::placeholder {
  color: #9ca3af;
  font-weight: 500;
}

.map-results-count-inline {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ════════════════════════════════════════════════════════════
   CATEGORÍAS — copiado exacto de .category-footer-chip
   ════════════════════════════════════════════════════════════ */
.map-categories-footer {
  flex-shrink: 0;
  scrollbar-width: none;
  -webkit-tap-highlight-color: transparent;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 8px 4px;
  gap: 0;
}
.map-categories-footer::-webkit-scrollbar { display: none; }

.category-footer-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  min-width: 66px;
  cursor: pointer;
  transition: transform 0.15s ease;
  flex-shrink: 0;
  background: none;
  border: none;
  box-shadow: none;
  padding: 6px 4px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.category-footer-chip:active { transform: scale(0.92); }

/* Círculo del icono */
.category-icon-circle {
  width: 62px;
  height: 62px;
  border-radius: 40%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: none;
  padding: 8px;
  box-sizing: border-box;
  position: relative;
  overflow: visible;
  -webkit-tap-highlight-color: transparent;
}

/* Shimmer mientras carga el icono */
.category-icon-circle.loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: cat-shimmer 1.2s infinite;
  border-radius: 40%;
}
@keyframes cat-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.category-footer-chip.active .category-icon-circle {
  background: #e2e8f0;
  transform: scale(1.06);
}
.category-footer-chip.active .category-name {
  color: #475569;
  font-weight: 700;
}

.category-icon-3d {
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.category-icon { font-size: 30px; line-height: 1; }
.category-name {
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  text-align: center;
  white-space: nowrap;
  font-family: 'Inter Tight', system-ui, sans-serif;
}

/* ════════════════════════════════════════════════════════════
   MAPLIBRE — overrides
   ════════════════════════════════════════════════════════════ */
.maplibregl-marker {
  background: transparent !important;
  border: none !important;
}

.maplibregl-ctrl-attrib {
  font-size: 9px;
  background: rgba(255,255,255,0.7);
  padding: 1px 4px;
  border-radius: 4px 0 0 0;
  font-family: 'Yahoo Sans Bold Regular', system-ui, sans-serif;
  font-weight: 700;
}
.maplibregl-ctrl-attrib a { color: #9ca3af; }

.maplibregl-ctrl-top-right {
  top: 12px !important;
  right: 12px !important;
}
.maplibregl-ctrl-group {
  border-radius: 12px !important;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
  border: none !important;
}
.maplibregl-ctrl-group button {
  width: 36px !important;
  height: 36px !important;
  background-color: white !important;
}
.maplibregl-ctrl-group button + button {
  border-top: 1px solid rgba(0,0,0,0.08) !important;
}

/* Canvas sin outline */
#map-container canvas:focus,
#map-container canvas:focus-visible,
.maplibregl-canvas-container:focus-within {
  outline: none !important;
}
