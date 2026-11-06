// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/step-sheet.js
// Modo "hoja" de la pantalla por pasos (step-screen.js con sheet: true):
// los mismos pasos, pero dentro de una hoja que sube desde abajo, con
// fondo oscurecido, jaladera arriba y altura que se ajusta al contenido
// de cada paso (crece o se encoge con un resorte al cambiar de paso).
// Se cierra tocando lo oscuro o jalando la hoja hacia abajo.
//
// Uso (lo hace step-screen.js):
//   const sh = attachSheet(root, close)   → { fit(content, top, foot), remove() }
// Estilos: /styles/plan-steps.css (#wp-st.sheet, .wp-st-scrim, .wp-st-grab)
// ════════════════════════════════════════════════════════════════════

const CLOSE_PX = 110;   // jalar más de esto hacia abajo = cerrar

export function attachSheet(root, close) {
  root.classList.add('sheet');
  const scrim = document.createElement('div');
  scrim.className = 'wp-st-scrim';
  document.body.insertBefore(scrim, root);
  requestAnimationFrame(() => scrim.classList.add('in'));
  scrim.addEventListener('click', () => close());
  const top = root.querySelector('.wp-st-top');
  top.insertAdjacentHTML('afterbegin', '<i class="wp-st-grab" aria-hidden="true"></i>');
  dragToClose(root, top, close);

  return {
    // Alto = barra + contenido del paso + botón (sin pasarse del máximo)
    fit(content, topH, footH) {
      const max = parseFloat(getComputedStyle(root).maxHeight) || window.innerHeight * 0.92;
      const h = Math.min(max, Math.ceil(topH + (content?.scrollHeight || 0) + footH));
      root.style.height = `${h}px`;
      return h;
    },
    remove() { scrim.classList.remove('in'); setTimeout(() => scrim.remove(), 340); },
  };
}

// Jalar la barra de arriba hacia abajo: la hoja sigue al dedo y si pasa
// del límite se cierra; si no, regresa con resorte
function dragToClose(root, handle, close) {
  let y0 = null, dy = 0;
  handle.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    y0 = e.touches[0].clientY; dy = 0;
    root.style.transition = 'none';
  }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    root.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  const end = () => {
    if (y0 == null) return;
    y0 = null;
    root.style.transition = '';
    root.style.transform = '';
    if (dy > CLOSE_PX) close();
  };
  handle.addEventListener('touchend', end, { passive: true });
  handle.addEventListener('touchcancel', end, { passive: true });
}
