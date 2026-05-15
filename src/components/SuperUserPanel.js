// ============================================================
// SuperUserPanel.js
// Panel flotante de administración — solo visible para superusuario
// ============================================================

import { LandmarkService, PlaceModService, CustomPlaceService, isSuperUser } from '/src/services/SuperUserService.js';
import {
  getCategories, getSubcategories,
  upsertCategory, upsertSubcategory,
  deleteCategory, deleteSubcategory,
  toggleCategoryVisible, toggleSubcategoryVisible,
  reorderCategories, reorderSubcategories,
  invalidateCache
} from '/src/services/CategoryService.js';

const STICKER_PRESETS = [
  { emoji: '⭐', label: 'Destacado' },
  { emoji: '🔥', label: 'Popular' },
  { emoji: '🎉', label: 'Evento' },
  { emoji: '📍', label: 'Punto clave' },
  { emoji: '🏛️', label: 'Monumento' },
  { emoji: '🛑', label: 'Alerta' },
  { emoji: '💎', label: 'Exclusivo' },
  { emoji: '🎵', label: 'Música' },
  { emoji: '🌮', label: 'Comida' },
  { emoji: '🍹', label: 'Bar' },
  { emoji: '🛍️', label: 'Tienda' },
  { emoji: '📸', label: 'Foto spot' },
];

const LANDMARK_COLORS = [
  '#00bcd4', '#2563eb', '#f59e0b', '#10b981', '#ef4444', '#ec4899',
];

export class SuperUserPanel {
  constructor(mapView, callbacks = {}) {
    this.mapView    = mapView;
    this.callbacks  = callbacks;  // { onLandmarksUpdated }
    this.isVisible  = false;
    this.pickMode   = null;       // null | 'landmark' | 'sticker'
    this.pendingLat = null;
    this.pendingLng = null;
    this._el        = null;
    this._fabEl     = null;
    this._formEl    = null;
    this._landmarks = [];
  }

  // ── Montar el panel en el DOM ──────────────────────────────
  mount() {
    this._injectStyles();
    this._buildFAB();
    this._buildPanel();
    this._buildPickBanner();
    this._buildForm();
    this._buildListPanel();
    this._buildCategoriesPanel();
  }

  unmount() {
    ['su-fab','su-panel','su-pick-banner','su-form-modal','su-list-panel','su-cat-panel','su-subcat-panel','su-cat-form-modal']
      .forEach(id => document.getElementById(id)?.remove());
  }

  // ── FAB: botón redondo ⚙️ para abrir panel ─────────────────
  _buildFAB() {
    const fab = document.createElement('button');
    fab.id = 'su-fab';
    fab.innerHTML = '⚙️';
    fab.title = 'Panel Admin';
    fab.addEventListener('click', () => { this.mapView?.haptic('snap'); this._togglePanel(); });
    document.body.appendChild(fab);
    this._fabEl = fab;
  }

