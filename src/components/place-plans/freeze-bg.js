// Congela lo de atrás mientras hay un zoom abierto: al salir el teclado el WebView se
// encoge y todo lo fijo abajo (panel lateral, menú) sube, y MapLibre redimensiona su
// lienzo. Aquí se fijan esos elementos donde estaban y se pausa el redimensionado del mapa.
const PINNED = { 'wp-side-panel-top': '--fz-top-a', 'wp-side-panel-bottom': '--fz-top-b', 'wp-footer-menu': '--fz-top-c' };
let frozen = false;

const map = () => { try { return window.wpApp?.mapView?.getMap?.() || null; } catch (_) { return null; } };

export function freezeBg() {
  if (frozen) return;
  frozen = true;
  const root = document.documentElement.style;
  for (const [id, v] of Object.entries(PINNED)) {
    const el = document.getElementById(id);
    if (el) root.setProperty(v, `${Math.round(el.getBoundingClientRect().top)}px`);
  }
  const m = map();
  if (m && '_trackResize' in m) m._trackResize = false;
}

export function thawBg() {
  if (!frozen) return;
  frozen = false;
  const root = document.documentElement.style;
  Object.values(PINNED).forEach(v => root.removeProperty(v));
  const m = map();
  if (m && '_trackResize' in m) { m._trackResize = true; try { m.resize(); } catch (_) {} }
}
