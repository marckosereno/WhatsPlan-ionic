// ====================================================================
// WHATSPLAN — SuperUserPanel.js
// FAB ⚙️ + panel admin — solo visible para superusuario
// Fase 9
// ====================================================================

import { LandmarkService, CustomPlaceService, isSuperUser } from '/src/services/SuperUserService.js';

const STICKER_PRESETS = [
  { emoji: '⭐', label: 'Destacado' },  { emoji: '🔥', label: 'Popular' },
  { emoji: '🎉', label: 'Evento' },     { emoji: '📍', label: 'Punto clave' },
  { emoji: '🏛️', label: 'Monumento' }, { emoji: '🛑', label: 'Alerta' },
  { emoji: '💎', label: 'Exclusivo' },  { emoji: '🎵', label: 'Música' },
  { emoji: '🌮', label: 'Comida' },     { emoji: '🍹', label: 'Bar' },
  { emoji: '🛍️', label: 'Tienda' },   { emoji: '📸', label: 'Foto spot' },
];

const LANDMARK_COLORS = [
  '#00bcd4', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#ec4899',
];

export class SuperUserPanel {
  constructor(mapView, callbacks = {}) {
    this.mapView    = mapView;     // instancia de MapView
    this.callbacks  = callbacks;   // { onLandmarksUpdated }
    this.isVisible  = false;
    this.pickMode   = null;        // null | 'landmark' | 'sticker' | 'place'
    this.pendingLat = null;
    this.pendingLng = null;
    this._editingId = null;
    this._pngDataUrl = null;
    this._currentFormType = null;
    this._mapClickHandler = null;
  }

  mount() {
    this._injectStyles();
    this._buildFAB();
    this._buildPanel();
    this._buildPickBanner();
    this._buildFormModal();
    this._buildListPanel();
    this._buildPlacesPanel();
  }

  unmount() {
    ['su-fab','su-panel','su-pick-banner','su-form-modal','su-list-panel','su-places-panel']
      .forEach(id => document.getElementById(id)?.remove());
  }

  // ── FAB ──────────────────────────────────────────────────────────
  _buildFAB() {
    const fab = document.createElement('button');
    fab.id = 'su-fab';
    fab.innerHTML = '⚙️';
    fab.title = 'Panel Admin';
    fab.addEventListener('click', () => this._togglePanel());
    document.body.appendChild(fab);
  }

  // ── Panel principal ───────────────────────────────────────────────
  _buildPanel() {
    const p = document.createElement('div');
    p.id = 'su-panel';
    p.innerHTML = `
      <div class="su-panel-header">
        <span>🛡️ SuperUser Panel</span>
        <button id="su-panel-close">✕</button>
      </div>
      <div class="su-panel-body">
        <button class="su-btn su-btn-cyan"   id="su-btn-add-landmark">📍 Agregar landmark</button>
        <button class="su-btn su-btn-purple" id="su-btn-add-sticker">🎉 Agregar sticker</button>
        <button class="su-btn su-btn-gray"   id="su-btn-view-list">📋 Gestionar landmarks</button>
        <button class="su-btn su-btn-teal"   id="su-btn-places">🏪 Agregar lugar custom</button>
        <button class="su-btn su-btn-places" id="su-btn-manage-places">🗂️ Gestionar lugares</button>
        <div class="su-divider"></div>
        <div class="su-hint">Toca un botón, luego toca el mapa para colocar.</div>
      </div>`;
    document.body.appendChild(p);

    document.getElementById('su-panel-close').addEventListener('click',       () => this._togglePanel(false));
    document.getElementById('su-btn-add-landmark').addEventListener('click',  () => this._startPick('landmark'));
    document.getElementById('su-btn-add-sticker').addEventListener('click',   () => this._startPick('sticker'));
    document.getElementById('su-btn-view-list').addEventListener('click',     () => this._openList());
    document.getElementById('su-btn-places').addEventListener('click',        () => this._startPick('place'));
    document.getElementById('su-btn-manage-places').addEventListener('click', () => this._openPlaces());
  }