  // ── Panel principal ────────────────────────────────────────
  _buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'su-panel';
    panel.innerHTML = `
      <div class="su-panel-header">
        <span>🛡️ SuperUser Panel</span>
        <button id="su-panel-close">✕</button>
      </div>
      <div class="su-panel-body">
        <button class="su-btn su-btn-cyan" id="su-btn-add-landmark">
          📍 Agregar punto de referencia
        </button>
        <button class="su-btn su-btn-purple" id="su-btn-add-sticker">
          🎉 Agregar sticker al mapa
        </button>
        <button class="su-btn su-btn-gray" id="su-btn-view-list">
          📋 Gestionar landmarks
        </button>
        <button class="su-btn su-btn-orange" id="su-btn-categories">
          🗂️ Categorías y subcategorías
        </button>
        <button class="su-btn su-btn-teal" id="su-btn-places">
          🏪 Agregar lugar
        </button>
        <button class="su-btn su-btn-orange" id="su-btn-reposition" style="background:linear-gradient(135deg,#f59e0b,#ef4444);">
          🎯 Reposicionar lugares
        </button>
        <div class="su-divider"></div>
        <div class="su-hint">Toca el botón, luego toca el mapa para colocar el elemento.</div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('su-panel-close').addEventListener('click', () => { this.mapView?.haptic('light'); this._togglePanel(false); });
    document.getElementById('su-btn-add-landmark').addEventListener('click', () => { this.mapView?.haptic('tap'); this._startPick('landmark'); });
    document.getElementById('su-btn-add-sticker').addEventListener('click', () => { this.mapView?.haptic('tap'); this._startPick('sticker'); });
    document.getElementById('su-btn-view-list').addEventListener('click', () => { this.mapView?.haptic('light'); this._openList(); });
    document.getElementById('su-btn-categories').addEventListener('click', () => { this.mapView?.haptic('light'); this._openCategories(); });
    document.getElementById('su-btn-places').addEventListener('click', () => { this.mapView?.haptic('light'); this._openPlaces(); });
    document.getElementById('su-btn-reposition').addEventListener('click', () => {
      this.mapView?.haptic('tap');
      this._togglePanel(false);
      this.mapView?.enableDragMode?.();
    });
  }

  // ── Banner pick mode ───────────────────────────────────────
  _buildPickBanner() {
    const banner = document.createElement('div');
    banner.id = 'su-pick-banner';
    banner.innerHTML = `
      <span id="su-pick-text">Toca el mapa para colocar</span>
      <button id="su-pick-cancel">Cancelar</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('su-pick-cancel').addEventListener('click', () => this._cancelPick());
  }

  // ── Formulario de creación ─────────────────────────────────
  _buildForm() {
    const modal = document.createElement('div');
    modal.id = 'su-form-modal';
    modal.innerHTML = `
      <div class="su-form-card">
        <div class="su-form-header">
          <span id="su-form-title">Nuevo landmark</span>
          <button id="su-form-close">✕</button>
        </div>

        <div class="su-form-scroll">
        <div id="su-form-landmark-fields">
          <input id="su-field-title" class="su-input" placeholder="Nombre del punto *" maxlength="60">
          <input id="su-field-desc"  class="su-input" placeholder="Descripción (opcional)" maxlength="120">
          <div class="su-label">Emoji representativo</div>
          <div class="su-sticker-grid" id="su-landmark-emoji-grid"></div>
          <input id="su-field-custom-emoji" class="su-input" placeholder="O escribe tu emoji aquí" maxlength="4">
          <div class="su-label">Color del marcador</div>
          <div class="su-color-row" id="su-color-row"></div>
        </div>

        <div id="su-form-sticker-fields">
          <div class="su-label">Elige un sticker</div>
          <div class="su-sticker-grid" id="su-sticker-grid"></div>
          <input id="su-field-sticker-custom" class="su-input" placeholder="O escribe tu emoji aquí" maxlength="4">
          <div class="su-label" style="display:flex;align-items:center;justify-content:space-between;">
            <span>O sube tu propia imagen PNG</span>
          </div>
          <div id="su-png-upload-area" style="border:2px dashed rgba(255,255,255,0.2);border-radius:12px;padding:12px;text-align:center;cursor:pointer;margin-bottom:10px;color:#6b7280;font-size:12px;position:relative;">
            <input id="su-png-file-input" type="file" accept="image/png,image/webp,image/jpg,image/jpeg,image/gif" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">
            <div id="su-png-preview" style="display:none;margin-bottom:6px;">
              <img id="su-png-img" style="width:56px;height:56px;object-fit:contain;border-radius:8px;">
            </div>
            <span id="su-png-label">📁 Toca para subir PNG/WebP</span>
          </div>
          <input id="su-field-sticker-label" class="su-input" placeholder="Etiqueta (se muestra junto al sticker)" maxlength="40">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <label class="su-toggle-wrap">
              <input type="checkbox" id="su-field-show-label" checked>
              <span class="su-toggle-slider"></span>
            </label>
            <span class="su-label" style="margin:0;">Mostrar etiqueta en mapa</span>
          </div>
          <div class="su-label">Visible en categorías</div>
          <div id="su-cat-chips-row" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;"></div>
          <div class="su-label">Tamaño</div>
          <div class="su-size-row" id="su-size-row">
            <button class="su-size-btn" data-size="mini">Mini</button>
            <button class="su-size-btn active" data-size="normal">Normal</button>
            <button class="su-size-btn" data-size="destacado">Destacado</button>
          </div>
          <div class="su-label">Borde / pegatina (opcional)</div>
          <div class="su-border-row" id="su-border-row"></div>
        </div>

        <div class="su-coord-display" id="su-coord-display"></div>

        <div class="su-form-actions">
          <button class="su-btn su-btn-gray" id="su-form-cancel-btn">Cancelar</button>
          <button class="su-btn su-btn-cyan" id="su-form-save-btn">💾 Guardar</button>
        </div>
        <div id="su-form-error" class="su-form-error"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Poblar grids
    this._buildEmojiGrid('su-landmark-emoji-grid', '📍');
    this._buildEmojiGrid('su-sticker-grid', '⭐');
    this._buildColorRow();

    this._buildSizeRow();
    this._buildBorderRow();

    document.getElementById('su-form-close').addEventListener('click', () => this._closeForm());
    document.getElementById('su-form-cancel-btn').addEventListener('click', () => this._closeForm());
    document.getElementById('su-form-save-btn').addEventListener('click', () => this._saveItem());
    // PNG file picker
    this._pngDataUrl = null;
    document.getElementById('su-png-file-input').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this._pngDataUrl = ev.target.result;
        const img = document.getElementById('su-png-img');
        const preview = document.getElementById('su-png-preview');
        const label = document.getElementById('su-png-label');
        if (img) img.src = this._pngDataUrl;
        if (preview) preview.style.display = '';
        if (label) label.textContent = file.name;
        // Desactivar selección de emoji cuando hay PNG
        document.querySelectorAll('#su-sticker-grid .su-emoji-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('su-field-sticker-custom').value = '';
      };
      reader.readAsDataURL(file);
    });

    this._formEl = modal;
  }

  _buildCatChips() {
    const row = document.getElementById('su-cat-chips-row');
    if (!row) return Promise.resolve();
    row.innerHTML = '<div style="color:#6b7280;font-size:11px;padding:4px;">Cargando...</div>';
    const buildChips = (cats) => {
      row.innerHTML = '';
      const allChip = document.createElement('button');
      allChip.className = 'su-cat-chip active'; allChip.dataset.catKey = 'all';
      allChip.textContent = '🌐 Todas';
      allChip.addEventListener('click', () => {
        const isActive = allChip.classList.toggle('active');
        if (isActive) row.querySelectorAll('.su-cat-chip:not([data-cat-key="all"])').forEach(c => c.classList.remove('active'));
      });
      row.appendChild(allChip);
      cats.forEach(cat => {
        const chip = document.createElement('button');
        chip.className = 'su-cat-chip'; chip.dataset.catKey = cat.key || cat.menuKey || cat.id;
        chip.textContent = (cat.emoji||'') + ' ' + (cat.label_es||cat.displayNameES||cat.key||'');
        chip.addEventListener('click', () => {
          chip.classList.toggle('active');
          if (!!row.querySelector('.su-cat-chip:not([data-cat-key="all"]).active')) allChip.classList.remove('active');
          else allChip.classList.add('active');
        });
        row.appendChild(chip);
      });
    };
    const fallback = [
      {key:'RESTAURANTS',emoji:'🍔',label_es:'Restaurantes'},
      {key:'HEALTH',emoji:'🩺',label_es:'Salud & Estética'},
      {key:'SHOPPING',emoji:'🛍️',label_es:'Compras'},
      {key:'ENTERTAINMENT',emoji:'🎈',label_es:'Entretenimiento'},
      {key:'PARKS',emoji:'🌵',label_es:'Parques'},
      {key:'WORKSHOPS',emoji:'🔧',label_es:'Talleres'},
    ];
    return getCategories().then(cats=>buildChips(cats.length?cats:fallback)).catch(()=>buildChips(fallback));
  }
  _getSelectedCats() {
    const row = document.getElementById('su-cat-chips-row');
    if (!row) return null;
    const allActive = row.querySelector('[data-cat-key="all"].active');
    if (allActive) return null; // null = todas
    const selected = [...row.querySelectorAll('.su-cat-chip:not([data-cat-key="all"]).active')].map(c => c.dataset.catKey);
    return selected.length ? selected : null;
  }

  _buildEmojiGrid(containerId, defaultActive) {
    const grid = document.getElementById(containerId);
    STICKER_PRESETS.forEach(({ emoji, label }) => {
      const btn = document.createElement('button');
      btn.className = 'su-emoji-btn' + (emoji === defaultActive ? ' active' : '');
      btn.title = label;
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.su-emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      grid.appendChild(btn);
    });
  }

  _buildSizeRow() {
    const row = document.getElementById('su-size-row');
    if (!row) return;
    row.querySelectorAll('.su-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.su-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  _buildBorderRow() {
    const BORDER_COLORS = [
      { color: null,      label: 'Sin borde' },
      { color: '#ffffff', label: 'Blanco' },
      { color: '#000000', label: 'Negro' },
      { color: '#f59e0b', label: 'Dorado' },
      { color: '#ef4444', label: 'Rojo' },
      { color: '#2563eb', label: 'Morado' },
      { color: '#00bcd4', label: 'Cyan' },
    ];
    const row = document.getElementById('su-border-row');
    if (!row) return;
    BORDER_COLORS.forEach(({ color, label }, i) => {
      const btn = document.createElement('button');
      btn.className = 'su-color-btn' + (i === 0 ? ' active' : '');
      btn.dataset.borderColor = color || '';
      btn.title = label;
      btn.style.cssText = color
        ? 'width:28px;height:28px;border-radius:50%;background:' + color + ';border:2px solid #555;flex-shrink:0;cursor:pointer;'
        : 'width:28px;height:28px;border-radius:50%;background:repeating-linear-gradient(45deg,#ccc 0,#ccc 4px,#fff 4px,#fff 8px);border:2px solid #555;flex-shrink:0;cursor:pointer;';
      btn.addEventListener('click', () => {
        row.querySelectorAll('.su-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      row.appendChild(btn);
    });
  }

  _buildColorRow() {
    const row = document.getElementById('su-color-row');
    LANDMARK_COLORS.forEach((color, i) => {
      const btn = document.createElement('button');
      btn.className = 'su-color-btn' + (i === 0 ? ' active' : '');
      btn.style.background = color;
      btn.dataset.color = color;
      btn.addEventListener('click', () => {
        row.querySelectorAll('.su-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      row.appendChild(btn);
    });
  }

  // ── Panel lista de landmarks ───────────────────────────────
  _buildListPanel() {
    const panel = document.createElement('div');
    panel.id = 'su-list-panel';
    panel.innerHTML = `
      <div class="su-panel-header">
        <span>📋 Landmarks en el mapa</span>
        <button id="su-list-close">✕</button>
      </div>
      <div id="su-list-body" class="su-list-body">
        <div class="su-hint">Cargando...</div>
      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('su-list-close').addEventListener('click', () => {
      document.getElementById('su-list-panel').classList.remove('visible');
    });
  }

  // ── Pick mode: escuchar click en mapa ──────────────────────
  _startPick(type) {
    this.pickMode = type;
    this._togglePanel(false);
    const banner = document.getElementById('su-pick-banner');
    document.getElementById('su-pick-text').textContent =
      type === 'landmark' ? '📍 Toca el mapa donde va el punto de referencia'
                          : '🎉 Toca el mapa donde va el sticker';
    banner.classList.add('visible');

    // Listener en el mapa
    this._mapClickHandler = (e) => {
      this.pendingLat = e.lngLat.lat;
      this.pendingLng = e.lngLat.lng;
      this._editingId = null; // nuevo item, no edición
      this._cancelPick();
      this._openForm(type);
    };
    this.mapView.map.once('click', this._mapClickHandler);
    // Cursor crosshair
    this.mapView.map.getCanvas().style.cursor = 'crosshair';
  }

  _cancelPick() {
    document.getElementById('su-pick-banner').classList.remove('visible');
    this.mapView.map.getCanvas().style.cursor = '';
    if (this._mapClickHandler) {
      this.mapView.map.off('click', this._mapClickHandler);
      this._mapClickHandler = null;
    }
  }

  // ── Abrir formulario ───────────────────────────────────────
  async _openForm(type) {
    const modal = document.getElementById('su-form-modal');
    document.getElementById('su-form-title').textContent =
      type === 'landmark' ? '📍 Nuevo punto de referencia' : '🎉 Nuevo sticker';
    document.getElementById('su-form-landmark-fields').style.display = type === 'landmark' ? '' : 'none';
    document.getElementById('su-form-sticker-fields').style.display  = type === 'sticker'  ? '' : 'none';
    document.getElementById('su-coord-display').textContent =
      `📌 ${this.pendingLat?.toFixed(5)}, ${this.pendingLng?.toFixed(5)}`;
    document.getElementById('su-form-error').textContent = '';
    // Reset campos
    document.getElementById('su-field-title').value = '';
    document.getElementById('su-field-desc').value  = '';
    document.getElementById('su-field-custom-emoji').value = '';
    document.getElementById('su-field-sticker-custom').value = '';
    // Resetear PNG upload
    this._pngDataUrl = null;
    const pngPreview = document.getElementById('su-png-preview');
    const pngLabel = document.getElementById('su-png-label');
    const pngInput = document.getElementById('su-png-file-input');
    if (pngPreview) pngPreview.style.display = 'none';
    if (pngLabel) pngLabel.textContent = '📁 Toca para subir PNG/WebP';
    if (pngInput) pngInput.value = '';
    // Resetear label fields
    const stickerLabelEl = document.getElementById('su-field-sticker-label');
    const showLabelEl = document.getElementById('su-field-show-label');
    if (stickerLabelEl) stickerLabelEl.value = '';
    if (showLabelEl) showLabelEl.checked = true;
    // Cargar chips de categorías
    await this._buildCatChips();
    modal.classList.add('visible');
    this._currentFormType = type;
  }

  _closeForm() {
    document.getElementById('su-form-modal').classList.remove('visible');
    this.pendingLat = null; this.pendingLng = null;
  }

  // ── Guardar ────────────────────────────────────────────────
  async _saveItem() {
    const saveBtn = document.getElementById('su-form-save-btn');
    const errorEl = document.getElementById('su-form-error');
    errorEl.textContent = '';
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Guardando...';

    try {
      const type = this._currentFormType;

      let emoji, title, description, color;

      if (type === 'landmark') {
        title = document.getElementById('su-field-title').value.trim();
        if (!title) throw new Error('El nombre es requerido');
        description = document.getElementById('su-field-desc').value.trim();
        const customEmoji = document.getElementById('su-field-custom-emoji').value.trim();
        emoji = customEmoji ||
          document.querySelector('#su-landmark-emoji-grid .su-emoji-btn.active')?.textContent || '📍';
        color = document.querySelector('#su-color-row .su-color-btn.active')?.dataset.color || '#00bcd4';
      } else {
        const customEmoji = document.getElementById('su-field-sticker-custom').value.trim();
        emoji = customEmoji ||
          document.querySelector('#su-sticker-grid .su-emoji-btn.active')?.textContent || '⭐';
        // Label personalizada para el sticker
        const stickerLabelVal = (document.getElementById('su-field-sticker-label')?.value || '').trim();
        title = stickerLabelVal || emoji;
        color = '#00bcd4';
      }
      // PNG propio: se guarda como icon_url (base64 data URL)
      const iconUrl = this._pngDataUrl || null;
      // Label visible en mapa
      const showLabel = document.getElementById('su-field-show-label')?.checked ?? true;
      // Categorías seleccionadas (null = todas)
      const visibleInCats = this._getSelectedCats();

      const size = document.querySelector('#su-size-row .su-size-btn.active')?.dataset.size || 'normal';
      const borderColorVal = document.querySelector('#su-border-row .su-color-btn.active')?.dataset.borderColor || null;

      const isEdit = !!this._editingId;
      await LandmarkService[isEdit ? 'update' : 'create']({
        ...(isEdit ? { id: this._editingId } : { lat: this.pendingLat, lng: this.pendingLng }),
        type, title, description, emoji, color,
        size, border_color: borderColorVal || null,
        icon_url: iconUrl || null,
        show_label: showLabel,
        visible_in_categories: visibleInCats,
      });

      this._closeForm();
      await this._reloadLandmarks();

    } catch (err) {
      errorEl.textContent = '❌ ' + (err.message || 'Error al guardar');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Guardar';
    }
  }

  // ── Lista admin ────────────────────────────────────────────
  async _openList() {
    this._togglePanel(false);
    const panel = document.getElementById('su-list-panel');
    const body  = document.getElementById('su-list-body');
    body.innerHTML = '<div class="su-hint">Cargando...</div>';
    panel.classList.add('visible');

    try {
      const items = await LandmarkService.getAll();
      if (!items.length) {
        body.innerHTML = '<div class="su-hint">No hay landmarks aún.</div>';
        return;
      }
      body.innerHTML = '';
      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'su-list-row';
        const visLabel = item.visible === false ? ' · 👁️‍🗨️ oculto' : '';
        row.innerHTML = `
          <span class="su-list-emoji">${item.icon_url ? '<img src="' + item.icon_url + '" style="width:28px;height:28px;object-fit:contain;">' : (item.emoji || '📍')}</span>
          <div class="su-list-info">
            <div class="su-list-name">${item.title || '—'}</div>
            <div class="su-list-meta">${item.type}${visLabel} · ${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="su-list-edit" data-id="${item.id}" title="Editar">✏️</button>
            <button class="su-list-toggle" data-id="${item.id}" data-visible="${item.visible !== false}" title="${item.visible === false ? 'Mostrar' : 'Ocultar'}">${item.visible === false ? '👁️' : '🙈'}</button>
            <button class="su-list-del" data-id="${item.id}" title="Eliminar">🗑️</button>
          </div>
        `;
        row.querySelector('.su-list-edit').addEventListener('click', () => {
          document.getElementById('su-list-panel').classList.remove('visible');
          this._editLandmark(item);
        });
        row.querySelector('.su-list-toggle').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          const id = btn.dataset.id;
          const nowVisible = btn.dataset.visible === 'true';
          await LandmarkService.update({ id, visible: !nowVisible });
          btn.dataset.visible = String(!nowVisible);
          btn.title = !nowVisible ? 'Ocultar' : 'Mostrar';
          btn.textContent = !nowVisible ? '🙈' : '👁️';
          await this._reloadLandmarks();
        });
        row.querySelector('.su-list-del').addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          if (!confirm('¿Eliminar este landmark?')) return;
          await LandmarkService.delete(id);
          row.remove();
          await this._reloadLandmarks();
        });
        body.appendChild(row);
      });
    } catch (err) {
      body.innerHTML = `<div class="su-hint">Error: ${err.message}</div>`;
    }
  }

  // ── Editar un landmark existente ──────────────────────────
  _editLandmark(item) {
    this._editingId = item.id;
    this._currentFormType = item.type || 'sticker';
    this.pendingLat = item.lat;
    this.pendingLng = item.lng;
    this._openForm(item.type || 'sticker');

    // Pre-rellenar campos
    if (item.type === 'landmark') {
      const titleEl = document.getElementById('su-field-title');
      const descEl = document.getElementById('su-field-desc');
      if (titleEl) titleEl.value = item.title || '';
      if (descEl) descEl.value = item.description || '';
      // Color del marcador
      const colorBtns = document.querySelectorAll('#su-color-row .su-color-btn');
      colorBtns.forEach(b => b.classList.toggle('active', b.dataset.color === item.color));
    } else {
      // Sticker
      const customEl = document.getElementById('su-field-sticker-custom');
      const labelEl = document.getElementById('su-field-sticker-label');
      const showLabelEl = document.getElementById('su-field-show-label');
      if (customEl) customEl.value = item.emoji || '';
      if (labelEl) labelEl.value = (item.title !== item.emoji ? item.title : '') || '';
      if (showLabelEl) showLabelEl.checked = item.show_label !== false;
      // Si tiene PNG, mostrar preview
      if (item.icon_url) {
        this._pngDataUrl = item.icon_url;
        const img = document.getElementById('su-png-img');
        const preview = document.getElementById('su-png-preview');
        const lblEl = document.getElementById('su-png-label');
        if (img) img.src = item.icon_url;
        if (preview) preview.style.display = '';
        if (lblEl) lblEl.textContent = 'Imagen actual';
      }
      // Categorías
      if (item.visible_in_categories) {
        const row = document.getElementById('su-cat-chips-row');
        if (row) {
          row.querySelector('[data-cat-key="all"]')?.classList.remove('active');
          item.visible_in_categories.forEach(key => {
            row.querySelector('[data-cat-key="' + key + '"]')?.classList.add('active');
          });
        }
      }
    }
    // Tamaño y borde
    document.querySelectorAll('#su-size-row .su-size-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.size === (item.size || 'normal'));
    });
    const borderBtns = document.querySelectorAll('#su-border-row .su-color-btn');
    borderBtns.forEach(b => b.classList.toggle('active', b.dataset.borderColor === item.border_color));
    // Actualizar título del form
    const titleSpan = document.getElementById('su-form-title');
    if (titleSpan) titleSpan.textContent = '✏️ Editar ' + (item.type === 'landmark' ? 'landmark' : 'sticker');
  }

  // ── Recargar landmarks en el mapa ──────────────────────────
  async _reloadLandmarks() {
    try {
      const items = await LandmarkService.getAll();
      this._landmarks = items;
      this.mapView._renderLandmarks(items);
      this.callbacks.onLandmarksUpdated?.(items);
    } catch (err) {
      console.error('Error recargando landmarks:', err);
    }
  }

  // ══════════════════════════════════════════════════════════
  // CATEGORÍAS
  // ══════════════════════════════════════════════════════════

  _buildCategoriesPanel() {
    // Panel principal de categorías
    const panel = document.createElement('div');
    panel.id = 'su-cat-panel';
    panel.innerHTML = '<div class="su-panel-header">'
      + '<span>🗂️ Categorías</span>'
      + '<button id="su-cat-close">✕</button>'
      + '</div>'
      + '<div class="su-cat-toolbar">'
      + '<button class="su-btn su-btn-cyan su-btn-sm" id="su-cat-add">+ Nueva categoría</button>'
      + '</div>'
      + '<div id="su-cat-body" class="su-list-body"><div class="su-hint">Cargando...</div></div>';
    document.body.appendChild(panel);
    document.getElementById('su-cat-close').addEventListener('click', () => {
      document.getElementById('su-cat-panel').classList.remove('visible');
    });
    document.getElementById('su-cat-add').addEventListener('click', () => this._openCatForm(null));

    // Panel de subcategorías
    const subPanel = document.createElement('div');
    subPanel.id = 'su-subcat-panel';
    subPanel.innerHTML = '<div class="su-panel-header">'
      + '<button id="su-subcat-back">← Volver</button>'
      + '<span id="su-subcat-title">Subcategorías</span>'
      + '<button id="su-subcat-close">✕</button>'
      + '</div>'
      + '<div class="su-cat-toolbar">'
      + '<button class="su-btn su-btn-cyan su-btn-sm" id="su-subcat-add">+ Nueva subcategoría</button>'
      + '</div>'
      + '<div id="su-subcat-body" class="su-list-body"><div class="su-hint">Cargando...</div></div>';
    document.body.appendChild(subPanel);
    document.getElementById('su-subcat-back').addEventListener('click', () => {
      document.getElementById('su-subcat-panel').classList.remove('visible');
    });
    document.getElementById('su-subcat-close').addEventListener('click', () => {
      document.getElementById('su-subcat-panel').classList.remove('visible');
      document.getElementById('su-cat-panel').classList.remove('visible');
    });
    document.getElementById('su-subcat-add').addEventListener('click', () => {
      this._openCatForm(null, true);
    });

    // Modal de formulario cat/subcat
    const modal = document.createElement('div');
    modal.id = 'su-cat-form-modal';
    modal.innerHTML = '<div class="su-form-card">'
      + '<div class="su-form-header">'
      + '<span id="su-cat-form-title">Nueva categoría</span>'
      + '<button id="su-cat-form-close">✕</button>'
      + '</div>'
      + '<div class="su-form-scroll">'
      + '<input id="su-cat-f-label-es" class="su-input" placeholder="Nombre ES *" maxlength="40">'
      + '<input id="su-cat-f-label-en" class="su-input" placeholder="Nombre EN *" maxlength="40">'
      + '<input id="su-cat-f-emoji"    class="su-input" placeholder="Emoji (ej: 🍔)" maxlength="4">'
      + '<div class="su-label">Ícono 3D (Fluent3D URL)</div>'
      + '<input id="su-cat-f-icon3d" class="su-input" placeholder="https://raw.githubusercontent.com/microsoft/..." style="font-size:11px;">'
      + '<div style="color:#00bcd4;font-size:10px;margin-bottom:8px;">github.com/microsoft/fluentui-emoji → assets/Tu-emoji/3D/nombre_3d.png</div>'
      + '<div id="su-cat-f-icon3d-preview" style="display:none;margin-bottom:10px;"><img id="su-cat-f-icon3d-img" style="width:40px;height:40px;object-fit:contain;"></div>'
      + '<div id="su-cat-f-key-row">'
      + '<input id="su-cat-f-key" class="su-input" placeholder="KEY (ej: RESTAURANTS)" maxlength="30" style="text-transform:uppercase">'
      + '</div>'
      + '<div id="su-cat-f-subfields" style="display:none">'
      + '<input id="su-cat-f-value"    class="su-input" placeholder="value slug (ej: taco)" maxlength="30">'
      + '<input id="su-cat-f-query-es" class="su-input" placeholder="Query de búsqueda en ES" maxlength="120">'
      + '</div>'
      + '<div class="su-label">Color tema</div>'
      + '<div id="su-cat-f-color-row" class="su-cat-color-row"></div>'
      + '<div class="su-form-actions">'
      + '<button class="su-btn su-btn-gray" id="su-cat-form-cancel">Cancelar</button>'
      + '<button class="su-btn su-btn-cyan" id="su-cat-form-save">💾 Guardar</button>'
      + '</div>'
      + '<div id="su-cat-form-error" class="su-form-error"></div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(modal);

    document.getElementById('su-cat-form-close').addEventListener('click', () => this._closeCatForm());
    document.getElementById('su-cat-form-cancel').addEventListener('click', () => this._closeCatForm());
    document.getElementById('su-cat-form-save').addEventListener('click', () => this._saveCatForm());
    // Preview en tiempo real del ícono 3D
    document.getElementById('su-cat-f-icon3d').addEventListener('input', (e) => {
      const url = e.target.value.trim();
      const preview = document.getElementById('su-cat-f-icon3d-preview');
      const img = document.getElementById('su-cat-f-icon3d-img');
      if (url && preview && img) {
        img.src = url;
        preview.style.display = '';
        img.onerror = () => { preview.style.display = 'none'; };
      } else if (preview) { preview.style.display = 'none'; }
    });

    // Color picker en el form
    const colors = ['yellow','green','blue','purple','gray'];
    const colorRow = document.getElementById('su-cat-f-color-row');
    const colorMap = { yellow:'#f59e0b', green:'#10b981', blue:'#3b82f6', purple:'#2563eb', gray:'#6b7280' };
    colors.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'su-color-btn' + (i === 0 ? ' active' : '');
      btn.style.background = colorMap[c];
      btn.dataset.color = c;
      btn.addEventListener('click', () => {
        colorRow.querySelectorAll('.su-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      colorRow.appendChild(btn);
    });
  }

  async _openCategories() {
    this._togglePanel(false);
    const panel = document.getElementById('su-cat-panel');
    panel.classList.add('visible');
    await this._loadCatList();
  }

  async _loadCatList() {
    const body = document.getElementById('su-cat-body');
    body.innerHTML = '<div class="su-hint">Cargando...</div>';
    try {
      const cats = await getCategories(true, true); // adminAll=true: incluye ocultas
      if (!cats.length) { body.innerHTML = '<div class="su-hint">No hay categorías.</div>'; return; }
      body.innerHTML = '';
      cats.forEach(cat => {
        const row = document.createElement('div');
        row.className = 'su-list-row';
        // Preview: si tiene icon3d_url mostrar imagen fluent3d, si no emoji
        const iconHtml = cat.icon3d_url
          ? '<img src="' + cat.icon3d_url + '" style="width:28px;height:28px;object-fit:contain;flex-shrink:0;" onerror="this.outerHTML=\'<span style=font-size:24px>' + (cat.emoji||'📁') + '</span>\'">'
          : '<span style="font-size:24px;">' + (cat.emoji || '📁') + '</span>';
        row.innerHTML = '<div class="su-list-emoji">' + iconHtml + '</div>'
          + '<div class="su-list-info">'
          + '<div class="su-list-name">' + cat.label_es + '</div>'
          + '<div class="su-list-meta">' + cat.key + ' · ' + cat.label_en + '</div>'
          + '</div>'
          + '<div class="su-row-actions">'
          + '<button class="su-icon-btn" data-action="up-cat"  data-key="' + cat.key + '" title="Subir">⬆️</button>'
          + '<button class="su-icon-btn" data-action="down-cat" data-key="' + cat.key + '" title="Bajar">⬇️</button>'
          + '<button class="su-icon-btn" data-action="subs" data-key="' + cat.key + '" data-label="' + cat.label_es + '" title="Subcategorías">📂</button>'
          + '<button class="su-icon-btn" data-action="edit-cat" data-key="' + cat.key + '" title="Editar">✏️</button>'
          + '<button class="su-icon-btn ' + (cat.visible ? 'active' : 'dim') + '" data-action="toggle-cat" data-key="' + cat.key + '" data-visible="' + cat.visible + '" title="Mostrar/Ocultar">'
          + (cat.visible ? '👁️' : '🙈') + '</button>'
          + '<button class="su-icon-btn danger" data-action="del-cat" data-key="' + cat.key + '" title="Eliminar">🗑️</button>'
          + '</div>';

        row.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const action = btn.dataset.action;
            if (action === 'subs') {
              this._currentCatKey = btn.dataset.key;
              this._currentCatLabel = btn.dataset.label;
              await this._openSubcats(btn.dataset.key, btn.dataset.label);
            } else if (action === 'edit-cat') {
              this._openCatForm(cats.find(c => c.key === btn.dataset.key));
            } else if (action === 'toggle-cat') {
              const newVal = btn.dataset.visible !== 'true';
              await toggleCategoryVisible(btn.dataset.key, newVal);
              invalidateCache();
              await this._loadCatList();
              this.callbacks.onCategoriesUpdated?.();
            } else if (action === 'up-cat') {
              const ordered = [...cats];
              const idx = ordered.findIndex(c => c.key === btn.dataset.key);
              if (idx > 0) {
                [ordered[idx-1], ordered[idx]] = [ordered[idx], ordered[idx-1]];
                await reorderCategories(ordered.map((c, i) => ({ key: c.key, sort_order: i })));
                invalidateCache();
                await this._loadCatList();
                this.callbacks.onCategoriesUpdated?.();
              }
            } else if (action === 'down-cat') {
              const ordered = [...cats];
              const idx = ordered.findIndex(c => c.key === btn.dataset.key);
              if (idx < ordered.length - 1) {
                [ordered[idx], ordered[idx+1]] = [ordered[idx+1], ordered[idx]];
                await reorderCategories(ordered.map((c, i) => ({ key: c.key, sort_order: i })));
                invalidateCache();
                await this._loadCatList();
                this.callbacks.onCategoriesUpdated?.();
              }
            } else if (action === 'del-cat') {
              if (!confirm('¿Eliminar categoría "' + btn.dataset.key + '" y todas sus subcategorías?')) return;
              await deleteCategory(btn.dataset.key);
              await this._loadCatList();
            }
          });
        });
        body.appendChild(row);
      });
    } catch (err) {
      body.innerHTML = '<div class="su-hint">Error: ' + err.message + '</div>';
    }
  }

  async _openSubcats(catKey, catLabel) {
    document.getElementById('su-subcat-title').textContent = catLabel + ' → Subcats';
    const panel = document.getElementById('su-subcat-panel');
    panel.classList.add('visible');
    await this._loadSubcatList(catKey);
  }

  async _loadSubcatList(catKey) {
    const body = document.getElementById('su-subcat-body');
    body.innerHTML = '<div class="su-hint">Cargando...</div>';
    try {
      const subs = await getSubcategories(catKey, true, true); // adminAll=true
      if (!subs.length) { body.innerHTML = '<div class="su-hint">No hay subcategorías.</div>'; return; }
      body.innerHTML = '';
      subs.forEach(sub => {
        const row = document.createElement('div');
        row.className = 'su-list-row';
        row.innerHTML = '<span class="su-list-emoji">' + (sub.emoji || '•') + '</span>'
          + '<div class="su-list-info">'
          + '<div class="su-list-name">' + sub.label_es + '</div>'
          + '<div class="su-list-meta">' + sub.value + ' · ' + sub.label_en + '</div>'
          + '</div>'
          + '<div class="su-row-actions">'
          + '<button class="su-icon-btn" data-action="up-sub"   data-id="' + sub.id + '" title="Subir">⬆️</button>'
          + '<button class="su-icon-btn" data-action="down-sub" data-id="' + sub.id + '" title="Bajar">⬇️</button>'
          + '<button class="su-icon-btn" data-action="edit-sub" data-id="' + sub.id + '" title="Editar">✏️</button>'
          + '<button class="su-icon-btn ' + (sub.visible ? 'active' : 'dim') + '" data-action="toggle-sub" data-id="' + sub.id + '" data-visible="' + sub.visible + '" title="Mostrar/Ocultar">'
          + (sub.visible ? '👁️' : '🙈') + '</button>'
          + '<button class="su-icon-btn danger" data-action="del-sub" data-id="' + sub.id + '" title="Eliminar">🗑️</button>'
          + '</div>';

        row.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            if (action === 'up-sub') {
              const ordered = [...subs];
              const idx = ordered.findIndex(s => s.id === btn.dataset.id);
              if (idx > 0) {
                [ordered[idx-1], ordered[idx]] = [ordered[idx], ordered[idx-1]];
                await reorderSubcategories(ordered.map((s, i) => ({ id: s.id, sort_order: i })));
                invalidateCache();
                await this._loadSubcatList(catKey);
                this.callbacks.onCategoriesUpdated?.();
              }
            } else if (action === 'down-sub') {
              const ordered = [...subs];
              const idx = ordered.findIndex(s => s.id === btn.dataset.id);
              if (idx < ordered.length - 1) {
                [ordered[idx], ordered[idx+1]] = [ordered[idx+1], ordered[idx]];
                await reorderSubcategories(ordered.map((s, i) => ({ id: s.id, sort_order: i })));
                invalidateCache();
                await this._loadSubcatList(catKey);
                this.callbacks.onCategoriesUpdated?.();
              }
            } else if (action === 'edit-sub') {
              this._openCatForm(subs.find(s => s.id === btn.dataset.id), true);
            } else if (action === 'toggle-sub') {
              const newVal = btn.dataset.visible !== 'true';
              await toggleSubcategoryVisible(btn.dataset.id, newVal);
              invalidateCache();
              await this._loadSubcatList(catKey);
              this.callbacks.onCategoriesUpdated?.();
            } else if (action === 'del-sub') {
              if (!confirm('¿Eliminar subcategoría "' + sub.label_es + '"?')) return;
              await deleteSubcategory(btn.dataset.id);
              await this._loadSubcatList(catKey);
            }
          });
        });
        body.appendChild(row);
      });
    } catch (err) {
      body.innerHTML = '<div class="su-hint">Error: ' + err.message + '</div>';
    }
  }

  _openCatForm(data, isSubcat = false) {
    this._catFormIsSubcat = isSubcat;
    this._catFormData = data;
    const modal = document.getElementById('su-cat-form-modal');
    const isEdit = !!data;

    document.getElementById('su-cat-form-title').textContent =
      isEdit ? (isSubcat ? '✏️ Editar subcategoría' : '✏️ Editar categoría')
             : (isSubcat ? '+ Nueva subcategoría' : '+ Nueva categoría');

    document.getElementById('su-cat-f-key-row').style.display  = isSubcat ? 'none' : '';
    document.getElementById('su-cat-f-subfields').style.display = isSubcat ? '' : 'none';

    document.getElementById('su-cat-f-label-es').value = data?.label_es || '';
    document.getElementById('su-cat-f-label-en').value = data?.label_en || '';
    document.getElementById('su-cat-f-emoji').value    = data?.emoji    || '';
    document.getElementById('su-cat-f-key').value      = data?.key      || '';
    document.getElementById('su-cat-f-value').value    = data?.value    || '';
    document.getElementById('su-cat-f-query-es').value = data?.query_es || '';
    const icon3dField = document.getElementById('su-cat-f-icon3d');
    if (icon3dField) {
      icon3dField.value = data?.icon3d_url || '';
      // Preview del ícono actual
      const preview = document.getElementById('su-cat-f-icon3d-preview');
      const img = document.getElementById('su-cat-f-icon3d-img');
      if (preview && img && data?.icon3d_url) {
        img.src = data.icon3d_url; preview.style.display = '';
      } else if (preview) { preview.style.display = 'none'; }
    }
    document.getElementById('su-cat-form-error').textContent = '';

    // Set active color
    const colorRow = document.getElementById('su-cat-f-color-row');
    colorRow.querySelectorAll('.su-color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === (data?.color || 'yellow'));
    });

    modal.classList.add('visible');
  }

  _closeCatForm() {
    document.getElementById('su-cat-form-modal').classList.remove('visible');
  }

  async _saveCatForm() {
    const saveBtn = document.getElementById('su-cat-form-save');
    const errorEl = document.getElementById('su-cat-form-error');
    errorEl.textContent = '';
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Guardando...';

    try {
      const labelEs = document.getElementById('su-cat-f-label-es').value.trim();
      const labelEn = document.getElementById('su-cat-f-label-en').value.trim();
      const emoji   = document.getElementById('su-cat-f-emoji').value.trim();
      const color   = document.querySelector('#su-cat-f-color-row .su-color-btn.active')?.dataset.color || 'gray';

      if (!labelEs || !labelEn) throw new Error('Nombre ES y EN son requeridos');

      if (this._catFormIsSubcat) {
        const value   = document.getElementById('su-cat-f-value').value.trim().toLowerCase();
        const queryEs = document.getElementById('su-cat-f-query-es').value.trim();
        if (!value) throw new Error('El slug (value) es requerido');
        const icon3dUrlSub = (document.getElementById('su-cat-f-icon3d')?.value || '').trim();
        const payload = {
          category_key: this._currentCatKey,
          label_es: labelEs, label_en: labelEn,
          emoji, query_es: queryEs, value,
          icon3d_url: icon3dUrlSub || null,
          sort_order: this._catFormData?.sort_order ?? 99
        };
        if (this._catFormData?.id) payload.id = this._catFormData.id;
        await upsertSubcategory(payload);
        invalidateCache();
        await this._loadSubcatList(this._currentCatKey);
        this.callbacks.onCategoriesUpdated?.();
      } else {
        const key = document.getElementById('su-cat-f-key').value.trim().toUpperCase();
        if (!key) throw new Error('El KEY es requerido');
        const icon3dUrl = document.getElementById('su-cat-f-icon3d').value.trim();
        const payload = {
          key, label_es: labelEs, label_en: labelEn,
          emoji, color,
          icon3d_url: icon3dUrl || null,
          sort_order: this._catFormData?.sort_order ?? 99,
          visible: this._catFormData?.visible ?? true
        };
        await upsertCategory(payload);
        invalidateCache();
        await this._loadCatList();
        this.callbacks.onCategoriesUpdated?.();
        const _cimg=document.querySelector(`.category-footer-chip[data-menu-key="${key}"] .category-icon-3d`);
        if(_cimg&&icon3dUrl)_cimg.src=icon3dUrl;
      }
      this._closeCatForm();
    } catch (err) {
      errorEl.textContent = '❌ ' + (err.message || 'Error al guardar');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Guardar';
    }
  }

  // ── Toggle panel ───────────────────────────────────────────
  _togglePanel(forceState) {
    const panel = document.getElementById('su-panel');
    this.isVisible = forceState !== undefined ? forceState : !this.isVisible;
    panel.classList.toggle('visible', this.isVisible);
  }

  // ── CSS ─────────────────────────────────────────────────────

  // ══════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════
  // SECCIÓN: AGREGAR LUGAR — manual o importando desde Google
  // ══════════════════════════════════════════════════════════════

  async _openPlaces() {
    this._togglePanel(false);

    document.getElementById('su-places-hub')?.remove();
    const modal = document.createElement('div');
    modal.id = 'su-places-hub';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;justify-content:center;';

    modal.innerHTML =
      '<div style="width:100%;max-width:480px;background:#1a1a2e;border-radius:20px 20px 0 0;padding:20px;display:flex;flex-direction:column;gap:10px;max-height:92dvh;">' +
        // Header
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
          '<span style="font-size:16px;font-weight:700;color:#fff;">🏪 Lugares</span>' +
          '<button id="su-hub-close" style="background:none;border:none;color:#9ca3af;font-size:20px;cursor:pointer;">✕</button>' +
        '</div>' +
        // Botones agregar
        '<div style="display:flex;gap:8px;flex-shrink:0;">' +
          '<button id="su-hub-manual" class="su-btn su-btn-cyan" style="flex:1;padding:10px;font-size:12px;">✏️ Agregar manual</button>' +
          '<button id="su-hub-google" class="su-btn su-btn-purple" style="flex:1;padding:10px;font-size:12px;">🔎 Importar Google</button>' +
        '</div>' +
        // Barra de lote (oculta hasta que haya selección)
        '<div id="su-hub-batch-bar" style="display:none;flex-shrink:0;background:rgba(0,188,212,0.12);border:1.5px solid rgba(0,188,212,0.3);border-radius:12px;padding:10px 12px;gap:8px;align-items:center;">' +
          '<span id="su-hub-batch-count" style="font-size:12px;color:#67e8f9;font-weight:700;flex:1;">0 seleccionados</span>' +
          '<button id="su-hub-batch-tags" style="background:rgba(0,188,212,0.25);border:1.5px solid #00bcd4;border-radius:8px;color:#67e8f9;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">🏷️ Asignar tags</button>' +
          '<button id="su-hub-batch-clear" style="background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;">✕</button>' +
        '</div>' +
        // Buscador
        '<input id="su-hub-search" class="su-input" placeholder="🔍 Buscar..." style="font-size:13px;flex-shrink:0;">' +
        // Lista
        '<div id="su-hub-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:5px;min-height:120px;">' +
          '<div style="color:#6b7280;font-size:13px;text-align:center;padding:20px;">Carga una categoría en el mapa para ver sus lugares aquí.</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('su-hub-close').addEventListener('click', () => modal.remove());
    document.getElementById('su-hub-manual').addEventListener('click', () => { modal.remove(); this._openPlaceForm(null); });
    document.getElementById('su-hub-google').addEventListener('click', () => { modal.remove(); this._openGoogleImport(); });

    // Estado de selección
    let selectedIds = new Set();

    const updateBatchBar = () => {
      const bar = document.getElementById('su-hub-batch-bar');
      const cnt = document.getElementById('su-hub-batch-count');
      if (!bar) return;
      if (selectedIds.size > 0) {
        bar.style.display = 'flex';
        cnt.textContent = selectedIds.size + ' seleccionado' + (selectedIds.size !== 1 ? 's' : '');
      } else {
        bar.style.display = 'none';
      }
    };

    // Recargar lugares frescos desde Airtable (garantiza openingHours, description, etc.)
    const mapView = window.wpApp?.mapView;
    const listEl  = document.getElementById('su-hub-list');

    let places = mapView?.allPlaces || [];
    let allSubcats = [];

    try {
      const mod = await import('/src/services/CategoryService.js');
      allSubcats = await mod.getSubcategories(mapView?.currentCatId || null);
    } catch(e) {}

    // Fetch fresco si hay categoría activa
    const currentCat = mapView?.currentCatData?.menuKey || mapView?.currentCatId;
    if (currentCat) {
      try {
        if (listEl) listEl.innerHTML = '<div style="color:#6b7280;font-size:13px;text-align:center;padding:20px;">Cargando lugares...</div>';
        const res = await fetch('/api/supabase-places?category=' + encodeURIComponent(currentCat) + '&include_hidden=true');
        const data = await res.json();
        if (data.success && data.places?.length) {
          places = data.places;
          // Sincronizar con allPlaces en memoria
          if (mapView) mapView.allPlaces = places;
        }
      } catch(e) { console.warn('Hub fetch error:', e); }
    }

    this._renderPlacesHubList(places, selectedIds, updateBatchBar, allSubcats);

    // Filtro en tiempo real
    document.getElementById('su-hub-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = q ? places.filter(p => (p.name||'').toLowerCase().includes(q) || (p.formattedAddress||'').toLowerCase().includes(q)) : places;
      this._renderPlacesHubList(filtered, selectedIds, updateBatchBar, allSubcats);
    });

    // Limpiar selección
    document.getElementById('su-hub-batch-clear').addEventListener('click', () => {
      selectedIds.clear();
      updateBatchBar();
      document.querySelectorAll('.su-place-cb').forEach(cb => { cb.checked = false; });
      document.querySelectorAll('.su-place-row').forEach(row => row.style.background = 'rgba(255,255,255,0.05)');
    });

    // Asignar tags en lote
    document.getElementById('su-hub-batch-tags').addEventListener('click', () => {
      this._openBatchTagPicker(allSubcats, selectedIds, places, () => {
        selectedIds.clear(); updateBatchBar();
      });
    });
  }

  // Mapa de tipos de Google → subcategoría sugerida
  _suggestTag(place, subcats) {
    const types = (place.types || []).map(t => t.toLowerCase());
    const name  = (place.name || '').toLowerCase();
    // Mapeo directo de Google types → value de subcategoría
    const TYPE_MAP = {
      'dentist':'dental','dental_clinic':'dental',
      'pharmacy':'farmacia','drugstore':'farmacia',
      'hair_care':'salon','hair_salon':'salon','nail_salon':'salon','beauty_salon':'salon','barber_shop':'salon',
      'spa':'spa','massage':'spa',
      'doctor':'medico','hospital':'medico','medical_center':'medico','physician':'medico','clinic':'medico',
      'optician':'optica','optometrist':'optica',
      'restaurant':'mexican','food':'mexican','meal_takeaway':'taco','meal_delivery':'taco',
      'bar':'bar','night_club':'bar','liquor_store':'bar',
      'cafe':'cafe','bakery':'cafe','coffee_shop':'cafe',
      'clothing_store':'ropa','shoe_store':'ropa','fashion':'ropa',
      'jewelry_store':'joyeria','watch_store':'joyeria',
      'electronics_store':'electronica','cell_phone_store':'electronica',
      'car_repair':'mecanico','car_dealer':'mecanico','auto_parts_store':'mecanico',
      'hotel':'hotel','lodging':'hotel','motel':'hotel',
      'casino':'casino','gambling':'casino',
      'tourist_attraction':'souvenir','souvenir_store':'souvenir',
      'supermarket':'snack','convenience_store':'snack','grocery_or_supermarket':'snack',
      'pizza_restaurant':'pizza','italian_restaurant':'pizza',
      'hamburger_restaurant':'burger','fast_food_restaurant':'burger',
      'seafood_restaurant':'seafood','fish_and_chips':'seafood',
    };
    for (const t of types) {
      if (TYPE_MAP[t]) {
        const found = subcats.find(s => s.value === TYPE_MAP[t]);
        if (found) return found;
      }
    }
    return null;
  }

  _renderPlacesHubList(places, selectedIds, updateBatchBar, allSubcats) {
    // Compatibilidad con llamadas antiguas sin parámetros de lote
    if (!selectedIds) selectedIds = new Set();
    if (!updateBatchBar) updateBatchBar = () => {};
    if (!allSubcats) allSubcats = [];

    const list = document.getElementById('su-hub-list');
    if (!list) return;
    if (!places.length) {
      list.innerHTML = '<div style="color:#6b7280;font-size:13px;text-align:center;padding:20px;">Sin resultados.</div>';
      return;
    }

    list.innerHTML = places.slice(0, 60).map((p, i) => {
      const photo    = p.photoUrl || p.photosUrls?.[0] || '';
      const rating   = p.rating ? '<span style="color:#fbbf24;font-size:10px;">⭐ ' + p.rating + '</span>' : '';
      const isHidden = p._hidden === true;
      const pid      = p.place_id || p.placeId || String(i);
      const isChecked = selectedIds.has(pid);

      // Tags actuales del lugar
      const currentTags = (p.subcategoryTags || []);
      const tagsHtml = currentTags.length
        ? currentTags.map(t => {
            const sub = allSubcats.find(s => s.value === t);
            return '<span style="display:inline-block;font-size:9px;font-weight:700;padding:1px 6px;border-radius:10px;background:rgba(0,188,212,0.2);color:#67e8f9;border:1px solid rgba(0,188,212,0.3);">' + (sub ? (sub.emoji ? sub.emoji + ' ' : '') + (sub.label_es || t) : t) + '</span>';
          }).join('')
        : (() => {
            // Auto-sugerencia basada en tipos de Google
            const suggested = this._suggestTag(p, allSubcats);
            return suggested
              ? '<span style="display:inline-block;font-size:9px;padding:1px 6px;border-radius:10px;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.25);">' + (suggested.emoji ? suggested.emoji + ' ' : '') + (suggested.label_es || suggested.value) + ' ·sugerido</span>'
              : '<span style="font-size:9px;color:#4b5563;">sin tags</span>';
          })();

      return '<div class="su-place-row" data-pid="' + pid + '" data-idx="' + i + '" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:' + (isChecked ? 'rgba(0,188,212,0.12)' : 'rgba(255,255,255,0.05)') + ';border-radius:12px;border:1.5px solid ' + (isChecked ? 'rgba(0,188,212,0.35)' : 'transparent') + ';transition:all 0.15s;' + (isHidden ? 'opacity:0.45;' : '') + ';user-select:none;-webkit-user-select:none;">' +
        // Checkbox
        '<input type="checkbox" class="su-place-cb" data-pid="' + pid + '" ' + (isChecked ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#00bcd4;cursor:pointer;flex-shrink:0;">' +
        // Foto
        (photo
          ? '<img src="' + photo + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.style.display=&apos;none&apos;">'
          : '<div style="width:44px;height:44px;border-radius:8px;background:rgba(0,188,212,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🏪</div>') +
        // Info
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (p.name || '') + (isHidden ? ' <span style="font-size:9px;color:#6b7280;">(oculto)</span>' : '') + '</div>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:3px;">' + tagsHtml + (rating ? '&nbsp;' + rating : '') + '</div>' +
        '</div>' +
        // Botones ✏️ y 🙈 visibles — 🗑️ solo con long-press
        '<div style="display:flex;gap:4px;flex-shrink:0;">' +
          '<button class="su-place-edit-btn" data-idx="' + i + '" style="background:rgba(99,102,241,0.2);border:1.5px solid rgba(99,102,241,0.4);border-radius:8px;color:#a5b4fc;width:32px;height:32px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✏️</button>' +
          '<button class="su-place-hide-btn" data-idx="' + i + '" style="background:rgba(251,191,36,0.15);border:1.5px solid rgba(251,191,36,0.3);border-radius:8px;color:#fbbf24;width:32px;height:32px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' + (isHidden ? '👁️' : '🙈') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    // Bind checkboxes
    list.querySelectorAll('.su-place-cb').forEach(cb => {
      cb.addEventListener('change', e => {
        e.stopPropagation();
        const pid = cb.getAttribute('data-pid');
        const row = cb.closest('.su-place-row');
        if (cb.checked) {
          selectedIds.add(pid);
          if (row) { row.style.background = 'rgba(0,188,212,0.12)'; row.style.border = '1.5px solid rgba(0,188,212,0.35)'; }
        } else {
          selectedIds.delete(pid);
          if (row) { row.style.background = 'rgba(255,255,255,0.05)'; row.style.border = '1.5px solid transparent'; }
        }
        updateBatchBar();
      });
    });

    // ── Botones ✏️ Editar ──────────────────────────────────────
    list.querySelectorAll('.su-place-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'));
        const place = places[idx];
        document.getElementById('su-places-hub')?.remove();
        this._openPlaceForm(this._placeToFormPrefill(place), place.place_id);
      });
    });

    // ── Botones 🙈 Ocultar/Mostrar ─────────────────────────────
    list.querySelectorAll('.su-place-hide-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'));
        const place = places[idx];
        if (!place.place_id) { this._showToast('⚠️ Sin place_id'); return; }
        const nowHidden = place._hidden === true;
        btn.textContent = '⏳';
        try {
          const res = await fetch('/api/supabase-place-update', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place_id: place.place_id, hidden: !nowHidden }),
          });
          if (!res.ok) throw new Error(await res.text());
          place._hidden = !nowHidden;
          btn.textContent = nowHidden ? '🙈' : '👁️';
          const row = btn.closest('.su-place-row');
          if (row) row.style.opacity = nowHidden ? '1' : '0.45';
          const mapView = window.wpApp?.mapView;
          if (mapView) {
            // Sincronizar _hidden en allPlaces para que persista al cambiar categoría
            const inAll = (mapView.allPlaces || []).find(pp => pp.place_id === place.place_id);
            if (inAll) inAll._hidden = !nowHidden;
            // Inicializar Set global si no existe
            if (!mapView._hiddenPlaceIds) mapView._hiddenPlaceIds = new Set();
            if (!nowHidden) {
              mapView._hiddenPlaceIds.add(place.place_id);
              mapView.places = (mapView.places || []).filter(pp => pp.place_id !== place.place_id);
            } else {
              mapView._hiddenPlaceIds.delete(place.place_id);
              place._hidden = false;
              const alreadyIn = (mapView.places || []).some(pp => pp.place_id === place.place_id);
              if (!alreadyIn) mapView.places = [...(mapView.places || []), place];
            }
            if(mapView){mapView.allPlaces=mapView.places||[];mapView._clearPlaceMarkers();mapView._renderPlaceMarkers(mapView.allPlaces);const _rc1=document.getElementById('map-results-count');if(_rc1)_rc1.textContent=mapView.allPlaces.length+' lugares';}
          }
          this._showToast(nowHidden ? '👁️ Lugar visible' : '🙈 Lugar oculto');
        } catch (err) { btn.textContent = nowHidden ? '👁️' : '🙈'; this._showToast('❌ ' + err.message); }
      });
    });

    // ── Long-press en fila → solo eliminar 🗑️ ──────────────────
    list.querySelectorAll('.su-place-row').forEach(row => {
      let pressTimer = null;
      let moved = false;

      const startPress = (e) => {
        if (e.target.closest('.su-place-cb, .su-place-edit-btn, .su-place-hide-btn')) return;
        moved = false;
        pressTimer = setTimeout(() => {
          if (moved) return;
          const idx   = parseInt(row.getAttribute('data-idx'));
          const place = places[idx];
          if (navigator.vibrate) navigator.vibrate(40);
          this._confirmDeletePlace(place, row);
        }, 500);
      };

      const cancelPress = () => clearTimeout(pressTimer);
      const markMoved   = () => { moved = true; clearTimeout(pressTimer); };

      row.addEventListener('touchstart',  startPress,  { passive: true });
      row.addEventListener('touchend',    cancelPress, { passive: true });
      row.addEventListener('touchmove',   markMoved,   { passive: true });
      row.addEventListener('touchcancel', cancelPress, { passive: true });
      row.addEventListener('mousedown',   startPress);
      row.addEventListener('mouseup',     cancelPress);
      row.addEventListener('mousemove',   markMoved);
      row.addEventListener('mouseleave',  cancelPress);

      // Tap simple en el cuerpo de la fila → toggle checkbox
      row.addEventListener('click', e => {
        if (e.target.closest('.su-place-cb, .su-place-edit-btn, .su-place-hide-btn')) return;
        const cb = row.querySelector('.su-place-cb');
        if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    });
  }

  // ── Confirm eliminar (long-press) ────────────────────────
  _confirmDeletePlace(place, row) {
    document.querySelectorAll('.su-ctx-menu').forEach(m => m.remove());
    if (!place.place_id) { this._showToast('⚠️ Sin place_id'); return; }

    if (!document.getElementById('su-ctx-style')) {
      const s = document.createElement('style');
      s.id = 'su-ctx-style';
      s.textContent = '@keyframes suCtxIn{from{opacity:0;transform:translateX(-50%) scale(0.92)}to{opacity:1;transform:translateX(-50%) scale(1)}}';
      document.head.appendChild(s);
    }

    const rect = row.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 140 ? rect.bottom + 6 : rect.top - 146;

    const menu = document.createElement('div');
    menu.className = 'su-ctx-menu';
    menu.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:' + top + 'px;' +
      'z-index:200000;background:#1e1e35;border:1.5px solid rgba(239,68,68,0.3);border-radius:16px;' +
      'padding:8px;min-width:230px;box-shadow:0 8px 32px rgba(0,0,0,0.55);animation:suCtxIn 0.15s ease;';

    menu.innerHTML =
      '<div style="font-size:12px;color:#f87171;padding:8px 12px 4px;font-weight:700;">🗑️ ¿Eliminar este lugar?</div>' +
      '<div style="font-size:11px;color:#9ca3af;padding:0 12px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (place.name || '').slice(0, 30) + '</div>' +
      '<div style="display:flex;gap:8px;padding:0 8px 4px;">' +
        '<button class="su-del-confirm-yes" style="flex:1;background:#ef4444;border:none;border-radius:10px;color:#fff;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">Eliminar</button>' +
        '<button class="su-del-confirm-no" style="flex:1;background:rgba(255,255,255,0.08);border:none;border-radius:10px;color:#9ca3af;padding:10px;font-size:13px;cursor:pointer;">Cancelar</button>' +
      '</div>';

    document.body.appendChild(menu);

    const closeMenu = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('touchstart', closeMenu); document.removeEventListener('mousedown', closeMenu); } };
    setTimeout(() => { document.addEventListener('touchstart', closeMenu, { passive: true }); document.addEventListener('mousedown', closeMenu); }, 50);

    menu.querySelector('.su-del-confirm-no').addEventListener('click', () => menu.remove());
    menu.querySelector('.su-del-confirm-yes').addEventListener('click', async () => {
      menu.remove();
      try {
        const res = await fetch('/api/supabase-place-delete?place_id=' + encodeURIComponent(place.place_id), { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        row.remove();
        const mapView = window.wpApp?.mapView;
        if (mapView) {
          mapView.allPlaces = (mapView.allPlaces || []).filter(pp => pp.place_id !== place.place_id);
          mapView.places=(mapView.places||[]).filter(pp=>pp.place_id!==place.place_id);if(mapView){mapView.allPlaces=mapView.places||[];mapView._clearPlaceMarkers();mapView._renderPlaceMarkers(mapView.allPlaces);const _rc2=document.getElementById('map-results-count');if(_rc2)_rc2.textContent=mapView.allPlaces.length+' lugares';}
        }
        this._showToast('🗑️ Lugar eliminado');
      } catch(err) { this._showToast('❌ ' + err.message); }
    });
  }



  // ── Selector de tags en lote ─────────────────────────────
  _openBatchTagPicker(allSubcats, selectedIds, places, onDone) {
    document.getElementById('su-batch-tag-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'su-batch-tag-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;';

    const selectedPlaces = places.filter(p => {
      const pid = p.place_id || p.placeId;
      return selectedIds.has(pid);
    });

    // Detectar tags sugeridos para los seleccionados
    const suggestedValues = new Set();
    selectedPlaces.forEach(p => {
      const sug = this._suggestTag(p, allSubcats);
      if (sug) suggestedValues.add(sug.value);
    });

    let pickedTags = new Set([...suggestedValues]); // pre-seleccionar sugeridos

    const renderChips = () => allSubcats.map(s => {
      const on = pickedTags.has(s.value);
      const isSuggested = suggestedValues.has(s.value);
      return '<button class="su-batch-chip" data-val="' + s.value + '" style="padding:7px 13px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ' + (on ? '#00bcd4' : 'rgba(255,255,255,0.15)') + ';background:' + (on ? 'rgba(0,188,212,0.2)' : 'rgba(255,255,255,0.05)') + ';color:' + (on ? '#67e8f9' : '#9ca3af') + ';transition:all 0.15s;">' +
        (s.emoji ? s.emoji + ' ' : '') + (s.label_es || s.value) +
        (isSuggested && !on ? ' ✨' : '') +
      '</button>';
    }).join('');

    modal.innerHTML =
      '<div style="width:100%;max-width:480px;background:#1a1a2e;border-radius:20px 20px 0 0;padding:20px;display:flex;flex-direction:column;gap:12px;max-height:80dvh;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="font-size:15px;font-weight:700;color:#fff;">🏷️ Asignar tags — ' + selectedPlaces.length + ' lugares</span>' +
          '<button id="su-btp-close" style="background:none;border:none;color:#9ca3af;font-size:20px;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="font-size:11px;color:#9ca3af;">✨ = sugerido automáticamente según tipo de negocio. Los tags <strong style="color:#fff;">reemplazarán</strong> los existentes.</div>' +
        '<div id="su-btp-chips" style="display:flex;flex-wrap:wrap;gap:8px;overflow-y:auto;">' + renderChips() + '</div>' +
        '<button id="su-btp-apply" style="background:linear-gradient(135deg,#00bcd4,#2563eb);border:none;border-radius:12px;color:#fff;padding:14px;font-size:14px;font-weight:700;cursor:pointer;flex-shrink:0;">✅ Aplicar a ' + selectedPlaces.length + ' lugares</button>' +
      '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('su-btp-close').addEventListener('click', () => modal.remove());

    // Toggle chips
    const rebindChips = () => {
      modal.querySelectorAll('.su-batch-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-val');
          if (pickedTags.has(val)) { pickedTags.delete(val); } else { pickedTags.add(val); }
          document.getElementById('su-btp-chips').innerHTML = renderChips();
          rebindChips();
        });
      });
    };
    rebindChips();

    // Aplicar
    document.getElementById('su-btp-apply').addEventListener('click', async () => {
      const tagsArr = [...pickedTags];
      const applyBtn = document.getElementById('su-btp-apply');
      applyBtn.textContent = '⏳ Guardando...';
      applyBtn.disabled = true;

      let ok = 0, fail = 0;
      for (const p of selectedPlaces) {
        const pid = p.place_id || p.placeId;
        if (!pid) { fail++; continue; }
        try {
          const res = await fetch('/api/supabase-place-update', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place_id: pid, subcategory_tags: tagsArr }),
          });
          if (!res.ok) throw new Error();
          p.subcategoryTags = tagsArr; // actualizar objeto del hub
          // Actualizar también en mapView.allPlaces y .places
          const mapView = window.wpApp?.mapView;
          if (mapView) {
            const inAll = mapView.allPlaces?.find(mp => (mp.place_id || mp.placeId) === pid);
            if (inAll) inAll.subcategoryTags = tagsArr;
            const inPlaces = mapView.places?.find(mp => (mp.place_id || mp.placeId) === pid);
            if (inPlaces) inPlaces.subcategoryTags = tagsArr;
          }
          ok++;
        } catch(e) { fail++; }
        applyBtn.textContent = '⏳ ' + ok + '/' + selectedPlaces.length + '...';
      }

      modal.remove();
      onDone();
      this._showToast('✅ ' + ok + ' lugares actualizados' + (fail ? ' · ❌ ' + fail + ' errores' : ''));

      const mapView=window.wpApp?.mapView;if(mapView){mapView.allPlaces=mapView.places||[];mapView._clearPlaceMarkers();mapView._renderPlaceMarkers(mapView.allPlaces);const _rc3=document.getElementById('map-results-count');if(_rc3)_rc3.textContent=mapView.allPlaces.length+' lugares';}
    });
  }

  // Convertir un place del mapa al formato que espera el form
  _placeToFormPrefill(place) {
    return {
      name:              place.name || place.displayName || '',
      category:          place.category || '',
      formatted_address: place.formattedAddress || '',
      phone:             place.phone || '',
      website:           place.website || '',
      photo_url:         place.photoUrl || '',
      photos_urls:       place.photosUrls?.length ? place.photosUrls : (place.photoUrl ? [place.photoUrl] : []),
      rating:            place.rating || '',
      user_ratings_total: place.userRatingCount || '',
      lat:               place.location?.lat || '',
      lng:               place.location?.lng || '',
      place_id:          place.place_id || '',
      subcategory_tags:  place.subcategoryTags || [],
      types:             Array.isArray(place.types) ? place.types.join(',') : (place.types || ''),
      description:       place.description || place.editorialSummary || '',
      editorial_summary: place.editorialSummary || '',
      reviews:           place.reviews || [],
      opening_hours:     place.openingHours || null,
      featured:          place.featured || null,
    };
  }

  // ── Importar por Google Place ID ───────────────────────────
  _openGoogleImport() {
    document.getElementById('su-gi-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'su-gi-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;justify-content:center;';
    modal.innerHTML = `
      <div style="width:100%;max-width:480px;background:#1a1a2e;border-radius:20px 20px 0 0;padding:20px;display:flex;flex-direction:column;gap:12px;max-height:80dvh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:15px;font-weight:700;color:#fff;">🔎 Google Place ID</span>
          <button id="su-gi-close" style="background:none;border:none;color:#9ca3af;font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div style="background:rgba(0,188,212,0.1);border-radius:10px;padding:10px;font-size:12px;color:#67e8f9;line-height:1.6;">
          Busca el lugar en <strong>Google Maps</strong> → toca "Compartir" → copia el link → el Place ID es el texto <code>ChIJ...</code> que aparece en la URL.
        </div>
        <input id="su-gi-input" class="su-input" placeholder="Pega aquí el Place ID (ChIJ...)" style="font-size:13px;">
        <div id="su-gi-preview" style="display:none;background:rgba(255,255,255,0.06);border-radius:12px;padding:12px;font-size:13px;"></div>
        <div id="su-gi-error" style="color:#fca5a5;font-size:12px;display:none;"></div>
        <div style="display:flex;gap:8px;">
          <button id="su-gi-fetch" class="su-btn su-btn-cyan" style="flex:1;padding:11px;font-size:13px;">🔍 Buscar</button>
          <button id="su-gi-use" class="su-btn su-btn-purple" style="flex:1;padding:11px;font-size:13px;display:none;">📥 Usar estos datos</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('su-gi-close').addEventListener('click', () => modal.remove());

    let fetched = null;

    document.getElementById('su-gi-fetch').addEventListener('click', async () => {
      const placeId = document.getElementById('su-gi-input').value.trim();
      const errEl = document.getElementById('su-gi-error');
      const preview = document.getElementById('su-gi-preview');
      const useBtn = document.getElementById('su-gi-use');
      const fetchBtn = document.getElementById('su-gi-fetch');
      if (!placeId) { errEl.textContent = 'Ingresa un Place ID.'; errEl.style.display = 'block'; return; }
      errEl.style.display = 'none';
      preview.style.display = 'none';
      useBtn.style.display = 'none';
      fetchBtn.textContent = 'Buscando...';
      fetchBtn.disabled = true;
      try {
        const res = await fetch('/api/google-place-details?place_id=' + encodeURIComponent(placeId));
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        fetched = data.place;
        preview.style.display = 'block';
        preview.innerHTML =
          '<div style="font-weight:700;color:#fff;margin-bottom:4px;">' + fetched.name + '</div>' +
          '<div style="color:#9ca3af;font-size:12px;">' + (fetched.formatted_address || '') + '</div>' +
          (fetched.rating ? '<div style="color:#fbbf24;font-size:12px;margin-top:4px;">⭐ ' + fetched.rating + '</div>' : '') +
          (fetched.editorial_summary ? '<div style="color:#d1fae5;font-size:12px;margin-top:6px;font-style:italic;">' + fetched.editorial_summary + '</div>' : '<div style="color:#6b7280;font-size:11px;margin-top:6px;">Sin descripción en Google</div>') +
          '<div style="color:#67e8f9;font-size:11px;margin-top:4px;">lat: ' + fetched.lat + ', lng: ' + fetched.lng + '</div>';
        useBtn.style.display = 'block';
      } catch(e) {
        errEl.textContent = 'Error: ' + e.message + (e.message.includes('500') ? ' — Verifica que VITE_GOOGLE_MAPS_API_KEY esté en Vercel y tenga Places API habilitada.' : '');
        errEl.style.display = 'block';
      } finally {
        fetchBtn.textContent = '🔍 Buscar';
        fetchBtn.disabled = false;
      }
    });

    document.getElementById('su-gi-use').addEventListener('click', () => {
      if (!fetched) return;
      modal.remove();
      this._openPlaceForm({
        name:               fetched.name,
        formatted_address:  fetched.formatted_address || '',
        lat:                fetched.lat,
        lng:                fetched.lng,
        phone:              fetched.phone || '',
        website:            fetched.website || '',
        photo_url:          fetched.photo_url || '',
        photos_urls:        fetched.photos_urls || [],
        rating:             fetched.rating || '',
        user_ratings_total: fetched.user_ratings_total || '',
        place_id:           fetched.place_id,
        description:        fetched.editorial_summary || '',
        editorial_summary:  fetched.editorial_summary || '',
        reviews:            fetched.reviews || [],
        opening_hours:      fetched.opening_hours || null,
        types:              fetched.types || '',
      });
    });
  }

  // ── Formulario de creación — guarda en Airtable ────────────
  async _openPlaceForm(prefill, editingPlaceId = null) {
    document.getElementById('su-place-form-modal')?.remove();

    // Cargar categorías y subcategorías de Supabase
    let cats = [], allSubcats = [];
    try {
      const mod = await import('/src/services/CategoryService.js');
      cats       = await mod.getCategories();
      allSubcats = await mod.getSubcategories(null, false, false); // todas las subcats
    } catch(e) { console.warn('cats error', e); }

    // Subcats de la categoría actual (o las del prefill)
    const initCatKey = prefill?.category || '';
    const initSubcats = initCatKey ? allSubcats.filter(s => s.category_key === initCatKey) : [];

    // Tags pre-seleccionados (del prefill o vacío)
    const initTags = Array.isArray(prefill?.subcategory_tags)
      ? prefill.subcategory_tags
      : (typeof prefill?.subcategory_tags === 'string' && prefill.subcategory_tags
          ? prefill.subcategory_tags.split(',').map(s => s.trim()) : []);

    // Fotos iniciales (prefill puede traer array de Google)
    const initPhotos = Array.isArray(prefill?.photos_urls) && prefill.photos_urls.length
      ? prefill.photos_urls
      : (prefill?.photo_url ? [prefill.photo_url] : []);
    let photos = [...initPhotos]; // array mutable — debe declararse antes del HTML del modal

    const modal = document.createElement('div');
    modal.id = 'su-place-form-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;';

    const catOptions = cats.map(c =>
      '<option value="' + c.key + '"' + (initCatKey === c.key ? ' selected' : '') + '>' + (c.label_es || c.key) + '</option>'
    ).join('');

    // Renderizar chips de subcategorías
    const renderSubcatChips = (subcats, selectedTags) =>
      subcats.length === 0
        ? '<div style="color:#6b7280;font-size:12px;">Selecciona una categoría primero</div>'
        : subcats.map(s => {
            const isOn = selectedTags.includes(s.value);
            return '<button type="button" class="su-subcat-tag' + (isOn ? ' on' : '') + '" data-val="' + s.value + '" style="padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ' + (isOn ? '#00bcd4' : 'rgba(255,255,255,0.15)') + ';background:' + (isOn ? 'rgba(0,188,212,0.2)' : 'rgba(255,255,255,0.05)') + ';color:' + (isOn ? '#67e8f9' : '#9ca3af') + ';transition:all 0.15s;">' + (s.emoji ? s.emoji + ' ' : '') + (s.label_es || s.value) + '</button>';
          }).join('');

    // Renderizar galería de fotos
    const renderGalleryItems = (photos) =>
      photos.map((url, i) =>
        '<div class="su-gal-item" data-idx="' + i + '" style="position:relative;width:80px;height:80px;flex-shrink:0;">' +
          '<img src="' + url + '" style="width:80px;height:80px;border-radius:10px;object-fit:cover;border:' + (i === 0 ? '2px solid #00bcd4' : '1.5px solid rgba(255,255,255,0.1)') + ';">' +
          (i === 0 ? '<div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;color:#fff;background:rgba(0,188,212,0.8);border-radius:0 0 8px 8px;padding:1px 0;">PRINCIPAL</div>' : '') +
          '<button class="su-gal-del" data-idx="' + i + '" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#ef4444;border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700;line-height:1;">✕</button>' +
        '</div>'
      ).join('');

    modal.innerHTML =
      '<div id="su-pf-inner" style="width:100%;max-width:480px;background:#1a1a2e;border-radius:20px 20px 0 0;padding:20px;max-height:92dvh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
          '<span style="font-size:15px;font-weight:700;color:#fff;">' + (editingPlaceId ? '✏️ Editar lugar' : '🏪 Nuevo lugar') + '</span>' +
          '<button id="su-pf-close" style="background:none;border:none;color:#9ca3af;font-size:20px;cursor:pointer;">✕</button>' +
        '</div>' +

        '<input id="su-pf-name"    class="su-input" placeholder="Nombre del lugar *" value="' + (prefill?.name || '') + '">' +
        '<select id="su-pf-cat" class="su-input" style="background:#0d0d1a;color:#fff;">' +
          '<option value="">-- Categoría *</option>' + catOptions +
        '</select>' +

        // ── Subcategorías / tags ───────────────────────────────
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Subcategorías / Tags</div>' +
          '<div id="su-pf-subcats" style="display:flex;flex-wrap:wrap;gap:6px;min-height:28px;">' +
            renderSubcatChips(initSubcats, initTags) +
          '</div>' +
          '<input id="su-pf-tags-hidden" type="hidden" value="' + initTags.join(',') + '">' +
        '</div>' +

        '<input id="su-pf-address" class="su-input" placeholder="Dirección" value="' + (prefill?.formatted_address || '') + '">' +
        '<input id="su-pf-phone"   class="su-input" placeholder="Teléfono" value="' + (prefill?.phone || '') + '">' +
        '<input id="su-pf-website" class="su-input" placeholder="Website" value="' + (prefill?.website || '') + '">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<input id="su-pf-rating" class="su-input" placeholder="Rating (ej: 4.5)" type="number" step="0.1" min="0" max="5" value="' + (prefill?.rating || '') + '">' +
          '<input id="su-pf-reviews-count" class="su-input" placeholder="Nº reseñas" type="number" min="0" value="' + (prefill?.user_ratings_total || '') + '">' +
        '</div>' +

        // ── Descripción del lugar ──────────────────────────────
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Descripción <span style="font-weight:400;text-transform:none;font-size:10px;">(se auto-rellena desde Google)</span></div>' +
          '<textarea id="su-pf-description" class="su-input" rows="3" placeholder="Breve descripción del lugar..." style="resize:vertical;min-height:64px;font-size:13px;">' + (prefill?.description || '') + '</textarea>' +
        '</div>' +

        // ── Reseñas (read-only preview) ────────────────────────
        (() => {
          const revs = prefill?.reviews || [];
          if (!revs.length) return '<div style="font-size:11px;color:#4b5563;">Sin reseñas importadas</div>';
          return '<div style="display:flex;flex-direction:column;gap:6px;">' +
            '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">' + revs.length + ' reseña' + (revs.length > 1 ? 's' : '') + ' importadas <span style="font-weight:400;text-transform:none;">(solo lectura)</span></div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;">' +
              revs.map(rv =>
                '<div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:8px 10px;">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">' +
                    '<span style="font-size:11px;font-weight:700;color:#e5e7eb;">' + (rv.author_name || 'Anónimo') + '</span>' +
                    '<span style="font-size:11px;color:#fbbf24;">⭐ ' + (rv.rating || '?') + '</span>' +
                  '</div>' +
                  '<div style="font-size:11px;color:#9ca3af;line-height:1.4;">' + ((rv.text || '').slice(0, 120) + (rv.text?.length > 120 ? '…' : '')) + '</div>' +
                '</div>'
              ).join('') +
            '</div>' +
          '</div>';
        })() +

        // ── Horarios editables ─────────────────────────────────
        (() => {
          const hrs = prefill?.opening_hours || {};
          const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
          const dayNames = { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' };
          const rows = days.map(d =>
            '<div style="display:grid;grid-template-columns:80px 1fr;align-items:center;gap:8px;">' +
              '<span style="font-size:11px;color:#9ca3af;font-weight:600;">' + dayNames[d] + '</span>' +
              '<input class="su-input su-pf-hours-input" data-day="' + d + '" placeholder="ej: 9:00 a.m. – 9:00 p.m. (vacío = cerrado)" value="' + (hrs[d] || '') + '" style="font-size:11px;padding:6px 10px;">' +
            '</div>'
          ).join('');
          return '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Horarios <span style="font-weight:400;text-transform:none;font-size:10px;">(vacío = cerrado ese día)</span></div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;">' + rows + '</div>' +
          '</div>';
        })() +

        // ── Galería de fotos (hasta 5) ─────────────────────────
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Fotos del lugar <span style="font-weight:400;text-transform:none;">(máx 5 — la primera es la principal)</span></div>' +

          // Galería scroll horizontal
          '<div id="su-pf-gallery" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;min-height:90px;align-items:center;scrollbar-width:none;">' +
            renderGalleryItems(initPhotos) +
            // Botón añadir siempre al final
            '<div id="su-gal-add-btn" style="width:80px;height:80px;flex-shrink:0;border-radius:10px;border:1.5px dashed rgba(255,255,255,0.2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;font-size:11px;gap:4px;background:rgba(255,255,255,0.03);">' +
              '<span style="font-size:22px;">+</span><span>Añadir</span>' +
            '</div>' +
          '</div>' +

          // Mini-modal para añadir foto (tabs upload/url) — oculto
          '<div id="su-gal-add-panel" style="display:none;background:rgba(255,255,255,0.04);border-radius:12px;padding:12px;flex-direction:column;gap:8px;">' +
            '<div style="display:flex;background:rgba(255,255,255,0.06);border-radius:8px;padding:2px;gap:2px;">' +
              '<button id="su-gal-tab-upload" onclick="window._suGalTab(&apos;upload&apos;)" style="flex:1;padding:7px;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;background:rgba(0,188,212,0.25);color:#67e8f9;">📷 Subir</button>' +
              '<button id="su-gal-tab-url"    onclick="window._suGalTab(&apos;url&apos;)"    style="flex:1;padding:7px;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;background:transparent;color:#9ca3af;">🔗 URL</button>' +
            '</div>' +
            '<div id="su-gal-panel-upload">' +
              '<label id="su-gal-file-label" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;background:rgba(255,255,255,0.05);border:1.5px dashed rgba(255,255,255,0.12);border-radius:8px;cursor:pointer;font-size:12px;color:#9ca3af;">' +
                '📷 Elegir imagen (máx 5 MB)<input id="su-gal-file-input" type="file" accept="image/*" style="display:none;">' +
              '</label>' +
            '</div>' +
            '<div id="su-gal-panel-url" style="display:none;flex-direction:column;gap:6px;">' +
              '<input id="su-gal-url-input" class="su-input" placeholder="https://..." style="font-size:12px;">' +
              '<button id="su-gal-url-add" class="su-btn su-btn-cyan" style="padding:8px;font-size:12px;">+ Agregar URL</button>' +
            '</div>' +
            '<button id="su-gal-add-cancel" style="background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer;text-align:center;">Cancelar</button>' +
          '</div>' +

          '<input id="su-pf-photos-json" type="hidden">' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<input id="su-pf-lat" class="su-input" placeholder="Latitud *" type="number" step="any" value="' + (prefill?.lat || '') + '">' +
          '<input id="su-pf-lng" class="su-input" placeholder="Longitud *" type="number" step="any" value="' + (prefill?.lng || '') + '">' +
        '</div>' +
        '<button id="su-pf-pick-coords" class="su-btn su-btn-cyan" style="padding:10px;font-size:13px;">🗺️ Tomar coordenadas del mapa</button>' +

        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Destacado</div>' +
          '<select id="su-pf-featured" class="su-input" style="background:#0d0d1a;color:#fff;">' +
            '<option value=""' + (!prefill?.featured ? ' selected' : '') + '>— Sin destacar —</option>' +
            '<option value="featured"' + (prefill?.featured === 'featured' ? ' selected' : '') + '>⭐ Lugar Destacado</option>' +
            '<option value="verified"' + (prefill?.featured === 'verified' ? ' selected' : '') + '>✅ Lugar Verificado</option>' +
            '<option value="premium"' + (prefill?.featured === 'premium' ? ' selected' : '') + '>💎 Premium</option>' +
          '</select>' +
        '</div>' +
        '<div id="su-pf-error" style="color:#fca5a5;font-size:12px;display:none;padding:4px 0;"></div>' +
        '<button id="su-pf-save" class="su-btn su-btn-purple" style="padding:12px;font-size:14px;margin-top:4px;">' + (editingPlaceId ? '💾 Guardar cambios' : '💾 Guardar en Airtable') + '</button>' +
      '</div>';

    document.body.appendChild(modal);
    // Inicializar fotos en el campo hidden
    document.getElementById('su-pf-photos-json').value = JSON.stringify(photos);
    document.getElementById('su-pf-close').addEventListener('click', () => modal.remove());

    // ── Subcategorías: cambiar al seleccionar categoría ───────
    document.getElementById('su-pf-cat').addEventListener('change', async e => {
      const catKey = e.target.value;
      const subs = catKey ? allSubcats.filter(s => s.category_key === catKey) : [];
      const tagsHidden = document.getElementById('su-pf-tags-hidden');
      const currentTags = tagsHidden.value ? tagsHidden.value.split(',').filter(Boolean) : [];
      document.getElementById('su-pf-subcats').innerHTML = renderSubcatChips(subs, currentTags);
      // Re-bind chip clicks
      _bindSubcatChips();
    });

    function _bindSubcatChips() {
      document.querySelectorAll('.su-subcat-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-val');
          const tagsHidden = document.getElementById('su-pf-tags-hidden');
          let tags = tagsHidden.value ? tagsHidden.value.split(',').filter(Boolean) : [];
          if (tags.includes(val)) {
            tags = tags.filter(t => t !== val);
            btn.classList.remove('on');
            btn.style.borderColor = 'rgba(255,255,255,0.15)';
            btn.style.background  = 'rgba(255,255,255,0.05)';
            btn.style.color       = '#9ca3af';
          } else {
            tags.push(val);
            btn.classList.add('on');
            btn.style.borderColor = '#00bcd4';
            btn.style.background  = 'rgba(0,188,212,0.2)';
            btn.style.color       = '#67e8f9';
          }
          tagsHidden.value = tags.join(',');
        });
      });
    }
    _bindSubcatChips();


    function _refreshGallery() {
      const galEl = document.getElementById('su-pf-gallery');
      galEl.innerHTML =
        renderGalleryItems(photos) +
        (photos.length < 5
          ? '<div id="su-gal-add-btn" style="width:80px;height:80px;flex-shrink:0;border-radius:10px;border:1.5px dashed rgba(255,255,255,0.2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;font-size:11px;gap:4px;background:rgba(255,255,255,0.03);"><span style="font-size:22px;">+</span><span>Añadir</span></div>'
          : '');
      document.getElementById('su-pf-photos-json').value = JSON.stringify(photos);
      _bindGalleryEvents();
    }

    function _bindGalleryEvents() {
      // Eliminar foto
      document.querySelectorAll('.su-gal-del').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-idx'));
          photos.splice(idx, 1);
          _refreshGallery();
        });
      });
      // Botón añadir
      document.getElementById('su-gal-add-btn')?.addEventListener('click', () => {
        document.getElementById('su-gal-add-panel').style.display = 'flex';
      });
    }
    _bindGalleryEvents();

    // ── Galería add-panel: tabs ────────────────────────────────
    window._suGalTab = (tab) => {
      const isUpload = tab === 'upload';
      document.getElementById('su-gal-panel-upload').style.display = isUpload ? 'block' : 'none';
      document.getElementById('su-gal-panel-url').style.display   = isUpload ? 'none' : 'flex';
      document.getElementById('su-gal-tab-upload').style.background = isUpload ? 'rgba(0,188,212,0.25)' : 'transparent';
      document.getElementById('su-gal-tab-upload').style.color    = isUpload ? '#67e8f9' : '#9ca3af';
      document.getElementById('su-gal-tab-url').style.background  = isUpload ? 'transparent' : 'rgba(99,102,241,0.25)';
      document.getElementById('su-gal-tab-url').style.color       = isUpload ? '#9ca3af' : '#a5b4fc';
    };

    document.getElementById('su-gal-add-cancel').addEventListener('click', () => {
      document.getElementById('su-gal-add-panel').style.display = 'none';
    });

    // Agregar por URL
    document.getElementById('su-gal-url-add').addEventListener('click', () => {
      const url = document.getElementById('su-gal-url-input').value.trim();
      if (!url) return;
      if (photos.length >= 5) { alert('Máximo 5 fotos.'); return; }
      photos.push(url);
      document.getElementById('su-gal-url-input').value = '';
      document.getElementById('su-gal-add-panel').style.display = 'none';
      _refreshGallery();
    });
    document.getElementById('su-gal-url-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('su-gal-url-add').click();
    });

    // Agregar por archivo — sube a Supabase Storage
    document.getElementById('su-gal-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Solo imágenes.'); return; }
      if (file.size > 5 * 1024 * 1024) { alert('Máx 5 MB.'); return; }
      if (photos.length >= 5) { alert('Máximo 5 fotos.'); return; }

      const label = document.getElementById('su-gal-file-label');
      label.style.opacity = '0.5';
      const origText = label.childNodes[0]?.textContent || '';
      label.childNodes[0].textContent = '⏳ Subiendo...';

      try {
        const { getSupabase } = await import('/src/services/SupabaseService.js');
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase no inicializado');

        const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
        const path = 'places/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;

        const { error } = await supabase.storage
          .from('place-photos')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;

        const { data: urlData } = supabase.storage.from('place-photos').getPublicUrl(path);
        photos.push(urlData.publicUrl);
        document.getElementById('su-gal-add-panel').style.display = 'none';
        _refreshGallery();
      } catch(err) {
        alert('Error al subir: ' + err.message);
      } finally {
        label.style.opacity = '';
        if (label.childNodes[0]) label.childNodes[0].textContent = origText;
        e.target.value = '';
      }
    });

    // ── Tomar coordenadas del mapa ────────────────────────────
    document.getElementById('su-pf-pick-coords').addEventListener('click', () => {
      const tagsVal = document.getElementById('su-pf-tags-hidden').value;
      const snap = {
        name:               document.getElementById('su-pf-name').value,
        category:           document.getElementById('su-pf-cat').value,
        formatted_address:  document.getElementById('su-pf-address').value,
        phone:              document.getElementById('su-pf-phone').value,
        website:            document.getElementById('su-pf-website').value,
        rating:             document.getElementById('su-pf-rating').value,
        user_ratings_total: document.getElementById('su-pf-reviews-count').value,
        description:        document.getElementById('su-pf-description').value,
        place_id:           prefill?.place_id || '',
        subcategory_tags:   tagsVal ? tagsVal.split(',').filter(Boolean) : [],
        photos_urls:        photos,
        photo_url:          photos[0] || '',
        reviews:            prefill?.reviews || [],
        opening_hours:      (() => {
          const hrs = {};
          document.querySelectorAll('.su-pf-hours-input').forEach(inp => { const v = inp.value.trim(); if (v) hrs[inp.getAttribute('data-day')] = v; });
          return Object.keys(hrs).length ? hrs : null;
        })(),
        editorial_summary:  prefill?.editorial_summary || '',
        types:              prefill?.types || '',
      };
      modal.remove();
      this._pickCoordsFromMap((lat, lng) => this._openPlaceForm({ ...snap, lat, lng }, editingPlaceId));
    });

    // ── Guardar en Airtable ───────────────────────────────────
    document.getElementById('su-pf-save').addEventListener('click', async () => {
      const name     = document.getElementById('su-pf-name').value.trim();
      const category = document.getElementById('su-pf-cat').value;
      const lat      = parseFloat(document.getElementById('su-pf-lat').value);
      const lng      = parseFloat(document.getElementById('su-pf-lng').value);
      const errEl    = document.getElementById('su-pf-error');

      if (!name || !category || isNaN(lat) || isNaN(lng)) {
        errEl.textContent = 'Nombre, categoría y coordenadas son obligatorios.';
        errEl.style.display = 'block';
        return;
      }
      errEl.style.display = 'none';
      const saveBtn = document.getElementById('su-pf-save');
      saveBtn.textContent = 'Guardando...';
      saveBtn.disabled = true;

      const tagsVal = document.getElementById('su-pf-tags-hidden').value;
      const subcategoryTags = tagsVal ? tagsVal.split(',').filter(Boolean) : [];

      try {
        const isEdit = !!editingPlaceId;
        const payload = {
          place_name:        name,
          category,
          lat, lng,
          formatted_address: document.getElementById('su-pf-address').value.trim() || '',
          phone:             document.getElementById('su-pf-phone').value.trim() || '',
          website:           document.getElementById('su-pf-website').value.trim() || '',
          photo_url:          photos[0] || '',
          photos_urls:        photos,
          subcategory_tags:   subcategoryTags,
          rating:             document.getElementById('su-pf-rating').value || null,
          user_ratings_total: document.getElementById('su-pf-reviews-count').value || null,
          description:        document.getElementById('su-pf-description').value.trim() || null,
          editorial_summary:  prefill?.editorial_summary || null,
          reviews:            prefill?.reviews?.length ? prefill.reviews : null,
          opening_hours:      (() => {
            const hrs = {};
            document.querySelectorAll('.su-pf-hours-input').forEach(inp => { const v = inp.value.trim(); if (v) hrs[inp.getAttribute('data-day')] = v; });
            return Object.keys(hrs).length ? hrs : null;
          })(),
          types:              prefill?.types || '',
          featured:           document.getElementById('su-pf-featured').value || null,
          ...(isEdit
            ? { place_id: editingPlaceId }
            : { place_id: prefill?.place_id || null }),
        };
        const res = await fetch(isEdit ? '/api/supabase-place-update' : '/api/supabase-place-save', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        modal.remove();

        // Invalidar cache

        const mapView=window.wpApp?.mapView;
        if(mapView&&mapView.currentCatId)await mapView.loadCategory(mapView.currentCatId);

        if (isEdit) {
          this._showToast('✅ Cambios guardados en Airtable');
          // Pequeña pausa para que el toast sea visible, luego volver al hub
          setTimeout(() => this._openPlaces(), 1200);
        } else {
          this._showToast('✅ Lugar guardado — aparece en el mapa');
        }
      } catch(e) {
        errEl.textContent = 'Error: ' + e.message;
        errEl.style.display = 'block';
        saveBtn.textContent = '💾 Guardar en Airtable';
        saveBtn.disabled = false;
      }
    });
  }

  // ── Tomar coordenadas tocando el mapa ──────────────────────
  _pickCoordsFromMap(callback) {
    document.getElementById('su-coords-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'su-coords-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#0891b2,#2563eb);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:14px;';
    banner.innerHTML = '<span>Toca el mapa para obtener coordenadas</span><button id="su-coords-cancel" style="background:rgba(255,255,255,0.2);border:none;border-radius:8px;color:#fff;padding:6px 12px;cursor:pointer;font-size:13px;">Cancelar</button>';
    document.body.appendChild(banner);

    const cancel = () => { banner.remove(); this._openPlaceForm(null); };
    document.getElementById('su-coords-cancel').addEventListener('click', cancel);

    const mapGL = this.mapView?.map;
    if (!mapGL) { banner.remove(); callback(26.0607, -98.0635); return; }
    mapGL.once('click', (e) => { banner.remove(); callback(e.lngLat.lat, e.lngLat.lng); });
  }

  _injectStyles() {
    if (document.getElementById('su-styles')) return;
    const style = document.createElement('style');
    style.id = 'su-styles';
    style.textContent = `
      /* ── FAB ── */
      #su-fab {
        position: fixed;
        bottom: calc(26dvh + 80px);
        right: 14px;
        width: 44px; height: 44px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #1e1e2e, #2d2d44);
        box-shadow: 0 2px 12px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.08);
        font-size: 20px;
        cursor: pointer;
        z-index: 99990;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.2s;
      }
      #su-fab:active { transform: scale(0.92); }

      /* ── Panel principal ── */
      #su-panel {
        position: fixed;
        bottom: 70px;
        right: 14px;
        width: 260px;
        max-height: calc(100dvh - 130px);
        background: rgba(18,18,32,0.97);
        backdrop-filter: blur(16px);
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        z-index: 99991;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: scale(0.85) translateY(10px);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.2s ease, opacity 0.2s ease;
        font-family: 'Uni Sans Bold Regular', sans-serif;
      }
      #su-panel.visible {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }
      .su-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        color: #e2e8f0; font-size: 13px; font-weight: 700;
        flex-shrink: 0;
      }
      .su-panel-header button {
        background: none; border: none; color: #9ca3af;
        font-size: 16px; cursor: pointer; padding: 0 4px;
      }
      .su-panel-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; overflow-x: hidden; flex: 1; -webkit-overflow-scrolling: touch; }

      /* ── Botones ── */
      .su-btn {
        width: 100%; padding: 10px 14px;
        border: none; border-radius: 12px;
        font-size: 13px; font-weight: 700;
        cursor: pointer; text-align: left;
        font-family: 'Uni Sans Bold Regular', sans-serif;
        transition: opacity 0.15s, transform 0.1s;
      }
      .su-btn:active { transform: scale(0.97); opacity: 0.85; }
      .su-btn-cyan   { background: linear-gradient(135deg,#00bcd4,#0097a7); color: white; }
      .su-btn-purple { background: linear-gradient(135deg,#2563eb,#1a4dbf); color: white; }
      .su-btn-gray   { background: rgba(255,255,255,0.08); color: #e2e8f0; }
      .su-divider    { height: 1px; background: rgba(255,255,255,0.06); }
      .su-hint       { font-size: 11px; color: #6b7280; line-height: 1.4; }

      /* ── Pick banner ── */
      #su-pick-banner {
        position: fixed;
        top: 70px; left: 50%; transform: translateX(-50%) translateY(-120px);
        background: rgba(0,188,212,0.95);
        backdrop-filter: blur(8px);
        color: white; border-radius: 30px;
        padding: 10px 20px;
        display: flex; align-items: center; gap: 12px;
        z-index: 99995;
        font-size: 13px; font-weight: 700;
        box-shadow: 0 4px 20px rgba(0,188,212,0.4);
        transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        font-family: 'Uni Sans Bold Regular', sans-serif;
        white-space: nowrap;
      }
      #su-pick-banner.visible { transform: translateX(-50%) translateY(0); }
      #su-pick-cancel {
        background: rgba(255,255,255,0.25); border: none;
        color: white; border-radius: 20px;
        padding: 4px 12px; font-size: 12px; font-weight: 700;
        cursor: pointer;
      }

      /* ── Formulario modal ── */
      #su-form-modal {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 99996;
        display: flex; align-items: flex-end; justify-content: center;
        opacity: 0; pointer-events: none;
        transition: opacity 0.2s;
      }
      #su-form-modal.visible { opacity: 1; pointer-events: all; }
      .su-form-card {
        width: 100%; max-width: 460px;
        max-height: 92dvh;
        background: #1a1a2e;
        border-radius: 24px 24px 0 0;
        border-top: 1px solid rgba(255,255,255,0.1);
        transform: translateY(40px);
        transition: transform 0.3s cubic-bezier(0.34,1.2,0.64,1);
        font-family: 'Uni Sans Bold Regular', sans-serif;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #su-form-modal.visible .su-form-card { transform: translateY(0); }
      .su-form-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 20px 0; margin-bottom: 16px; color: #e2e8f0; font-size: 15px; font-weight: 800;
        flex-shrink: 0;
      }
      .su-form-header button { background: none; border: none; color: #9ca3af; font-size: 18px; cursor: pointer; }
      /* Nuevo wrapper interior scrolleable */
      .su-form-scroll { padding: 0 20px 28px; overflow-y: auto; overflow-x: hidden; flex: 1; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 0; }
      .su-input {
        width: 100%; box-sizing: border-box;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px; padding: 10px 14px;
        color: #e2e8f0; font-size: 14px; outline: none;
        margin-bottom: 10px;
        font-family: 'Uni Sans Bold Regular', sans-serif;
      }
      .su-input::placeholder { color: #4b5563; }
      .su-input:focus { border-color: #00bcd4; }
      .su-label { font-size: 11px; color: #9ca3af; margin-bottom: 6px; }
      .su-coord-display {
        font-size: 11px; color: #6b7280;
        margin: 8px 0; text-align: center;
      }
      .su-form-actions {
        display: flex; gap: 10px; margin-top: 14px;
      }
      .su-form-actions .su-btn { flex: 1; text-align: center; }
      .su-form-error { color: #f87171; font-size: 12px; margin-top: 8px; min-height: 16px; }

      /* ── Emoji grid ── */
      .su-sticker-grid {
        display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;
      }
      .su-emoji-btn {
        width: 38px; height: 38px; border-radius: 10px;
        border: 2px solid transparent;
        background: rgba(255,255,255,0.06);
        font-size: 20px; cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
      }
      .su-emoji-btn.active {
        border-color: #00bcd4;
        background: rgba(0,188,212,0.15);
      }

      /* ── Color row ── */
      .su-color-row { display: flex; gap: 8px; margin-bottom: 12px; }
      .su-color-btn {
        width: 26px; height: 26px; border-radius: 50%;
        border: 3px solid transparent; cursor: pointer;
        transition: border-color 0.15s, transform 0.1s;
      }
      .su-color-btn.active { border-color: white; transform: scale(1.2); }

      /* ── Lista panel ── */
      #su-list-panel {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        max-height: 60dvh;
        background: #1a1a2e;
        border-radius: 24px 24px 0 0;
        border-top: 1px solid rgba(255,255,255,0.1);
        z-index: 99993;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.34,1.2,0.64,1);
        font-family: 'Uni Sans Bold Regular', sans-serif;
        overflow: hidden;
      }
      #su-list-panel.visible { transform: translateY(0); }
      .su-list-body { overflow-y: auto; max-height: calc(60dvh - 50px); padding: 10px 14px; }
      .su-list-row {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .su-list-emoji { font-size: 24px; flex-shrink: 0; }
      .su-list-info { flex: 1; min-width: 0; }
      .su-list-name { font-size: 13px; color: #e2e8f0; font-weight: 700; }
      .su-list-meta { font-size: 10px; color: #6b7280; margin-top: 2px; }
      .su-list-del {
        background: none; border: none; font-size: 18px;
        cursor: pointer; flex-shrink: 0; opacity: 0.6;
      }
      .su-btn-orange { background: linear-gradient(135deg,#f59e0b,#d97706); color: white; }
      .su-btn-teal   { background: linear-gradient(135deg,#0891b2,#0e7490); color: white; }

      /* ── Categories panels ── */
      #su-cat-panel, #su-subcat-panel {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        max-height: 70dvh;
        background: #1a1a2e;
        border-radius: 24px 24px 0 0;
        border-top: 1px solid rgba(255,255,255,0.1);
        z-index: 99993;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.34,1.2,0.64,1);
        font-family: 'Uni Sans Bold Regular', sans-serif;
        overflow: hidden;
      }
      #su-cat-panel.visible, #su-subcat-panel.visible { transform: translateY(0); }
      #su-subcat-panel { z-index: 99994; }
      .su-cat-toolbar { padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .su-btn-sm { padding: 7px 14px; font-size: 12px; width: auto; display: inline-block; }
      .su-row-actions { display: flex; gap: 4px; flex-shrink: 0; }
      .su-icon-btn {
        background: rgba(255,255,255,0.06); border: none;
        border-radius: 8px; padding: 5px 7px;
        font-size: 15px; cursor: pointer;
        transition: background 0.15s;
      }
      .su-icon-btn:active { background: rgba(255,255,255,0.15); }
      .su-icon-btn.dim { opacity: 0.4; }
      .su-icon-btn.danger:active { background: rgba(239,68,68,0.2); }
      .su-cat-color-row { display: flex; gap: 8px; margin-bottom: 12px; }

      /* ── Cat form modal ── */
      #su-cat-form-modal {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 99997;
        display: flex; align-items: flex-end; justify-content: center;
        opacity: 0; pointer-events: none;
        transition: opacity 0.2s;
      }
      #su-cat-form-modal.visible { opacity: 1; pointer-events: all; }

      /* ── Size / Border ── */
      .su-size-row { display:flex; gap:8px; margin:4px 0 10px; }
      .su-size-btn {
        flex:1; padding:8px 4px;
        border-radius:10px;
        border:2px solid rgba(255,255,255,0.15);
        background:rgba(255,255,255,0.07);
        color:#e2e8f0; font-size:13px; font-weight:700;
        cursor:pointer; transition:all 0.15s;
        font-family:'Uni Sans Bold Regular',sans-serif;
      }
      .su-size-btn.active { background:#2563eb; border-color:#2563eb; color:white; }
      .su-border-row { display:flex; gap:8px; flex-wrap:wrap; margin:4px 0 10px; }
      .su-cat-chip {
        padding:4px 10px; border-radius:20px; border:1.5px solid rgba(255,255,255,0.2);
        background:rgba(255,255,255,0.06); color:#9ca3af; font-size:12px; cursor:pointer;
        transition:all 0.2s; font-family:inherit;
      }
      .su-cat-chip.active { background:rgba(0,188,212,0.18); border-color:#00bcd4; color:#fff; }
      .su-toggle-wrap { position:relative; display:inline-block; width:38px; height:21px; flex-shrink:0; }
      .su-toggle-wrap input { opacity:0; width:0; height:0; }
      .su-toggle-slider { position:absolute; inset:0; background:rgba(255,255,255,0.15); border-radius:21px; cursor:pointer; transition:0.3s; }
      .su-toggle-slider:before { content:""; position:absolute; width:15px; height:15px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:0.3s; }
      .su-toggle-wrap input:checked + .su-toggle-slider { background:#00bcd4; }
      .su-toggle-wrap input:checked + .su-toggle-slider:before { transform:translateX(17px); }
    `;
    document.head.appendChild(style);
  }
}