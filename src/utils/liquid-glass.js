// ====================================================================
// WHATSPLAN — src/utils/liquid-glass.js
// Pulse spring para chips del topbar
// ====================================================================

export function initLiquidGlass() {
  const chips = [
    document.getElementById('topbar-activity-btn'),
    document.getElementById('topbar-right-chip'),
  ].filter(Boolean);

  chips.forEach(chip => {
    chip.addEventListener('pointerdown', () => {
      chip.style.transition = 'transform 0.1s ease';
      chip.style.transform = 'scale(0.92)';
    });
    chip.addEventListener('pointerup', () => {
      chip.style.transition = 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)';
      chip.style.transform = 'scale(1.05)';
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
