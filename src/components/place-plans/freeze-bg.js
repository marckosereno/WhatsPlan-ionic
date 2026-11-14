// Congela lo de atrás mientras hay un zoom abierto: al salir el teclado el WebView se
// encoge y todo lo fijo anclado abajo (panel lateral, menú, barras) sube, y MapLibre
// redimensiona su lienzo. Se fija cada elemento fixed visible en su lugar y tamaño actuales
// (arriba + alto en px) y se pausa el redimensionado del mapa. Al cerrar se restaura todo.
let saved = null;

const map = () => { try { return window.wpApp?.mapView?.getMap?.() || null; } catch (_) { return null; } };

export function freezeBg() {
  if (saved) return;
  saved = [];
  const els = document.body.querySelectorAll('*');
  const reads = [];
  for (const el of els) {                                   // primero se lee todo (sin escribir: un solo reflujo)
    if (el.closest('.wp-fz') || getComputedStyle(el).position !== 'fixed') continue;
    if (!el.offsetHeight) continue;
    reads.push([el, el.offsetTop, el.offsetHeight]);
  }
  for (const [el, top, h] of reads) {
    const st = el.style;
    saved.push([el, st.top, st.bottom, st.height]);
    st.top = `${top}px`; st.bottom = 'auto'; st.height = `${h}px`;
  }
  const m = map();
  if (m && '_trackResize' in m) m._trackResize = false;
  window.__fzFrozen = reads.length;
}

export function thawBg() {
  if (!saved) return;
  for (const [el, top, bottom, height] of saved) { el.style.top = top; el.style.bottom = bottom; el.style.height = height; }
  saved = null;
  const m = map();
  if (m && '_trackResize' in m) { m._trackResize = true; try { m.resize(); } catch (_) {} }
}
