// ====================================================================
// WHATSPLAN — src/utils/liquid-glass.js
// Liquid Glass — SVG displacement map (algoritmo kube.io)
// Chrome/WebView: refracción real, fondo transparente
// Safari/iOS: fallback frosted glass automático
// ====================================================================

function convexSquircle(t) {
  return Math.pow(1 - Math.pow(1 - t, 4), 0.25);
}

function genPillDM(W, H, bezelFrac, n2) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const cx = W/2, cy = H/2;
  const capR = Math.min(W, H) / 2;
  const halfInner = Math.max(0, cx - capR);
  const n1 = 1.0;

  const SAMPLES = 128;
  const disps = [];
  let maxDisp = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const dt = 0.001;
    const dh = (convexSquircle(Math.min(1,t+dt)) - convexSquircle(Math.max(0,t-dt))) / (2*dt);
    const nx = -dh, ny = 1;
    const len = Math.sqrt(nx*nx + ny*ny);
    const sinI = Math.abs(nx/len);
    const sinR = (n1/n2) * sinI;
    if (sinR > 1) { disps.push(0); continue; }
    const d = Math.tan(Math.asin(sinR)) - Math.tan(Math.asin(sinI));
    disps.push(Math.abs(d));
    maxDisp = Math.max(maxDisp, Math.abs(d));
  }
  const norm = maxDisp || 1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y*W+x)*4;
      const absDx = x - cx, absDy = y - cy;

      let dtb;
      if (Math.abs(absDx) <= halfInner) {
        dtb = capR - Math.abs(absDy);
      } else {
        const lx = Math.abs(absDx) - halfInner;
        dtb = capR - Math.sqrt(lx*lx + absDy*absDy);
      }

      if (dtb < 0 || dtb/capR > bezelFrac) {
        img.data[idx] = img.data[idx+1] = 128;
        img.data[idx+2] = 128; img.data[idx+3] = 255;
        continue;
      }

      const t = (dtb/capR) / bezelFrac;
      const si = Math.min(Math.floor(t*(SAMPLES-1)), SAMPLES-2);
      const fr = t*(SAMPLES-1) - si;
      const mag = (disps[si]*(1-fr) + disps[si+1]*fr) / norm;

      let ox, oy;
      if (Math.abs(absDx) <= halfInner) {
        ox = 0; oy = absDy < 0 ? -1 : (absDy > 0 ? 1 : 0);
      } else {
        const ang = Math.atan2(absDy, absDx - Math.sign(absDx)*halfInner);
        ox = Math.cos(ang); oy = Math.sin(ang);
      }

      img.data[idx]   = Math.max(0,Math.min(255,Math.round(128 + ox*mag*127)));
      img.data[idx+1] = Math.max(0,Math.min(255,Math.round(128 + oy*mag*127)));
      img.data[idx+2] = 128; img.data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { url: canvas.toDataURL(), maxDisp };
}

function applyToChip(chip) {
  if (chip._lgDone) return;
  chip._lgDone = true;

  const rect = chip.getBoundingClientRect();
  const W = Math.ceil(rect.width) || 140;
  const H = Math.ceil(rect.height) || 46;

  const { url, maxDisp } = genPillDM(W, H, 0.30, 1.5);
  const scale = maxDisp * Math.min(W, H) * 0.47; // refraction level 0.47
  const filterId = 'lg-' + chip.id;

  // SVG filter
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
        scale="${scale.toFixed(1)}"
        xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feComponentTransfer in="d">
        <feFuncR type="linear" slope="1.06" intercept="0.015"/>
        <feFuncG type="linear" slope="1.06" intercept="0.015"/>
        <feFuncB type="linear" slope="1.06" intercept="0.015"/>
      </feComponentTransfer>
    </filter>
  </defs>`;
  document.body.appendChild(svg);

  // Inyectar div de refracción si no existe
  let refr = chip.querySelector('.lg-refr');
  if (!refr) {
    refr = document.createElement('div');
    refr.className = 'lg-refr';
    refr.style.cssText = `position:absolute;inset:0;border-radius:inherit;z-index:-1;`;
    chip.insertBefore(refr, chip.firstChild);
  }

  refr.style.backdropFilter = `url(#${filterId})`;
  refr.style.webkitBackdropFilter = `url(#${filterId})`;
}

function supportsBackdropSVG() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;width:1px;height:1px;backdrop-filter:url(#x);-webkit-backdrop-filter:url(#x);';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const ok = (cs.backdropFilter||'').includes('url') ||
             (cs.webkitBackdropFilter||'').includes('url');
  document.body.removeChild(el);
  return ok;
}

// Fallback para Safari/iOS — frosted glass clásico
function applyFallback(chip) {
  chip.style.background = 'rgba(255,255,255,0.82)';
  chip.style.backdropFilter = 'blur(16px) saturate(1.8)';
  chip.style.webkitBackdropFilter = 'blur(16px) saturate(1.8)';
  chip.style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)';
}

export function initLiquidGlass() {
  const chips = [
    document.getElementById('topbar-activity-btn'),
    document.getElementById('topbar-right-chip'),
  ].filter(Boolean);

  if (!chips.length) return;

  const hasSupport = supportsBackdropSVG();

  chips.forEach(chip => {
    if (hasSupport) {
      requestAnimationFrame(() => requestAnimationFrame(() => applyToChip(chip)));
    } else {
      applyFallback(chip);
    }
  });
}
