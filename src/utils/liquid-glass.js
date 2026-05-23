// ====================================================================
// WHATSPLAN — src/utils/liquid-glass.js
// Frosted glass chips + panel de colores en tiempo real
// ====================================================================

const PARAMS = {
  chipBg:          'rgba(255,255,255,0.88)',
  chipBlur:        16,
  chipSaturate:    1.8,
  chipShadow:      'rgba(0,0,0,0.10)',
  chipFontColor:   '#111827',
  chipIconColor:   '#374151',
  chipIconBg:      'transparent',
  searchBg:        'rgba(255,255,255,0.88)',
  searchBlur:      16,
  searchFont:      '#111827',
  searchIcon:      '#374151',
  searchIconBg:    'rgba(0,0,0,0.08)',
  searchCountColor:'#9ca3af',
};

function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return null;
  return {
    r: parseInt(hex.slice(1,3),16),
    g: parseInt(hex.slice(3,5),16),
    b: parseInt(hex.slice(5,7),16)
  };
}

function applyChipStyles() {
  const p = PARAMS;
  const chips = [
    document.getElementById('topbar-activity-btn'),
    document.getElementById('topbar-right-chip'),
  ].filter(Boolean);

  chips.forEach(chip => {
    chip.style.background = p.chipBg;
    chip.style.backdropFilter = `blur(${p.chipBlur}px) saturate(${p.chipSaturate})`;
    chip.style.webkitBackdropFilter = `blur(${p.chipBlur}px) saturate(${p.chipSaturate})`;
    chip.style.color = p.chipFontColor;
    chip.querySelectorAll('svg').forEach(svg => svg.setAttribute('stroke', p.chipIconColor));
    chip.querySelectorAll('.topbar-icon-btn').forEach(btn => {
      btn.style.background = p.chipIconBg;
      btn.style.color = p.chipIconColor;
    });
  });
}

function applySearchStyles() {
  const p = PARAMS;
  const input = document.getElementById('wps-input');
  if (input) input.style.color = p.searchFont;
  const count = document.getElementById('wps-count');
  if (count) count.style.color = p.searchCountColor;
  ['wps-filter-chip','wps-close-chip'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = p.searchIconBg;
    el.style.color = p.searchIcon;
    el.querySelectorAll('svg').forEach(s => {
      s.setAttribute('stroke', p.searchIcon);
      s.setAttribute('fill', p.searchIcon);
    });
  });
}

export function getLGParams() { return { ...PARAMS }; }

export function updateLGParam(key, value) {
  PARAMS[key] = value;
  applyChipStyles();
  applySearchStyles();
}

export function initLiquidGlass() {
  applyChipStyles();

  // Pulse animation
  [
    document.getElementById('topbar-activity-btn'),
    document.getElementById('topbar-right-chip'),
  ].filter(Boolean).forEach(chip => {
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

  // Listen to panel
  document.addEventListener('wp:lgparams', (e) => {
    Object.assign(PARAMS, e.detail);
    applyChipStyles();
    applySearchStyles();
  });
}
