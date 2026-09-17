// ====================================================================
// WHATSPLAN — src/utils/liquid-glass.js
// Pulse spring para chips del topbar
// ====================================================================

export function initLiquidGlass() {
  const chips = [
    document.getElementById('wp-side-plan-btn'),
    document.getElementById('wp-side-slot-2'),
    document.getElementById('wp-side-slot-3'),
    document.getElementById('topbar-right-chip'),
  ].filter(Boolean);

  chips.forEach(chip => {
    chip.addEventListener('pointerdown', () => {
      chip.style.transition = 'transform 0.1s ease-out';
      // Squish asimétrico (más achatado en Y que en X) — una compresión
      // pareja en las dos direcciones se lee como "más chico", una
      // desigual se lee como "se aplastó un poco", que es lo que hace
      // sentir esponjoso/bubble en vez de solo un botón que encoge.
      chip.style.transform = 'scale(0.8, 0.7)';
    });
    chip.addEventListener('pointerup', () => {
      chip.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.7, 0.64, 1)';
      chip.style.transform = 'scale(1.12)';
      setTimeout(() => {
        chip.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
        chip.style.transform = 'scale(1)';
      }, 200);
    });
    chip.addEventListener('pointercancel', () => {
      chip.style.transition = 'transform 0.2s ease';
      chip.style.transform = 'scale(1)';
    });
  });
}
