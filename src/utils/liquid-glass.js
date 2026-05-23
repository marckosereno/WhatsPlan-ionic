// ====================================================================
// WHATSPLAN — src/utils/liquid-glass.js
// Liquid Glass — kube.io algorithm + realtime panel support
// ====================================================================

// ── Convex Squircle surface (Apple / kube.io) ─────────────────────
function convexSquircle(t) {
  return Math.pow(1 - Math.pow(1 - t, 4), 0.25);
}

// ── Generate pill displacement map ───────────────────────────────
function genPillDM(W, H, bezelFrac, n2) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const cx = W/2, cy = H/2, capR = Math.min(W,H)/2;
  const hi = Math.max(0, cx - capR);
  const S = 128;
  const disps = [];
  let maxD = 0;

  for (let i = 0; i < S; i++) {
    const t = i/(S-1), dt = 0.001;
    const dh = (convexSquircle(Math.min(1,t+dt)) - convexSquircle(Math.max(0,t-dt))) / (2*dt);
    const nx = -dh, ny = 1, len = Math.sqrt(nx*nx+ny*ny);
    const sinI = Math.abs(nx/len), sinR = sinI/n2;
    if (sinR > 1) { disps.push(0); continue; }
    const d = Math.tan(Math.asin(sinR)) - Math.tan(Math.asin(sinI));
    disps.push(Math.abs(d));
    maxD = Math.max(maxD, Math.abs(d));
  }
  const norm = maxD || 1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y*W+x)*4, adx = x-cx, ady = y-cy;
      let dtb;
      if (Math.abs(adx) <= hi) { dtb = capR - Math.abs(ady); }
      else { const lx = Math.abs(adx)-hi; dtb = capR - Math.sqrt(lx*lx+ady*ady); }
      if (dtb < 0 || dtb/capR > bezelFrac) {
        img.data[idx] = img.data[idx+1] = 128; img.data[idx+2] = 128; img.data[idx+3] = 255;
        continue;
      }
      const t = (dtb/capR)/bezelFrac;
      const si = Math.min(Math.floor(t*(S-1)), S-2);
      const fr = t*(S-1) - si;
      const mag = (disps[si]*(1-fr) + disps[si+1]*fr) / norm;
      let ox, oy;
      if (Math.abs(adx) <= hi) { ox = 0; oy = ady < 0 ? -1 : (ady > 0 ? 1 : 0); }
      else { const ang = Math.atan2(ady, adx - Math.sign(adx)*hi); ox = Math.cos(ang); oy = Math.sin(ang); }
      img.data[idx]   = Math.max(0,Math.min(255,Math.round(128+ox*mag*127)));
      img.data[idx+1] = Math.max(0,Math.min(255,Math.round(128+oy*mag*127)));
      img.data[idx+2] = 128; img.data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { url: c.toDataURL(), maxD };
}

// ── Hex to RGB ────────────────────────────────────────────────────
function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1,3),16),
    g: parseInt(hex.slice(3,5),16),
    b: parseInt(hex.slice(5,7),16)
  };
}

// ── Current params (shared state) ────────────────────────────────
const PARAMS = {
  refractionLevel: 0.47,
  bezelWidth:      0.28,
  specularOpacity: 0.58,
  specularSat:     8,
  bgOpacity:       0.35,
  bgColor:         '#3b6bff',
  borderColor:     '#4488ff',
  fontColor:       '#ffffff',
  iconColor:       '#ffffff',
};

