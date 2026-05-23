// ====================================================================
// WHATSPLAN — src/utils/liquid-glass.js
// Liquid Glass effect for topbar chips
// Chrome/WebView: SVG displacement map refraction + specular pulse
// Safari/iOS: graceful fallback to frosted glass (CSS only)
// ====================================================================

function genPillDisplacementMap(W, H, bezelFrac) {
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

      // Squircle distance (superellipse n=4 — igual que Apple)
      const q = Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4);
      const distBorder = 1 - Math.pow(q, 0.25);

      let dx = 128, dy = 128;

      if (distBorder >= 0 && distBorder < bezelFrac) {
        const t = distBorder / bezelFrac;

        // Convex squircle surface function
        const surf = (tt) => Math.pow(1 - Math.pow(1 - tt, 4), 0.25);
        const dt = 0.0005;
        const dh = (surf(Math.min(1, t + dt)) - surf(Math.max(0, t - dt))) / (2 * dt);

        // Snell's law — n1=1 (air), n2=1.5 (glass)
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

      img.data[i]     = dx;
      img.data[i + 1] = dy;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function createSVGFilter(id, W, H, dmUrl) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;overflow:hidden;pointer-events:none;';

  svg.innerHTML = `
    <defs>
      <filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"
              color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">
        <feImage href="${dmUrl}" result="dm" preserveAspectRatio="none"
                 x="0" y="0" width="${W}" height="${H}"/>
        <feDisplacementMap in="SourceGraphic" in2="dm"
          scale="16" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feComponentTransfer in="d">
          <feFuncR type="linear" slope="1.04" intercept="0.012"/>
          <feFuncG type="linear" slope="1.04" intercept="0.012"/>
          <feFuncB type="linear" slope="1.04" intercept="0.012"/>
        </feComponentTransfer>
      </filter>
    </defs>`;

  document.body.appendChild(svg);
  return id;
}

function applyLiquidGlassToChip(chip) {
  const rect = chip.getBoundingClientRect();
  const W = Math.ceil(rect.width) || 120;
  const H = Math.ceil(rect.height) || 46;

  const filterId = 'lg-' + chip.id;
  const dmUrl = genPillDisplacementMap(W, H, 0.30);
  createSVGFilter(filterId, W, H, dmUrl);

  // Aplicar refracción via backdrop-filter con SVG filter
  chip.style.setProperty('--lg-filter', `url(#${filterId})`);

  // Inyectar el pseudo-elemento de refracción via clase
  chip.classList.add('lg-active');
}

function addLiquidPulse(chip) {
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

export function initLiquidGlass() {
  // Solo aplicar refracción en Chrome/WebView (soporta SVG como backdrop-filter)
  const supportsBackdropSVG = CSS.supports('backdrop-filter', 'url(#test)') ||
                               CSS.supports('-webkit-backdrop-filter', 'url(#test)');

  const chips = [
    document.getElementById('topbar-activity-btn'),
    document.getElementById('topbar-right-chip'),
  ].filter(Boolean);

  chips.forEach(chip => {
    if (supportsBackdropSVG) {
      applyLiquidGlassToChip(chip);
    }
    addLiquidPulse(chip);
  });
}
