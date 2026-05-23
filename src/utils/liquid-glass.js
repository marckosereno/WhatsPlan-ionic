// ====================================================================
// WHATSPLAN — src/utils/liquid-glass.js
// Liquid Glass effect basado en el algoritmo de kube.io
// Convex Squircle + Snell's Law + Specular Highlight
// Chrome/WebView Android: SVG displacement map completo
// Safari/iOS: frosted glass fallback automático
// ====================================================================

// ── Parámetros del efecto ─────────────────────────────────────────
const PARAMS = {
  bezelWidth:      0.28,   // fracción del radio que es bisel
  glassIndex:      1.5,    // índice de refracción (vidrio = 1.5)
  scale:           null,   // null = calculado automáticamente
  specularOpacity: 0.40,
  specularSat:     7,
  blurLevel:       0.3,
};

// ── Superficie Convex Squircle (igual que Apple / kube.io) ────────
function convexSquircle(t) {
  return Math.pow(1 - Math.pow(1 - t, 4), 0.25);
}

function surfaceDerivative(t) {
  const dt = 0.001;
  return (convexSquircle(Math.min(1, t + dt)) - convexSquircle(Math.max(0, t - dt))) / (2 * dt);
}

// ── Pre-calcular desplazamientos en un radio ──────────────────────
function precomputeDisplacements(samples, bezelFrac, n2) {
  const n1 = 1.0;
  const mags = [];
  for (let i = 0; i < samples; i++) {
    const distBorder = (i / (samples - 1)) * bezelFrac;
    const t = distBorder / bezelFrac;
    const dh = surfaceDerivative(t);
    // Normal = (-dh, 1) normalizado
    const nx = -dh, ny = 1;
    const len = Math.sqrt(nx * nx + ny * ny);
    const normX = nx / len; // , normY = ny / len
    // Ángulo de incidencia (rayo vertical)
    const sinTheta1 = Math.abs(normX);
    const sinTheta2 = (n1 / n2) * sinTheta1;
    if (sinTheta2 > 1) { mags.push(0); continue; } // reflexión total
    const cosTheta2 = Math.sqrt(1 - sinTheta2 * sinTheta2);
    const cosTheta1 = Math.sqrt(1 - sinTheta1 * sinTheta1);
    // Desplazamiento lateral (Snell)
    const disp = Math.tan(Math.asin(sinTheta2)) - Math.tan(Math.asin(sinTheta1));
    mags.push(Math.abs(disp));
  }
  const maxMag = Math.max(...mags) || 1;
  return { mags: mags.map(m => m / maxMag), maxMag };
}

// ── Generar displacement map para forma pill ──────────────────────
function generatePillDM(W, H, params) {
  const { bezelWidth, glassIndex } = params;
  const SAMPLES = 128;
  const { mags, maxMag } = precomputeDisplacements(SAMPLES, bezelWidth, glassIndex);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);

  const cx = W / 2, cy = H / 2;
  // Radio efectivo para pill: usa el eje más corto como radio de los caps
  const capR = Math.min(W, H) / 2;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;

      // Distancia al borde de la pill shape
      // Pill = dos semicírculos + rectángulo central
      let distToBorder;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);

      if (dx <= cx - capR) {
        // Zona rectangular central
        distToBorder = capR - dy;
      } else {
        // Zona de los caps circulares
        const capCx = cx - capR + (dx > cx - capR ? (dx - (cx - capR)) : 0);
        const localDx = dx - (cx - capR);
        distToBorder = capR - Math.sqrt(localDx * localDx + dy * dy);
      }

      if (distToBorder < 0) {
        img.data[idx] = img.data[idx+1] = 128; img.data[idx+2] = 128; img.data[idx+3] = 255;
        continue;
      }

      const normalizedDist = Math.min(distToBorder / capR, 1);

      if (normalizedDist > bezelWidth) {
        img.data[idx] = img.data[idx+1] = 128; img.data[idx+2] = 128; img.data[idx+3] = 255;
        continue;
      }

      const t = normalizedDist / bezelWidth;
      const sampleIdx = Math.min(Math.floor(t * (SAMPLES - 1)), SAMPLES - 2);
      const frac = t * (SAMPLES - 1) - sampleIdx;
      const mag = mags[sampleIdx] * (1 - frac) + mags[sampleIdx + 1] * frac;

      // Dirección hacia afuera desde el centro de la pill
      let outX, outY;
      const absDx = x - cx, absDy = y - cy;
      if (Math.abs(absDx) <= cx - capR) {
        outX = 0; outY = absDy < 0 ? -1 : 1;
      } else {
        const ang = Math.atan2(absDy, absDx - Math.sign(absDx) * (cx - capR));
        outX = Math.cos(ang); outY = Math.sin(ang);
      }

      const r = Math.round(128 + outX * mag * 127);
      const g = Math.round(128 + outY * mag * 127);
      img.data[idx]   = Math.max(0, Math.min(255, r));
      img.data[idx+1] = Math.max(0, Math.min(255, g));
      img.data[idx+2] = 128;
      img.data[idx+3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return { dataUrl: canvas.toDataURL(), maxMag };
}

