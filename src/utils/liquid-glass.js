// ====================================================================
// WHATSPLAN — src/utils/liquid-glass.js
// Liquid Glass — SVG displacement map + realtime panel
// ====================================================================

// ── Shared params state ───────────────────────────────────────────
const PARAMS = {
  refractionLevel: 0.47,
  bezelWidth:      0.28,
  specularOpacity: 0.58,
  specularSat:     8,
  bgOpacity:       0.35,
  bgGradientAngle: 145,
  bgColor:         '#3b6bff',
  borderColor:     '#4488ff',
  fontColor:       '#ffffff',
  iconColor:       '#ffffff',
  iconBgColor:     'transparent',
  iconBgOpacity:   0,
  searchBg:        'rgba(255,255,255,0.85)',
  searchFont:      '#111827',
  searchIcon:      '#374151',
  searchIconBg:    'rgba(0,0,0,0.08)',
  searchBadgeBg:   '#f3f4f6',
  searchBadgeFont: '#6b7280',
  searchBlur:      12,
};

// ── Displacement map generation ───────────────────────────────────
function genPillDM(W, H, bezelFrac) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const cx = W / 2, cy = H / 2;
  const rx = W / 2, ry = H / 2;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;

      const q = Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4);
      const distBorder = 1 - Math.pow(q, 0.25);

      let dx = 128, dy = 128;

      if (distBorder >= 0 && distBorder < bezelFrac) {
        const t = distBorder / bezelFrac;
        const surf = (tt) => Math.pow(1 - Math.pow(1 - tt, 4), 0.25);
        const dt = 0.0005;
        const dh = (surf(Math.min(1, t + dt)) - surf(Math.max(0, t - dt))) / (2 * dt);
        const sinI = Math.min(Math.abs(dh) * 0.75, 0.95);
        const sinR = sinI / 1.5;
        const disp = (sinR - sinI) * 1.9;
        const r = Math.sqrt(nx * nx + ny * ny);
        if (r > 0.001) {
          const ang = Math.atan2(ny, nx);
          dx = Math.round(128 + Math.cos(ang) * disp * 127);
          dy = Math.round(128 + Math.sin(ang) * disp * 127);
          dx = Math.max(0, Math.min(255, dx));
          dy = Math.max(0, Math.min(255, dy));
        }
      }
      img.data[i] = dx; img.data[i+1] = dy;
      img.data[i+2] = 128; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

// ── Hex to rgb ────────────────────────────────────────────────────
function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return {r:255,g:255,b:255};
  return {
    r: parseInt(hex.slice(1,3),16)||0,
    g: parseInt(hex.slice(3,5),16)||0,
    b: parseInt(hex.slice(5,7),16)||0
  };
}

// ── Apply SVG filter to chip ──────────────────────────────────────
function applyFilter(chip) {
  const rect = chip.getBoundingClientRect();
  const W = Math.ceil(rect.width) || 120;
  const H = Math.ceil(rect.height) || 46;
  const filterId = 'lg-' + chip.id;
  const scale = 16 * PARAMS.refractionLevel / 0.47;

  // Remove old svg
  const old = document.getElementById('lgsvg-' + chip.id);
  if (old) old.remove();

  const dmUrl = genPillDM(W, H, PARAMS.bezelWidth);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.id = 'lgsvg-' + chip.id;
  svg.setAttribute('width','0'); svg.setAttribute('height','0');
  svg.style.cssText = 'position:absolute;overflow:hidden;pointer-events:none;';
  svg.innerHTML = `<defs>
    <filter id="${filterId}" x="-10%" y="-10%" width="120%" height="120%"
            color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">
      <feImage href="${dmUrl}" result="dm" preserveAspectRatio="none"
               x="0" y="0" width="${W}" height="${H}"/>
      <feDisplacementMap in="SourceGraphic" in2="dm"
        scale="${scale.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feComponentTransfer in="d">
        <feFuncR type="linear" slope="1.04" intercept="0.012"/>
        <feFuncG type="linear" slope="1.04" intercept="0.012"/>
        <feFuncB type="linear" slope="1.04" intercept="0.012"/>
      </feComponentTransfer>
    </filter>
  </defs>`;
  document.body.appendChild(svg);

  chip.style.setProperty('--lg-filter', `url(#${filterId})`);
  chip.classList.add('lg-active');
}

