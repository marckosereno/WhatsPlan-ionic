// Congela lo de atrás mientras hay un zoom abierto: al salir el teclado el WebView se
// encoge y todo lo fijo anclado abajo (panel lateral, menú, barras) sube, y MapLibre
// redimensiona su lienzo. Se fija cada elemento fixed visible en su lugar y tamaño actuales
// (arriba + alto en px) y se pausa el redimensionado del mapa. Al cerrar se restaura todo.
let saved = null, H0 = 0, wait = null, depth = 0;   // depth: pantallas/zooms que lo piden (se suelta al llegar a 0)

const map = () => { try { return window.wpApp?.mapView?.getMap?.() || null; } catch (_) { return null; } };

export function freezeBg() {
  depth++;
  if (wait) wait(true);   // si aún esperaba para soltar la vez anterior, se suelta ya
  if (saved) return;
  const vv = window.visualViewport;
  H0 = Math.max(window.innerHeight, vv?.height || 0);
  saved = [];
  // Solo los elementos de los primeros niveles (lo fijo del mapa cuelga de ahí): recorrer
  // todo el DOM al abrir el zoom tardaba y se notaba como destello
  const els = [...document.body.children, ...(document.querySelector('ion-app')?.children || [])];
  const reads = [];
  for (const el of els) {
    if (el.closest('.wp-fz, #wp-st, .wp-st-scrim') || getComputedStyle(el).position !== 'fixed') continue;
    if (!el.offsetHeight) continue;
    reads.push([el, el.offsetTop, el.offsetHeight]);
  }
  for (const [el, top, h] of reads) {
    const st = el.style;
    saved.push([el, st.top, st.bottom, st.height, st.transition]);
    st.transition = 'none';   // al cambiar el anclaje no debe animarse nada
    st.top = `${top}px`; st.bottom = 'auto'; st.height = `${h}px`;
  }
  const m = map();
  if (m && '_trackResize' in m) m._trackResize = false;
  window.__fzFrozen = reads.length;
}

// Se sueltan hasta que el WebView recupere su alto completo: si se soltaran con el teclado
// aún bajando (swipe atrás), el panel lateral y el menú subirían un instante y se verían
export function thawBg() {
  depth = Math.max(0, depth - 1);
  if (depth > 0 || !saved || wait) return;
  const full = () => { const v = window.visualViewport; return !v || (v.offsetTop + v.height) >= H0 - 4 && window.innerHeight >= H0 - 4; };
  let t0 = performance.now(), raf = 0;
  const release = () => {
    cancelAnimationFrame(raf); wait = null;
    if (!saved) return;
    for (const [el, top, bottom, height, tr] of saved) { el.style.transition = 'none'; el.style.top = top; el.style.bottom = bottom; el.style.height = height; void el.offsetHeight; el.style.transition = tr; }
    saved = null;
    const m = map();
    if (m && '_trackResize' in m) { m._trackResize = true; try { m.resize(); } catch (_) {} }
  };
  wait = release;
  const tick = () => { if (full() || performance.now() - t0 > 900) release(); else raf = requestAnimationFrame(tick); };
  tick();
}
