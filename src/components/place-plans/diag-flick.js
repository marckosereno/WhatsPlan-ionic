// DIAGNÓSTICO TEMPORAL ([DIAG-FLICK]): durante 3 s después de abrir una hoja cuenta qué cambia en el DOM,
// cuántos cuadros se tardan más de 50 ms y cuántas veces se redibuja el mapa. Se quita al encontrar la causa.
export function diagFlick(nombre) {
  const t0 = performance.now(), cuenta = new Map();
  const nom = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return e ? `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}` : '?'; };
  const mo = new MutationObserver((ms) => { for (const m of ms) { const k = `${m.type}${m.attributeName ? ':' + m.attributeName : ''} ${nom(m.target)}`; cuenta.set(k, (cuenta.get(k) || 0) + 1); } });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  let largos = 0, cuadros = 0, last = performance.now(), raf = 0, renders = 0;
  const map = (() => { try { return window.wpApp?.mapView?.getMap?.(); } catch (_) { return null; } })();
  const onR = () => { renders++; };
  try { map?.on('render', onR); } catch (_) {}
  const tick = (t) => { cuadros++; if (t - last > 50) largos++; last = t; raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  setTimeout(() => {
    mo.disconnect(); cancelAnimationFrame(raf); try { map?.off('render', onR); } catch (_) {}
    const top = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${v}× ${k}`).join(' | ');
    console.log(`[DIAG-FLICK] ${nombre} 3s: cuadros=${cuadros} largos(>50ms)=${largos} mapa-render=${renders} anim=${document.getAnimations().length} [${(() => { const c = new Map(); document.getAnimations().forEach(x => { const k = (x.animationName || x.transitionProperty || 'waapi') + '@' + (x.effect?.target?.id || x.effect?.target?.className?.toString?.().split(' ')[0] || x.effect?.target?.tagName || '?'); c.set(k, (c.get(k) || 0) + 1); }); return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => v + '×' + k).join(', '); })()}] | ${top || 'sin cambios'}`);
  }, 3000);
  void t0;
}

// Pruebas rápidas desde la consola de Eruda, con la hoja ya abierta (se deshacen recargando la app):
//   wpX(1) quita TODOS los desenfoques (backdrop-filter) · wpX(2) cancela TODAS las animaciones
//   wpX(3) esconde el mapa · wpX(4) quita solo el desenfoque de la barra de la hoja
//   wpXarm = n  (escribe: wpXarm = 6) aplica esa prueba automáticamente al ABRIR cada hoja, para ver si evita el destello de entrada
//   wpX(5) esconde los paneles del mapa (lateral, menú, botones de arriba) · wpX(6) esconde la pestaña de atrás
window.wpX = (n) => {
  const q = (sel) => document.querySelectorAll(sel);
  if (n === 1) { let c = 0; q('body *').forEach(e => { const cs = getComputedStyle(e); if ((cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none')) { e.style.backdropFilter = 'none'; e.style.webkitBackdropFilter = 'none'; c++; } }); return `sin desenfoque en ${c} elementos`; }
  if (n === 2) { const a = document.getAnimations(); a.forEach(x => { try { x.cancel(); } catch (_) {} }); return `${a.length} animaciones canceladas`; }
  if (n === 3) { const m = document.getElementById('map') || document.querySelector('.maplibregl-map'); if (m) m.style.visibility = 'hidden'; return m ? 'mapa escondido' : 'no encontré el mapa'; }
  if (n === 4) { q('#wp-st .wp-st-top').forEach(e => { e.style.backdropFilter = 'none'; e.style.webkitBackdropFilter = 'none'; }); return 'barra de la hoja sin desenfoque'; }
  if (n === 5) { ['wp-side-panel-top', 'wp-side-panel-bottom', 'wp-footer-menu', 'topbar'].forEach(i => { const e = document.getElementById(i); if (e) e.style.visibility = 'hidden'; }); return 'paneles del mapa escondidos'; }
  if (n === 6) { q('body > *').forEach(e => { if (/tab/i.test(e.id + ' ' + e.className) && e.id !== 'wp-st') e.style.visibility = 'hidden'; }); return 'pestaña escondida'; }
  return 'usa wpX(1) a wpX(6)';
};