// ── Generar specular highlight map ────────────────────────────────
function generateSpecularMap(W, H, bezelFrac, opacity, saturation) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Rim light: gradiente radiale sui bordi
  const grad = ctx.createRadialGradient(W * 0.35, H * 0.2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
  grad.addColorStop(0,   `rgba(255,255,255,${opacity})`);
  grad.addColorStop(0.4, `rgba(255,255,255,${opacity * 0.3})`);
  grad.addColorStop(1,   `rgba(255,255,255,0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  const r = Math.min(W, H) / 2;
  ctx.roundRect(0, 0, W, H, r);
  ctx.fill();

  return canvas.toDataURL();
}

// ── Crear SVG filter para un chip ─────────────────────────────────
function createFilter(chipId, W, H) {
  const filterId = `lg-${chipId}`;

  // Eliminar filter anterior si existe
  const old = document.getElementById(`lgsvg-${chipId}`);
  if (old) old.remove();

  const { dataUrl, maxMag } = generatePillDM(W, H, PARAMS);
  const specUrl = generateSpecularMap(W, H, PARAMS.bezelWidth, PARAMS.specularOpacity, PARAMS.specularSat);
  const scale = PARAMS.scale || maxMag * Math.min(W, H) * 0.5;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = `lgsvg-${chipId}`;
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';

  svg.innerHTML = `<defs>
    <filter id="${filterId}"
      x="-5%" y="-5%" width="110%" height="110%"
      color-interpolation-filters="sRGB"
      primitiveUnits="userSpaceOnUse">

      <!-- Displacement map refracción -->
      <feImage id="dm-${chipId}" result="dm"
        href="${dataUrl}" preserveAspectRatio="none"
        x="0" y="0" width="${W}" height="${H}"/>

      <feDisplacementMap
        in="SourceGraphic" in2="dm"
        scale="${scale.toFixed(1)}"
        xChannelSelector="R" yChannelSelector="G"
        result="refracted"/>

      <!-- Brightness en bordes -->
      <feComponentTransfer in="refracted" result="bright">
        <feFuncR type="linear" slope="1.04" intercept="0.01"/>
        <feFuncG type="linear" slope="1.04" intercept="0.01"/>
        <feFuncB type="linear" slope="1.04" intercept="0.01"/>
      </feComponentTransfer>

      <!-- Specular highlight -->
      <feImage result="spec"
        href="${specUrl}" preserveAspectRatio="none"
        x="0" y="0" width="${W}" height="${H}"/>

      <feBlend in="bright" in2="spec" mode="screen" result="final"/>
      <feComposite in="final" in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>`;

  document.body.appendChild(svg);
  return filterId;
}

// ── Aplicar efecto a un chip ──────────────────────────────────────
function applyToChip(chip) {
  if (chip._lgApplied) return;
  chip._lgApplied = true;

  const rect = chip.getBoundingClientRect();
  const W = Math.ceil(rect.width) || 140;
  const H = Math.ceil(rect.height) || 46;

  const filterId = createFilter(chip.id, W, H);

  // Aplicar vía backdrop-filter
  chip.style.setProperty('--lg-bd', `url(#${filterId}) blur(${PARAMS.blurLevel}px)`);
  chip.classList.add('lg-active');
}

// ── Verificar soporte de SVG como backdrop-filter ─────────────────
function supportsBackdropSVG() {
  // Crear un elemento de prueba
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;width:1px;height:1px;backdrop-filter:url(#test);-webkit-backdrop-filter:url(#test);';
  document.body.appendChild(el);
  const computed = getComputedStyle(el);
  const supported = computed.backdropFilter?.includes('url') ||
                    computed.webkitBackdropFilter?.includes('url');
  document.body.removeChild(el);
  return supported;
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
      // Esperar un frame para asegurar que el chip tenga dimensiones
      requestAnimationFrame(() => {
        requestAnimationFrame(() => applyToChip(chip));
      });
    }
    // El pulse lo maneja wp-tap.js
  });
}