  _togglePanel(force) {
    this.isVisible = force !== undefined ? force : !this.isVisible;
    document.getElementById('su-panel')?.classList.toggle('visible', this.isVisible);
  }

  // ── Banner pick mode ──────────────────────────────────────────────
  _buildPickBanner() {
    const b = document.createElement('div');
    b.id = 'su-pick-banner';
    b.innerHTML = `
      <span id="su-pick-text">Toca el mapa para colocar</span>
      <button id="su-pick-cancel">Cancelar</button>`;
    document.body.appendChild(b);
    document.getElementById('su-pick-cancel').addEventListener('click', () => this._cancelPick());
  }

  _startPick(type) {
    this._togglePanel(false);
    this.pickMode = type;

    const textMap = {
      landmark: '📍 Toca el mapa para colocar el landmark',
      sticker:  '🎉 Toca el mapa para colocar el sticker',
      place:    '🏪 Toca el mapa para colocar el lugar',
    };
    document.getElementById('su-pick-text').textContent = textMap[type] || 'Toca el mapa';
    document.getElementById('su-pick-banner').classList.add('visible');

    // Listener de click en el mapa
    const map = this.mapView.getMap();
    this._mapClickHandler = (e) => {
      this.pendingLat = e.lngLat.lat;
      this.pendingLng = e.lngLat.lng;
      this._cancelPick(false); // quitar banner pero no resetear coords
      this._openForm(type);
    };
    map.once('click', this._mapClickHandler);
  }

  _cancelPick(resetCoords = true) {
    this.pickMode = null;
    document.getElementById('su-pick-banner').classList.remove('visible');
    if (resetCoords) { this.pendingLat = null; this.pendingLng = null; }
    if (this._mapClickHandler) {
      this.mapView.getMap().off('click', this._mapClickHandler);
      this._mapClickHandler = null;
    }
  }