// ── Apply colors/specular to chip ─────────────────────────────────
function applyColors(chip) {
  const p = PARAMS;
  const {r:cr,g:cg,b:cb} = hexToRgb(p.bgColor);
  const {r:br,g:bg2,b:bb} = hexToRgb(p.borderColor);
  const op = p.bgOpacity, specO = p.specularOpacity;
  const angle = p.bgGradientAngle || 145;

  // Inject/update specular layer
  let spec = chip.querySelector('.lg-spec');
  if (!spec) {
    spec = document.createElement('div');
    spec.className = 'lg-spec';
    spec.style.cssText = 'position:absolute;inset:0;border-radius:50px;pointer-events:none;z-index:2;';
    chip.appendChild(spec);
  }

  spec.style.background = `
    radial-gradient(ellipse at 50% 0%,   rgba(${br},${bg2},${bb},${(specO*0.6).toFixed(2)}) 0%, transparent 65%),
    radial-gradient(ellipse at 50% 100%, rgba(${br},${bg2},${bb},${(specO*0.5).toFixed(2)}) 0%, transparent 60%),
    radial-gradient(ellipse at 0%   50%, rgba(${br},${bg2},${bb},${(specO*0.45).toFixed(2)}) 0%, transparent 55%),
    radial-gradient(ellipse at 100% 50%, rgba(${br},${bg2},${bb},${(specO*0.42).toFixed(2)}) 0%, transparent 55%),
    linear-gradient(${angle}deg, rgba(${cr},${cg},${cb},${op.toFixed(2)}) 0%, rgba(${cr},${cg},${cb},${(op*0.6).toFixed(2)}) 100%)
  `;
  spec.style.boxShadow = `
    inset 0 1.5px 0 rgba(255,255,255,0.95),
    inset 0 -1px 0 rgba(${br},${bg2},${bb},0.3),
    inset 1.5px 0 0 rgba(255,255,255,0.6),
    inset -1.5px 0 0 rgba(${br},${bg2},${bb},0.2),
    0 6px 24px rgba(${cr},${cg},${cb},0.2),
    0 1px 4px rgba(0,0,0,0.08)
  `;
  spec.style.filter = `saturate(${p.specularSat})`;

  // Font color
  chip.style.color = p.fontColor;

  // Icon colors
  chip.querySelectorAll('svg').forEach(svg => svg.setAttribute('stroke', p.iconColor));

  // Icon button bg
  const iconBgOp = p.iconBgOpacity || 0;
  chip.querySelectorAll('.topbar-icon-btn').forEach(btn => {
    if (iconBgOp > 0 && p.iconBgColor && p.iconBgColor !== 'transparent') {
      const {r:ir,g:ig,b:ib} = hexToRgb(p.iconBgColor);
      btn.style.background = `rgba(${ir},${ig},${ib},${iconBgOp.toFixed(2)})`;
    } else {
      btn.style.background = 'transparent';
    }
  });
}

// ── Apply searchbar colors ────────────────────────────────────────
function applySearchColors() {
  const p = PARAMS;
  const input = document.getElementById('wps-input');
  if (input && p.searchFont) input.style.color = p.searchFont;

  const count = document.getElementById('wps-count');
  if (count && p.searchBadgeFont) count.style.color = p.searchBadgeFont;

  ['wps-filter-chip','wps-close-chip'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (p.searchIcon) {
      el.style.color = p.searchIcon;
      el.querySelectorAll('svg').forEach(s => s.setAttribute('stroke', p.searchIcon));
    }
    if (p.searchIconBg) el.style.background = p.searchIconBg;
  });
}

// ── Pulse animation ───────────────────────────────────────────────
function addPulse(chip) {
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
}

// ── Public API ────────────────────────────────────────────────────
export function updateLGParam(key, value) {
  PARAMS[key] = value;
  const chips = getChips();
  chips.forEach(chip => {
    if (key === 'refractionLevel' || key === 'bezelWidth') applyFilter(chip);
    applyColors(chip);
  });
  applySearchColors();
}

export function getLGParams() { return { ...PARAMS }; }

function getChips() {
  return [
    document.getElementById('topbar-activity-btn'),
    document.getElementById('topbar-right-chip'),
  ].filter(Boolean);
}

// ── Init ──────────────────────────────────────────────────────────
export function initLiquidGlass() {
  const supportsBackdropSVG = CSS.supports('backdrop-filter', 'url(#test)') ||
                               CSS.supports('-webkit-backdrop-filter', 'url(#test)');

  const chips = getChips();
  chips.forEach(chip => {
    if (supportsBackdropSVG) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        applyFilter(chip);
        applyColors(chip);
      }));
      // Recalc on resize (searchbar expand)
      new ResizeObserver(() => {
        applyFilter(chip);
      }).observe(chip);
    }
    addPulse(chip);
  });

  // Listen to panel
  document.addEventListener('wp:lgparams', (e) => {
    Object.assign(PARAMS, e.detail);
    chips.forEach(chip => { applyFilter(chip); applyColors(chip); });
    applySearchColors();
  });
}
