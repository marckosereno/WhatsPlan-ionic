// Congela lo de atrás mientras hay un zoom abierto: al salir el teclado el WebView se
// encoge y todo lo fijo anclado abajo (panel lateral, menú, barras) sube, y MapLibre
// redimensiona su lienzo. Se fija cada elemento fixed visible en su lugar y tamaño actuales
// (arriba + alto en px) y se pausa el redimensionado del mapa. Al cerrar se restaura todo.
let saved = null, H0 = 0, wait = null;

const map = () => { try { return window.wpApp?.mapView?.getMap?.() || null; } catch (_) { return null; } };

export function freezeBg() {
  if (wait) wait(true);   // si aún esperaba para soltar la vez anterior, se suelta ya
  if (saved) return;
  const vv = window.visualViewport;
  H0 = Math.max(window.innerHeight, vv?.height || 0);
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

// Se sueltan hasta que el WebView recupere su alto completo: si se soltaran con el teclado
// aún bajando (swipe atrás), el panel lateral y el menú subirían un instante y se verían
export function thawBg() {
  if (!saved || wait) return;
  const full = () => { const v = window.visualViewport; return !v || (v.offsetTop + v.height) >= H0 - 4 && window.innerHeight >= H0 - 4; };
  let t0 = performance.now(), raf = 0;
  const release = () => {
    cancelAnimationFrame(raf); wait = null;
    if (!saved) return;
    for (const [el, top, bottom, height] of saved) { el.style.top = top; el.style.bottom = bottom; el.style.height = height; }
    saved = null;
    const m = map();
    if (m && '_trackResize' in m) { m._trackResize = true; try { m.resize(); } catch (_) {} }
  };
  wait = release;
  const tick = () => { if (full() || performance.now() - t0 > 900) release(); else raf = requestAnimationFrame(tick); };
  tick();
}