  // ── Formulario de creación / edición ─────────────────────────────
  _buildFormModal() {
    const m = document.createElement('div');
    m.id = 'su-form-modal';
    m.innerHTML = `
      <div class="su-form-card">
        <div class="su-form-header">
          <span id="su-form-title">Nuevo landmark</span>
          <button id="su-form-close">✕</button>
        </div>
        <div class="su-form-scroll">

          <!-- LANDMARK FIELDS -->
          <div id="su-form-landmark-fields">
            <input id="su-field-title" class="su-input" placeholder="Nombre *" maxlength="60">
            <input id="su-field-desc"  class="su-input" placeholder="Descripción (opcional)" maxlength="120">
            <div class="su-label">Emoji</div>
            <div class="su-sticker-grid" id="su-landmark-emoji-grid"></div>
            <input id="su-field-custom-emoji" class="su-input" placeholder="O escribe tu emoji" maxlength="4">
            <div class="su-label">Color</div>
            <div class="su-color-row" id="su-color-row"></div>
          </div>

          <!-- STICKER FIELDS -->
          <div id="su-form-sticker-fields" style="display:none">
            <div class="su-label">Elige sticker</div>
            <div class="su-sticker-grid" id="su-sticker-grid"></div>
            <input id="su-field-sticker-custom" class="su-input" placeholder="O escribe emoji" maxlength="4">
            <div class="su-label">O sube imagen PNG</div>
            <div id="su-png-upload-area" style="border:2px dashed rgba(255,255,255,0.2);border-radius:12px;padding:12px;text-align:center;cursor:pointer;position:relative;">
              <input id="su-png-file-input" type="file" accept="image/png,image/webp,image/jpeg" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">
              <div id="su-png-preview" style="display:none;margin-bottom:6px;">
                <img id="su-png-img" style="width:56px;height:56px;object-fit:contain;border-radius:8px;">
              </div>
              <span id="su-png-label" style="font-size:12px;color:#9ca3af;">📁 Toca para subir</span>
            </div>
            <input id="su-field-sticker-label" class="su-input" placeholder="Etiqueta visible en mapa" maxlength="40" style="margin-top:8px;">
          </div>

          <!-- PLACE FIELDS -->
          <div id="su-form-place-fields" style="display:none">
            <input id="su-field-place-name"    class="su-input" placeholder="Nombre del lugar *" maxlength="80">
            <input id="su-field-place-address" class="su-input" placeholder="Dirección" maxlength="120">
            <input id="su-field-place-phone"   class="su-input" placeholder="Teléfono" maxlength="20">
            <input id="su-field-place-website" class="su-input" placeholder="Sitio web" maxlength="200">
            <select id="su-field-place-category" class="su-input">
              <option value="RESTAURANTS">Restaurantes</option>
              <option value="HEALTH">Salud & Estética</option>
              <option value="SHOPPING">Compras</option>
              <option value="ENTERTAINMENT">Entretenimiento</option>
              <option value="PARKS">Parques</option>
              <option value="WORKSHOPS">Talleres</option>
            </select>
          </div>

          <div class="su-coord-display" id="su-coord-display"></div>

          <div class="su-form-actions">
            <button class="su-btn su-btn-gray" id="su-form-cancel-btn">Cancelar</button>
            <button class="su-btn su-btn-cyan" id="su-form-save-btn">💾 Guardar</button>
          </div>
          <div id="su-form-error" class="su-form-error"></div>
        </div>
      </div>`;
    document.body.appendChild(m);

    // Poblar grids
    this._buildEmojiGrid('su-landmark-emoji-grid', '📍');
    this._buildEmojiGrid('su-sticker-grid', '⭐');
    this._buildColorRow();

    document.getElementById('su-form-close').addEventListener('click',       () => this._closeForm());
    document.getElementById('su-form-cancel-btn').addEventListener('click',  () => this._closeForm());
    document.getElementById('su-form-save-btn').addEventListener('click',    () => this._saveItem());

    // PNG upload
    document.getElementById('su-png-file-input').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this._pngDataUrl = ev.target.result;
        document.getElementById('su-png-img').src    = this._pngDataUrl;
        document.getElementById('su-png-preview').style.display = '';
        document.getElementById('su-png-label').textContent = file.name;
        document.querySelectorAll('#su-sticker-grid .su-emoji-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('su-field-sticker-custom').value = '';
      };
      reader.readAsDataURL(file);
    });
  }

  _buildEmojiGrid(containerId, defaultActive) {
    const grid = document.getElementById(containerId);
    STICKER_PRESETS.forEach(({ emoji, label }) => {
      const btn = document.createElement('button');
      btn.className = `su-emoji-btn${emoji === defaultActive ? ' active' : ''}`;
      btn.title = label;
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.su-emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      grid.appendChild(btn);
    });
  }

  _buildColorRow() {
    const row = document.getElementById('su-color-row');
    LANDMARK_COLORS.forEach((color, i) => {
      const btn = document.createElement('button');
      btn.className = `su-color-btn${i === 0 ? ' active' : ''}`;
      btn.dataset.color = color;
      btn.style.background = color;
      btn.addEventListener('click', () => {
        row.querySelectorAll('.su-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      row.appendChild(btn);
    });
  }

  _openForm(type) {
    this._currentFormType = type;
    this._pngDataUrl = null;

    document.getElementById('su-form-title').textContent = {
      landmark: '📍 Nuevo landmark',
      sticker:  '🎉 Nuevo sticker',
      place:    '🏪 Nuevo lugar',
    }[type] || 'Nuevo';

    document.getElementById('su-form-landmark-fields').style.display = type === 'landmark' ? '' : 'none';
    document.getElementById('su-form-sticker-fields').style.display  = type === 'sticker'  ? '' : 'none';
    document.getElementById('su-form-place-fields').style.display    = type === 'place'    ? '' : 'none';

    document.getElementById('su-coord-display').textContent =
      `📌 ${this.pendingLat?.toFixed(5)}, ${this.pendingLng?.toFixed(5)}`;
    document.getElementById('su-form-error').textContent = '';

    // Reset campos
    ['su-field-title','su-field-desc','su-field-custom-emoji',
     'su-field-sticker-custom','su-field-sticker-label',
     'su-field-place-name','su-field-place-address',
     'su-field-place-phone','su-field-place-website'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('su-png-preview').style.display = 'none';
    document.getElementById('su-png-label').textContent = '📁 Toca para subir';

    document.getElementById('su-form-modal').classList.add('visible');
  }

  _closeForm() {
    document.getElementById('su-form-modal').classList.remove('visible');
    this._editingId = null;
    this._pngDataUrl = null;
    this.pendingLat = null;
    this.pendingLng = null;
  }

  // ── Guardar ───────────────────────────────────────────────────────
  async _saveItem() {
    const saveBtn = document.getElementById('su-form-save-btn');
    const errorEl = document.getElementById('su-form-error');
    errorEl.textContent = '';
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Guardando...';

    try {
      const type = this._currentFormType;

      if (type === 'landmark' || type === 'sticker') {
        let emoji, title, description, color;

        if (type === 'landmark') {
          title = document.getElementById('su-field-title').value.trim();
          if (!title) throw new Error('El nombre es requerido');
          description = document.getElementById('su-field-desc').value.trim();
          const customEmoji = document.getElementById('su-field-custom-emoji').value.trim();
          emoji = customEmoji || document.querySelector('#su-landmark-emoji-grid .su-emoji-btn.active')?.textContent || '📍';
          color = document.querySelector('#su-color-row .su-color-btn.active')?.dataset.color || '#00bcd4';
        } else {
          const customEmoji = document.getElementById('su-field-sticker-custom').value.trim();
          emoji = customEmoji || document.querySelector('#su-sticker-grid .su-emoji-btn.active')?.textContent || '⭐';
          const stickerLabel = document.getElementById('su-field-sticker-label').value.trim();
          title = stickerLabel || emoji;
          color = '#00bcd4';
        }

        const iconUrl = this._pngDataUrl || null;
        const isEdit  = !!this._editingId;

        await LandmarkService[isEdit ? 'update' : 'create']({
          ...(isEdit ? { id: this._editingId } : { lat: this.pendingLat, lng: this.pendingLng }),
          type, title, description, emoji, color, icon_url: iconUrl,
        });

        await this._reloadLandmarks();

      } else if (type === 'place') {
        const name = document.getElementById('su-field-place-name').value.trim();
        if (!name) throw new Error('El nombre es requerido');

        await CustomPlaceService.create({
          name,
          formatted_address: document.getElementById('su-field-place-address').value.trim(),
          phone:    document.getElementById('su-field-place-phone').value.trim()   || null,
          website:  document.getElementById('su-field-place-website').value.trim() || null,
          category: document.getElementById('su-field-place-category').value,
          lat: this.pendingLat,
          lng: this.pendingLng,
        });
      }

      this._closeForm();
      this._showToast('✅ Guardado correctamente');

    } catch(err) {
      errorEl.textContent = '❌ ' + (err.message || 'Error al guardar');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Guardar';
    }
  }

  async _reloadLandmarks() {
    if (this.callbacks.onLandmarksUpdated) {
      const items = await LandmarkService.getAll();
      this.callbacks.onLandmarksUpdated(items);
    }
  }

  // ── Lista de landmarks ────────────────────────────────────────────
  _buildListPanel() {
    const p = document.createElement('div');
    p.id = 'su-list-panel';
    p.innerHTML = `
      <div class="su-panel-header">
        <span>📋 Landmarks</span>
        <button id="su-list-close">✕</button>
      </div>
      <div id="su-list-body" class="su-list-body"></div>`;
    document.body.appendChild(p);
    document.getElementById('su-list-close').addEventListener('click', () =>
      document.getElementById('su-list-panel').classList.remove('visible'));
  }

  async _openList() {
    this._togglePanel(false);
    const panel = document.getElementById('su-list-panel');
    const body  = document.getElementById('su-list-body');
    body.innerHTML = '<div class="su-hint">Cargando...</div>';
    panel.classList.add('visible');

    try {
      const items = await LandmarkService.getAll();
      if (!items.length) { body.innerHTML = '<div class="su-hint">No hay landmarks aún.</div>'; return; }

      body.innerHTML = '';
      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'su-list-row';
        row.innerHTML = `
          <span class="su-list-emoji">${item.icon_url
            ? `<img src="${item.icon_url}" style="width:28px;height:28px;object-fit:contain;">`
            : (item.emoji || '📍')}</span>
          <div class="su-list-info">
            <div class="su-list-name">${item.title || '—'}</div>
            <div class="su-list-meta">${item.type} · ${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="su-list-edit" data-id="${item.id}">✏️</button>
            <button class="su-list-del"  data-id="${item.id}">🗑️</button>
          </div>`;

        row.querySelector('.su-list-edit').addEventListener('click', () => {
          panel.classList.remove('visible');
          this._editLandmark(item);
        });
        row.querySelector('.su-list-del').addEventListener('click', async () => {
          if (!confirm(`¿Eliminar "${item.title}"?`)) return;
          await LandmarkService.delete(item.id);
          row.remove();
          await this._reloadLandmarks();
        });
        body.appendChild(row);
      });
    } catch(e) {
      body.innerHTML = `<div class="su-hint">❌ ${e.message}</div>`;
    }
  }

  _editLandmark(item) {
    this._editingId  = item.id;
    this.pendingLat  = item.lat;
    this.pendingLng  = item.lng;
    this._openForm(item.type);

    setTimeout(() => {
      if (item.type === 'landmark') {
        const titleEl = document.getElementById('su-field-title');
        const descEl  = document.getElementById('su-field-desc');
        if (titleEl) titleEl.value = item.title || '';
        if (descEl)  descEl.value  = item.description || '';
        // Seleccionar color
        document.querySelectorAll('#su-color-row .su-color-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.color === item.color);
        });
      }
    }, 50);
  }

  // ── Panel lugares custom ──────────────────────────────────────────
  _buildPlacesPanel() {
    const p = document.createElement('div');
    p.id = 'su-places-panel';
    p.innerHTML = `
      <div class="su-panel-header">
        <span>🏪 Lugares custom</span>
        <button id="su-places-close">✕</button>
      </div>
      <div id="su-places-body" class="su-list-body"></div>`;
    document.body.appendChild(p);
    document.getElementById('su-places-close').addEventListener('click', () =>
      document.getElementById('su-places-panel').classList.remove('visible'));
  }

  async _openPlaces() {
    this._togglePanel(false);
    const panel = document.getElementById('su-places-panel');
    const body  = document.getElementById('su-places-body');
    body.innerHTML = '<div class="su-hint">Cargando...</div>';
    panel.classList.add('visible');

    try {
      const places = await CustomPlaceService.getAll();
      if (!places.length) { body.innerHTML = '<div class="su-hint">No hay lugares custom aún.</div>'; return; }

      body.innerHTML = '';
      places.forEach(place => {
        const row = document.createElement('div');
        row.className = 'su-list-row';
        row.innerHTML = `
          <div class="su-list-info">
            <div class="su-list-name">${place.name}</div>
            <div class="su-list-meta">${place.category} · ${place.location?.lat?.toFixed(4)}, ${place.location?.lng?.toFixed(4)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="su-list-del" data-id="${place._customId}">🗑️</button>
          </div>`;

        row.querySelector('.su-list-del').addEventListener('click', async () => {
          if (!confirm(`¿Eliminar "${place.name}"?`)) return;
          await CustomPlaceService.delete(place._customId);
          row.remove();
        });
        body.appendChild(row);
      });
    } catch(e) {
      body.innerHTML = `<div class="su-hint">❌ ${e.message}</div>`;
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────
  _showToast(msg) {
    let t = document.getElementById('su-toast');
    if (!t) { t = document.createElement('div'); t.id = 'su-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 2500);
  }

  // ── Estilos ───────────────────────────────────────────────────────
  _injectStyles() {
    if (document.getElementById('su-styles')) return;
    const s = document.createElement('style');
    s.id = 'su-styles';
    s.textContent = `
      /* ── FAB ── */
      #su-fab {
        position: fixed;
        bottom: calc(26dvh + 16px);
        right: 16px;
        z-index: 500;
        width: 48px; height: 48px;
        border-radius: 50%;
        background: rgba(30,30,40,0.82);
        backdrop-filter: blur(8px);
        border: none;
        font-size: 22px;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.15s;
      }
      #su-fab:active { transform: scale(0.92); }

      /* ── Panel principal ── */
      #su-panel {
        display: none;
        position: fixed;
        bottom: calc(26dvh + 72px);
        right: 12px;
        z-index: 600;
        background: rgba(20,20,30,0.95);
        backdrop-filter: blur(12px);
        border-radius: 20px;
        padding: 0;
        min-width: 240px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        overflow: hidden;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }
      #su-panel.visible { display: block; animation: suSlideIn 0.2s ease; }
      @keyframes suSlideIn { from { opacity:0; transform:translateY(10px) scale(0.97); } to { opacity:1; transform:none; } }

      .su-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px;
        font-size: 14px; font-weight: 700; color: white;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .su-panel-header button {
        background: rgba(255,255,255,0.1); border: none; border-radius: 50%;
        width: 28px; height: 28px; color: white; cursor: pointer; font-size: 13px;
        display: flex; align-items: center; justify-content: center;
      }
      .su-panel-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; }

      /* ── Botones del panel ── */
      .su-btn {
        padding: 11px 14px; border: none; border-radius: 12px;
        font-size: 13px; font-weight: 600; cursor: pointer; text-align: left;
        transition: opacity 0.15s; -webkit-tap-highlight-color: transparent;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }
      .su-btn:active { opacity: 0.8; }
      .su-btn-cyan   { background: linear-gradient(135deg,#06b6d4,#0891b2); color:white; }
      .su-btn-purple { background: linear-gradient(135deg,#8b5cf6,#7c3aed); color:white; }
      .su-btn-gray   { background: rgba(255,255,255,0.1); color:white; }
      .su-btn-teal   { background: linear-gradient(135deg,#10b981,#059669); color:white; }
      .su-btn-places { background: linear-gradient(135deg,#f59e0b,#d97706); color:white; }

      .su-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 2px 0; }
      .su-hint { font-size: 11px; color: rgba(255,255,255,0.4); padding: 4px 2px; }

      /* ── Pick banner ── */
      #su-pick-banner {
        display: none;
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        z-index: 700;
        background: rgba(20,20,30,0.95);
        backdrop-filter: blur(10px);
        border-radius: 50px;
        padding: 12px 20px;
        gap: 12px;
        align-items: center;
        font-size: 14px; font-weight: 600; color: white;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        white-space: nowrap;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }
      #su-pick-banner.visible { display: flex; animation: suSlideIn 0.2s ease; }
      #su-pick-cancel {
        background: rgba(255,255,255,0.15); border: none; border-radius: 50px;
        padding: 6px 14px; color: white; font-size: 13px; cursor: pointer;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }

      /* ── Form modal ── */
      #su-form-modal {
        display: none;
        position: fixed; inset: 0; z-index: 800;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        align-items: flex-end; justify-content: center;
      }
      #su-form-modal.visible { display: flex; }

      .su-form-card {
        background: #1a1a2e;
        border-radius: 24px 24px 0 0;
        width: 100%; max-width: 480px;
        max-height: 85dvh;
        display: flex; flex-direction: column;
        animation: authSlideUp 0.3s ease;
      }
      .su-form-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 20px 12px;
        font-size: 16px; font-weight: 700; color: white; flex-shrink: 0;
      }
      .su-form-header button {
        background: rgba(255,255,255,0.1); border: none; border-radius: 50%;
        width: 32px; height: 32px; color: white; cursor: pointer; font-size: 14px;
        display: flex; align-items: center; justify-content: center;
      }
      .su-form-scroll { flex: 1; overflow-y: auto; padding: 0 20px 32px; }

      .su-input {
        width: 100%; padding: 12px 14px; background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
        color: white; font-size: 14px; outline: none; margin-bottom: 8px;
        font-family: 'Inter Tight', system-ui, sans-serif;
        box-sizing: border-box;
      }
      .su-input:focus { border-color: #06b6d4; }
      .su-input option { background: #1a1a2e; color: white; }

      .su-label { font-size: 12px; color: rgba(255,255,255,0.5); margin: 8px 0 6px; font-weight: 600; }

      .su-sticker-grid {
        display: grid; grid-template-columns: repeat(6,1fr); gap: 6px; margin-bottom: 8px;
      }
      .su-emoji-btn {
        padding: 8px; background: rgba(255,255,255,0.07); border: 2px solid transparent;
        border-radius: 10px; font-size: 18px; cursor: pointer; text-align: center;
        transition: all 0.15s;
      }
      .su-emoji-btn.active { border-color: #06b6d4; background: rgba(6,182,212,0.15); }

      .su-color-row { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
      .su-color-btn {
        width: 32px; height: 32px; border-radius: 50%; border: 3px solid transparent;
        cursor: pointer; transition: transform 0.15s, border-color 0.15s;
      }
      .su-color-btn.active { border-color: white; transform: scale(1.15); }

      .su-coord-display { font-size: 11px; color: rgba(255,255,255,0.4); margin: 8px 0; }

      .su-form-actions { display: flex; gap: 10px; margin-top: 16px; }
      .su-form-actions .su-btn { flex: 1; text-align: center; }
      .su-form-error { font-size: 13px; color: #f87171; margin-top: 8px; min-height: 18px; }

      /* ── Paneles laterales (list, places) ── */
      #su-list-panel, #su-places-panel {
        display: none;
        position: fixed; inset: 0; z-index: 750;
        background: #1a1a2e;
        flex-direction: column;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }
      #su-list-panel.visible, #su-places-panel.visible { display: flex; }

      .su-list-body { flex: 1; overflow-y: auto; padding: 8px 16px 32px; }
      .su-list-row {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .su-list-emoji { font-size: 24px; flex-shrink: 0; }
      .su-list-info { flex: 1; min-width: 0; }
      .su-list-name { font-size: 14px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .su-list-meta { font-size: 11px; color: rgba(255,255,255,0.4); }
      .su-list-edit, .su-list-del {
        background: rgba(255,255,255,0.07); border: none; border-radius: 8px;
        padding: 6px 10px; font-size: 14px; cursor: pointer; color: white;
      }
      .su-list-del:active { background: rgba(239,68,68,0.3); }

      /* ── Toast ── */
      #su-toast {
        display: none;
        position: fixed; bottom: calc(26dvh + 16px); left: 50%; transform: translateX(-50%);
        z-index: 900;
        background: rgba(20,20,30,0.95);
        color: white; font-size: 14px; font-weight: 600;
        padding: 12px 20px; border-radius: 50px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        white-space: nowrap;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }
      #su-toast.visible { display: block; animation: suSlideIn 0.2s ease; }
    `;
    document.head.appendChild(s);
  }
}
