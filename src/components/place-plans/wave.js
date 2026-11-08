// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/wave.js
// Entrada en ola (cascada con rebote), la misma de los pasos de "Planear
// visita": cada pieza sube un poquito y aparece, una tras otra (45 ms
// entre cada una, hasta 8; las demás entran juntas con la última).
//
// Uso: wave(contenedor)               → sus hijos directos
//      wave(contenedor, '.wp-pt-card') → los que coincidan
// Estilos: /styles/app.css (.wp-wave-in, @keyframes wpWave)
// ════════════════════════════════════════════════════════════════════
export function wave(root, sel = null, { max = 8, start = 0 } = {}) {
  if (!root) return;
  const els = sel ? [...root.querySelectorAll(sel)] : [...root.children];
  els.forEach((el, i) => {
    el.style.setProperty('--wi', Math.min(max, start + i));
    el.classList.remove('wp-wave-in');
    void el.offsetWidth;
    el.classList.add('wp-wave-in');
  });
  // al terminar se quita la clase (que no estorbe a otras animaciones)
  setTimeout(() => els.forEach(el => el.classList.remove('wp-wave-in')), 700 + Math.min(max, els.length) * 45);
}