// ── Apply SVG displacement filter to chip ─────────────────────────
function applyFilter(chip) {
  const rect = chip.getBoundingClientRect();
  const W = Math.ceil(rect.width) || 140;
  const H = Math.ceil(rect.height) || 46;

  const { url, maxD } = genPillDM(W, H, PARAMS.bezelWidth, 1.5);
  const scale = maxD * Math.min(W, H) * PARAMS.refractionLevel;
  const filterId = 'lg-' + chip.id;

  // Remove old SVG
  const old = document.getElementById('lgsvg-' + chip.id);
  if (old) old.remove();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'lgsvg-' + chip.id;
  svg.setAttribute('width','0'); svg.setAttribute('height','0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  svg.innerHTML = `<defs>
    <filter id="${filterId}" x="-8%" y="-8%" width="116%" height="116%"
            color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">
      <feImage href="${url}" result="dm" preserveAspectRatio="none"
               x="0" y="0" width="${W}" height="${H}"/>
      <feDisplacementMap in="SourceGraphic" in2="dm"
        scale="${scale.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feComponentTransfer in="d">
        <feFuncR type="linear" slope="1.06" intercept="0.015"/>
        <feFuncG type="linear" slope="1.06" intercept="0.015"/>
        <feFuncB type="linear" slope="1.06" intercept="0.015"/>
      </feComponentTransfer>
    </filter>
  </defs>`;
  document.body.appendChild(svg);

  // Inject or update refraction div
  let refr = chip.querySelector('.lg-refr');
  if (!refr) {
    refr = document.createElement('div');
    refr.className = 'lg-refr';
    refr.style.cssText = 'position:absolute;inset:0;border-radius:inherit;z-index:-1;';
    chip.insertBefore(refr, chip.firstChild);
  }
  refr.style.backdropFilter = `url(#${filterId})`;
  refr.style.webkitBackdropFilter = `url(#${filterId})`;
}

// ── Apply specular + colors ───────────────────────────────────────
function applySpecular(chip) {
  const p = PARAMS;
  const {r:cr,g:cg,b:cb} = hexToRgb(p.bgColor);
  const {r:br,g:bg,b:bb} = hexToRgb(p.borderColor);
  const op = p.bgOpacity, specO = p.specularOpacity;

  // Inject or update specular div
  let spec = chip.querySelector('.lg-spec');
  if (!spec) {
    spec = document.createElement('div');
    spec.className = 'lg-spec';
    spec.style.cssText = 'position:absolute;inset:0;border-radius:50px;pointer-events:none;z-index:1;';
    chip.appendChild(spec);
  }

  spec.style.background = `
    radial-gradient(ellipse at 50% 0%,   rgba(${br},${bg},${bb},${(specO*0.6).toFixed(2)}) 0%, transparent 65%),
    radial-gradient(ellipse at 50% 100%, rgba(${br},${bg},${bb},${(specO*0.5).toFixed(2)}) 0%, transparent 60%),
    radial-gradient(ellipse at 0%   50%, rgba(${br},${bg},${bb},${(specO*0.45).toFixed(2)}) 0%, transparent 55%),
    radial-gradient(ellipse at 100% 50%, rgba(${br},${bg},${bb},${(specO*0.42).toFixed(2)}) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 50%, rgba(${cr},${cg},${cb},${op.toFixed(2)}) 0%, transparent 80%)
  `;
  spec.style.boxShadow = `
    inset 0 1.5px 0 rgba(255,255,255,0.95),
    inset 0 -1px 0 rgba(${br},${bg},${bb},0.3),
    inset 1.5px 0 0 rgba(255,255,255,0.6),
    inset -1.5px 0 0 rgba(${br},${bg},${bb},0.2),
    0 6px 24px rgba(${cr},${cg},${cb},0.2),
    0 1px 4px rgba(0,0,0,0.08)
  `;
  spec.style.filter = `saturate(${p.specularSat})`;

  // Font + icon colors
  chip.style.color = p.fontColor;
  chip.querySelectorAll('svg').forEach(svg => svg.setAttribute('stroke', p.iconColor));
}

// ── Apply all to chip ─────────────────────────────────────────────
function applyToChip(chip) {
  applyFilter(chip);
  applySpecular(chip);
}

// ── Fallback for Safari/iOS ───────────────────────────────────────
function applyFallback(chip) {
  chip.style.background = 'rgba(255,255,255,0.82)';
  chip.style.backdropFilter = 'blur(16px) saturate(1.8)';
  chip.style.webkitBackdropFilter = 'blur(16px) saturate(1.8)';
  chip.style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)';
}

function supportsBackdropSVG() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;width:1px;height:1px;backdrop-filter:url(#x);-webkit-backdrop-filter:url(#x);';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const ok = (cs.backdropFilter||'').includes('url') || (cs.webkitBackdropFilter||'').includes('url');
  document.body.removeChild(el);
  return ok;
}

// ── Get chips ────────────────────────────────────────────────────
function getChips() {
  return [
    document.getElementById('topbar-activity-btn'),
    document.getElementById('topbar-right-chip'),
  ].filter(Boolean);
}

// ── Public API for panel ──────────────────────────────────────────
export function updateLGParam(key, value) {
  PARAMS[key] = value;
  getChips().forEach(chip => {
    if (key === 'refractionLevel' || key === 'bezelWidth') {
      applyFilter(chip);
    }
    applySpecular(chip);
  });
}

export function getLGParams() {
  return { ...PARAMS };
}

// ── Init ─────────────────────────────────────────────────────────
export function initLiquidGlass() {
  const chips = getChips();
  if (!chips.length) return;

  const hasSupport = supportsBackdropSVG();

  chips.forEach(chip => {
    chip.style.position = 'relative';
    chip.style.isolation = 'isolate';
    chip.style.overflow = 'hidden';
    chip.style.background = 'transparent';
    chip.style.border = 'none';

    if (hasSupport) {
      requestAnimationFrame(() => requestAnimationFrame(() => applyToChip(chip)));
      // Recalculate on resize (searchbar expand)
      const ro = new ResizeObserver(() => {
        requestAnimationFrame(() => applyFilter(chip));
      });
      ro.observe(chip);
    } else {
      applyFallback(chip);
    }
  });

  // Listen to panel events
  document.addEventListener('wp:lgparams', (e) => {
    Object.assign(PARAMS, e.detail);
    chips.forEach(chip => applyToChip(chip));
    applySearchBarColors(PARAMS);
  });
}

// ── Apply colors to searchbar elements ───────────────────────────
export function applySearchBarColors(p) {
  // Input background + text
  const inner = document.getElementById('wps-inner');
  const chip  = document.getElementById('topbar-right-chip');
  if (!p.searchBg && !p.searchFont) return;

  // wps-input font color
  const input = document.getElementById('wps-input');
  if (input && p.searchFont) input.style.color = p.searchFont;

  // wps-count color
  const count = document.getElementById('wps-count');
  if (count && p.searchBadgeFont) count.style.color = p.searchBadgeFont;

  // filter/close icon color
  ['wps-filter-chip','wps-close-chip'].forEach(id => {
    const el = document.getElementById(id);
    if (el && p.searchIcon) {
      el.style.color = p.searchIcon;
      el.querySelectorAll('svg').forEach(svg => svg.setAttribute('stroke', p.searchIcon));
    }
  });

  // Search icon
  const wpsIcon = document.querySelector('.wps-icon');
  if (wpsIcon && p.searchIcon) wpsIcon.style.filter = `brightness(0) saturate(100%) invert(${p.searchIcon === '#ffffff' ? 1 : 0})`;

  // Chip bg when expanded
  if (chip && p.searchBg) chip.style.setProperty('--search-bg', p.searchBg);
}
