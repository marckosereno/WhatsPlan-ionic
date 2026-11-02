// ====================================================================
// WHATSPLAN — vehicle3d.js
// Tu vehículo en 3D REAL dentro del mapa (capa "custom" de MapLibre +
// three.js): se inclina y gira junto con las calles, así que al inclinar
// el mapa se ve de lado / de frente de verdad.
//
// - three.js + GLTFLoader van en src/vendor/three-gltf.js (~147 KB
//   comprimido). Se carga SOLO la primera vez que se usa.
// - Modelos .glb en src/assets/3d/ (Kenney Car Kit, licencia CC0).
// - Tamaño fijo en pantalla: un auto real (2.5 m) sería un puntito con el
//   mapa alejado, así que se escala con el zoom para medir ~SIZE_PX.
// - Si algo falla (sin WebGL, no carga el modelo) → onFail() y la app se
//   queda con el dibujo plano de siempre.
//
// Uso:
//   const v = createVehicle3D(map, { onFail });
//   await v.setModel('/src/assets/3d/sedan.glb');
//   v.setPos(lng, lat); v.setHeading(deg); v.setVisible(true); v.remove();
// ====================================================================

const LAYER_ID = 'wp-vehicle-3d';
const SIZE_PX = 54;        // largo del vehículo en pantalla (px)
const MODEL_LEN = 2.55;    // largo de los modelos de Kenney (unidades = metros)

let libP = null;
const loadLib = () => (libP ||= import('/src/vendor/three-gltf.js'));

// opts: id (capa; para tener 2 a la vez), smooth (giro suave; el juego
// de manejar lo apaga), sizePx (largo en pantalla)
export function createVehicle3D(map, { onFail, id = LAYER_ID, smooth = true, sizePx = SIZE_PX } = {}) {
  let T = null, scene = null, camera = null, renderer = null, holder = null;
  let pos = null, heading = 0, shown = null, visible = false, failed = false, url = '', len = MODEL_LEN;
  const cache = new Map(); // url → objeto 3D ya cargado

  const fail = (e) => {
    if (failed) return;
    failed = true;
    console.warn('[DIAG-3D] sin vehículo 3D, se queda el plano:', e?.message || e);
    try { onFail?.(e); } catch (_) {}
  };

  const layer = {
    id,
    type: 'custom',
    renderingMode: '3d',
    onAdd(m, gl) {
      try {
        camera = new T.Camera();
        scene = new T.Scene();
        // Luz: ambiente suave + sol de arriba a un lado (da volumen)
        scene.add(new T.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
        const sun = new T.DirectionalLight(0xffffff, 1.6);
        sun.position.set(0.6, 1.4, 0.8);
        scene.add(sun);
        holder = new T.Scene(); // contenedor del modelo (se cambia sin tocar la escena)
        scene.add(holder);
        renderer = new T.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        renderer.outputColorSpace = T.SRGBColorSpace;
      } catch (e) { fail(e); }
    },
    render(gl, args) {
      if (!renderer || !visible || !pos || !holder.children.length) return;
      try {
        const mc = window.maplibregl.MercatorCoordinate.fromLngLat([pos.lng, pos.lat], 0);
        // metros por píxel en este zoom/latitud → escala para medir SIZE_PX
        const mpp = 40075016.686 * Math.cos(pos.lat * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
        const meters = (sizePx * mpp) / len;
        const s = mc.meterInMercatorCoordinateUnits() * meters;
        const rotX = new T.Matrix4().makeRotationAxis(new T.Vector3(1, 0, 0), Math.PI / 2);
        // Rumbo suave: se acerca al nuevo por el camino más corto
        if (shown == null || !smooth) shown = heading;
        const d = ((heading - shown) % 360 + 540) % 360 - 180;
        shown += Math.abs(d) < 0.5 ? d : d * 0.18;
        if (Math.abs(d) >= 0.5) map.triggerRepaint();
        // 0 = norte, en sentido del reloj (los modelos miran hacia +Z)
        const rotY = new T.Matrix4().makeRotationAxis(new T.Vector3(0, 1, 0), Math.PI - shown * Math.PI / 180);
        const l = new T.Matrix4()
          .makeTranslation(mc.x, mc.y, mc.z)
          .scale(new T.Vector3(s, -s, s))
          .multiply(rotX)
          .multiply(rotY);
        const mtx = args?.defaultProjectionData?.mainMatrix || args; // MapLibre 5 (o 4: matriz directa)
        camera.projectionMatrix = new T.Matrix4().fromArray(mtx).multiply(l);
        renderer.resetState();
        renderer.render(scene, camera);
      } catch (e) { fail(e); }
    },
  };

  const ensureLayer = () => {
    if (failed || !map.getStyle?.()) return;
    if (!map.getLayer(id)) {
      try { map.addLayer(layer); } catch (e) { fail(e); }
    }
  };
  // Si el estilo del mapa se recarga, la capa se pierde: se vuelve a poner
  const onStyle = () => { if (visible) ensureLayer(); };
  map.on('styledata', onStyle);

  const api = {
    get failed() { return failed; },
    // u = .glb · modelLen = largo real del modelo en metros (para el tamaño en pantalla)
    async setModel(u, modelLen = MODEL_LEN) {
      if (failed) return false;
      try {
        T = await loadLib();
        if (!T?.WebGLRenderer) throw new Error('three.js no cargó');
        ensureLayer();
        if (u === url && holder?.children.length) { len = modelLen || MODEL_LEN; return true; }
        url = u;
        let obj = cache.get(u);
        if (!obj) {
          const g = await new T.GLTFLoader().loadAsync(u);
          obj = g.scene;
          cache.set(u, obj);
        }
        if (url !== u) return true; // mientras cargaba se pidió otro
        holder.clear();
        holder.add(obj);
        len = modelLen || MODEL_LEN;
        map.triggerRepaint();
        return true;
      } catch (e) { fail(e); return false; }
    },
    setPos(lng, lat) { pos = { lng, lat }; if (visible) map.triggerRepaint(); },
    setHeading(deg) { heading = deg || 0; if (visible) map.triggerRepaint(); },
    setVisible(b) {
      visible = !!b && !failed;
      if (visible) ensureLayer();
      map.triggerRepaint();
    },
    remove() {
      visible = false;
      map.off('styledata', onStyle);
      try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
      try { holder?.clear(); } catch (_) {}
    },
  };
  return api;
}
