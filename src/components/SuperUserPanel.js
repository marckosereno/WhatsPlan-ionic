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
import { _buildClusterStickerHtml, CLUSTER_MAX_CARDS, CLUSTER_CARD_SLOTS, placeIdOf } from '/src/components/MapView.js';

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
    // Long-press sobre un sticker de cluster (en MapView) → abre este panel
    this.mapView.onClusterCustomize = (group, existingCluster) => {
      this._openClusterCustomizePanel(group, existingCluster);
    };
  }

  unmount() {
    ['su-fab','su-panel','su-pick-banner','su-form-modal','su-list-panel','su-cat-panel','su-subcat-panel','su-cat-form-modal','su-cluster-modal']
      .forEach(id => document.getElementById(id)?.remove());
    this.mapView.onClusterCustomize = null;
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
      this.mapView?.enableDragMode?.(async (place, lat, lng) => {
        const pid = place.place_id || place.placeId;
        if (!pid) { this._showToast('⚠️ Lugar sin place_id — no se puede guardar'); return; }
        try {
          const res = await fetch('/api/supabase-place-update', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place_id: pid, lat, lng }),
          });
          if (!res.ok) throw new Error(await res.text());
          // Sincronizar en allPlaces para que persista al cambiar categoría
          const inAll = (this.mapView.allPlaces || []).find(pp => (pp.place_id || pp.placeId) === pid);
          if (inAll) {
            inAll.lat = lat; inAll.lng = lng;
            if (inAll.location) { inAll.location.lat = lat; inAll.location.lng = lng; }
          }
          this._showToast(`✅ "${place.name}" reposicionado`);
        } catch (err) {
          this._showToast('❌ ' + err.message);
        }
      });
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
          <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px;">
            <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
              <div class="su-label" style="margin:0;">Color de la etiqueta</div>
              <input id="su-field-label-color" type="color" value="#0a0a14" style="width:100%;height:32px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;cursor:pointer;padding:2px;">
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
              <div class="su-label" style="margin:0;">Lado</div>
              <div style="display:flex;gap:4px;">
                <button type="button" class="su-label-side-btn active" data-side="right" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(0,188,212,0.5);background:rgba(0,188,212,0.18);color:#67e8f9;font-size:11px;cursor:pointer;">Derecha →</button>
                <button type="button" class="su-label-side-btn" data-side="left" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:11px;cursor:pointer;">← Izquierda</button>
              </div>
            </div>
          </div>
          <input id="su-field-label-side-hidden" type="hidden" value="right">
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
    this._buildLabelSideRow();
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

  _buildLabelSideRow() {
    const btns = document.querySelectorAll('.su-label-side-btn');
    if (!btns.length) return;
    const hidden = document.getElementById('su-field-label-side-hidden');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.side;
        hidden.value = side;
        btns.forEach(b => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
          b.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
          b.style.color       = active ? '#67e8f9'              : '#9ca3af';
        });
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
      const labelColorVal = document.getElementById('su-field-label-color')?.value || null;
      const labelSideVal  = document.getElementById('su-field-label-side-hidden')?.value || 'right';

      const isEdit = !!this._editingId;
      await LandmarkService[isEdit ? 'update' : 'create']({
        ...(isEdit ? { id: this._editingId } : { lat: this.pendingLat, lng: this.pendingLng }),
        type, title, description, emoji, color,
        size, border_color: borderColorVal || null,
        icon_url: iconUrl || null,
        show_label: showLabel,
        visible_in_categories: visibleInCats,
        label_color: labelColorVal,
        label_side: labelSideVal,
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
      // Color y lado de la etiqueta
      const labelColorEl = document.getElementById('su-field-label-color');
      if (labelColorEl) labelColorEl.value = item.label_color || '#0a0a14';
      const side = item.label_side === 'left' ? 'left' : 'right';
      const sideHidden = document.getElementById('su-field-label-side-hidden');
      if (sideHidden) sideHidden.value = side;
      document.querySelectorAll('.su-label-side-btn').forEach(b => {
        const active = b.dataset.side === side;
        b.classList.toggle('active', active);
        b.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
        b.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
        b.style.color       = active ? '#67e8f9'              : '#9ca3af';
      });
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
  // CLUSTERS DE PINES (calles con negocios amontonados) — panel abierto
  // por MapView vía long-press sobre un sticker de cluster. A propósito
  // NO usa drag en vivo sobre el mapa (eso venía dando problemas) —
  // controles de campo (sliders/inputs) + una preview que se re-renderiza
  // con la MISMA función que dibuja el pin real (_buildClusterStickerHtml
  // importada de MapView.js), así el preview es fiel sin duplicar lógica.
  // ══════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════
  // CLUSTERS DE PINES — panel abierto por MapView vía long-press.
  // Interacción directa sobre el preview (a tamaño real, misma función
  // que dibuja el pin real): 1 dedo = mover, 2 dedos = pinch (escalar +
  // girar a la vez, como cualquier editor de fotos). Los controles
  // aparte son solo lo que un gesto no puede resolver: forma, borde,
  // stroke, color, y orden (traer al frente / enviar atrás).
  // ══════════════════════════════════════════════════════════

  _openClusterCustomizePanel(group, existingCluster) {
    document.getElementById('su-cluster-modal')?.remove();

    // placeIdOf() se importa de MapView.js — es la ÚNICA fuente de
    // verdad, usada acá y también dentro de _buildClusterStickerHtml y
    // _updateClusters(). Antes cada archivo tenía su propia copia de
    // esta fórmula, ligeramente distintas entre sí, y esa desincronización
    // era justo lo que rompía la edición para lugares sin place_id/id
    // ("se desordena todo", "algunas categorías no funcionan").

    const isEdit = !!existingCluster;
    let groupPlaces = group.map(({ el }) => el._place);
    const included = new Set(groupPlaces.map((p, i) => placeIdOf(p)));

    // ── Saneamiento de datos al cargar ──────────────────────────
    // El esquema de cards/stickers/badge cambió varias veces durante el
    // desarrollo (labels que se sacaron, "anchor" de stickers que pasó a
    // ser dx/dy, badge que pasó de ser un color-string a un objeto
    // completo, campo z que se agregó después, etc). Un cluster guardado
    // en una sesión vieja puede traer datos con esa forma anterior — y
    // eso es justo lo que explica "en algunos clusters sí, en otros no":
    // no es un bug de la interacción en sí, es que el dato de ESE
    // cluster en particular no tiene la forma que el código actual
    // espera, y algo revienta silenciosamente al leerlo. En vez de
    // perseguir síntomas uno por uno, se sanea todo UNA vez acá: cada
    // campo se valida por tipo con un default sensato, y cualquier
    // entrada que ni siquiera sea un objeto se descarta — así el resto
    // del código siempre trabaja con una forma garantizada,
    // independientemente de qué tan vieja sea la data.
    const sanitizeCard = (c) => {
      if (!c || typeof c !== 'object') return null;
      return {
        placeId: c.placeId,
        shape: c.shape === 'square' ? 'square' : 'portrait',
        rotation: Number.isFinite(c.rotation) ? c.rotation : 0,
        scale: Number.isFinite(c.scale) && c.scale > 0 ? c.scale : 1,
        dx: Number.isFinite(c.dx) ? c.dx : 0,
        dy: Number.isFinite(c.dy) ? c.dy : 0,
        borderColor: typeof c.borderColor === 'string' ? c.borderColor : '#ffffff',
        borderWidth: Number.isFinite(c.borderWidth) ? c.borderWidth : 2,
        borderRadius: Number.isFinite(c.borderRadius) ? c.borderRadius : 9,
        z: Number.isFinite(c.z) ? c.z : null, // null = se resuelve solo más abajo
      };
    };
    const sanitizeSticker = (s) => {
      if (!s || typeof s !== 'object') return null;
      if (typeof s.emoji !== 'string' && typeof s.imageUrl !== 'string') return null; // sticker sin contenido real, descartar
      return {
        emoji: typeof s.emoji === 'string' ? s.emoji : '',
        imageUrl: typeof s.imageUrl === 'string' ? s.imageUrl : '',
        dx: Number.isFinite(s.dx) ? s.dx : 0,
        dy: Number.isFinite(s.dy) ? s.dy : 0,
        size: Number.isFinite(s.size) && s.size > 0 ? s.size : 26,
        rotation: Number.isFinite(s.rotation) ? s.rotation : 0,
        strokeColor: typeof s.strokeColor === 'string' ? s.strokeColor : '#ffffff',
        strokeWidth: Number.isFinite(s.strokeWidth) ? s.strokeWidth : 2,
        z: Number.isFinite(s.z) ? s.z : null,
      };
    };
    const sanitizeBadge = (b) => ({
      dx: b && Number.isFinite(b.dx) ? b.dx : 34,
      dy: b && Number.isFinite(b.dy) ? b.dy : -28,
      scale: b && Number.isFinite(b.scale) && b.scale > 0 ? b.scale : 1,
      rotation: b && Number.isFinite(b.rotation) ? b.rotation : 0,
      // Versiones viejas guardaban `badgeColor` como string suelto en vez
      // de `badge.color` — se acepta cualquiera de los dos acá.
      color: (b && typeof b.color === 'string' ? b.color : (typeof b === 'string' ? b : '#111827')),
      // Texto custom del badge — si está vacío, _buildClusterStickerHtml
      // cae al conteo automático "+N" (o a nada, si es un pin de un solo
      // lugar). Pensado para reemplazar el "+1" sin sentido de un pin
      // único por texto propio ("Nuevo", "Top", etc).
      label: b && typeof b.label === 'string' ? b.label : '',
      z: b && Number.isFinite(b.z) ? b.z : 30,
    });
    const sanitizeLabel = (l) => ({
      text: l && typeof l.text === 'string' ? l.text : '',
      dx: l && Number.isFinite(l.dx) ? l.dx : 0,
      dy: l && Number.isFinite(l.dy) ? l.dy : 44,
      scale: l && Number.isFinite(l.scale) && l.scale > 0 ? l.scale : 1,
      rotation: l && Number.isFinite(l.rotation) ? l.rotation : 0,
      color: l && typeof l.color === 'string' ? l.color : '#1a1a2e',
      bg: l && typeof l.bg === 'string' ? l.bg : 'rgba(255,255,255,0.92)',
      z: l && Number.isFinite(l.z) ? l.z : 25,
    });

    let cards    = isEdit ? (existingCluster.cards || []).map(sanitizeCard).filter(Boolean) : [];
    let stickers = isEdit ? (existingCluster.stickers || []).map(sanitizeSticker).filter(Boolean) : [];
    let badge    = sanitizeBadge(isEdit ? existingCluster.badge : null);
    let label    = sanitizeLabel(isEdit ? existingCluster.label : null);

    let shownPlaces = groupPlaces.slice(0, CLUSTER_MAX_CARDS);
    let sel = null; // {kind:'card'|'sticker'|'badge', idx}

    const modal = document.createElement('div');
    modal.id = 'su-cluster-modal';
    modal.className = 'su-modal-overlay';
    modal.innerHTML = `
      <div class="su-modal-box" style="max-width:400px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:15px;font-weight:700;color:#e5e7eb;">${isEdit ? '✏️ Editar' : '✨ Personalizar'} ${groupPlaces.length === 1 ? 'pin' : 'cluster'}</span>
          <button type="button" id="su-cluster-close" style="background:none;border:none;color:#9ca3af;font-size:20px;cursor:pointer;line-height:1;">×</button>
        </div>

        <div style="font-size:9.5px;color:#6b7280;margin-bottom:6px;">1 dedo mueve · 2 dedos giran y escalan · tocá para seleccionar</div>
        <div id="su-cluster-preview" style="position:relative;width:100%;height:260px;background:repeating-conic-gradient(#20202c 0% 25%, #17171f 0% 50%) 50% / 16px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);margin-bottom:10px;overflow:hidden;touch-action:none;"></div>

        <div id="su-cluster-sel-props" style="display:none;background:rgba(0,188,212,0.08);border:1px solid rgba(0,188,212,0.25);border-radius:10px;padding:10px;margin-bottom:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span id="su-cluster-sel-title" style="font-size:11px;font-weight:700;color:#67e8f9;"></span>
            <div style="display:flex;gap:4px;">
              <button type="button" id="su-cluster-sel-back" title="Retroceder un paso" style="background:rgba(255,255,255,0.1);border:none;color:#d1d5db;font-size:11px;font-weight:600;padding:8px 12px;border-radius:7px;cursor:pointer;">⬇ Atrás</button>
              <button type="button" id="su-cluster-sel-front" title="Avanzar un paso" style="background:rgba(255,255,255,0.1);border:none;color:#d1d5db;font-size:11px;font-weight:600;padding:8px 12px;border-radius:7px;cursor:pointer;">⬆ Adelante</button>
              <button type="button" id="su-cluster-sel-deselect" style="background:none;border:none;color:#9ca3af;font-size:11px;cursor:pointer;">Listo</button>
            </div>
          </div>
          <div id="su-cluster-sel-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;max-height:38vh;overflow-y:auto;">

          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
              <div id="su-cluster-cards-count" style="font-size:10px;color:#6b7280;">Tarjetas (${shownPlaces.length} de ${groupPlaces.length} lugares)</div>
            </div>
            <div id="su-cluster-cards-chips" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
          </div>

          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
              <div style="font-size:10px;color:#6b7280;">Stickers</div>
              <button type="button" id="su-cluster-add-sticker" style="font-size:10px;padding:3px 9px;border-radius:5px;border:none;background:#1a5cf5;color:#fff;font-weight:700;cursor:pointer;">+ Agregar</button>
            </div>
            <div id="su-cluster-stickers-chips" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
          </div>

          <div>
            <div style="font-size:10px;color:#6b7280;margin-bottom:5px;">Badge "+N"</div>
            <button type="button" id="su-cluster-badge-chip" style="padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10.5px;cursor:pointer;">🔢 Seleccionar badge</button>
          </div>

          <div>
            <div style="font-size:10px;color:#6b7280;margin-bottom:5px;">Etiqueta de texto (separada del badge)</div>
            <button type="button" id="su-cluster-label-chip" style="padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10.5px;cursor:pointer;">🏷️ ${label.text ? 'Editar etiqueta' : 'Agregar etiqueta'}</button>
          </div>

          <div>
            <div id="su-cluster-places-count" style="font-size:10px;color:#6b7280;margin-bottom:5px;">Lugares incluidos (${groupPlaces.length})</div>
            <div id="su-cluster-places-list" style="display:flex;flex-direction:column;gap:6px;max-height:110px;overflow-y:auto;background:rgba(255,255,255,0.04);border-radius:8px;padding:8px;margin-bottom:8px;"></div>
            <div style="font-size:10px;color:#6b7280;margin-bottom:5px;">Agregar otro lugar (de toda la categoría, no solo los cercanos)</div>
            <input id="su-cluster-add-place-search" type="text" placeholder="Buscar por nombre..." style="width:100%;padding:7px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#e5e7eb;font-size:12px;box-sizing:border-box;">
            <div id="su-cluster-add-place-results" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;max-height:140px;overflow-y:auto;"></div>
          </div>

        </div>

        <div style="display:flex;gap:8px;margin-top:14px;">
          ${isEdit ? `<button type="button" id="su-cluster-delete" style="padding:10px 12px;border-radius:8px;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.12);color:#f87171;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">Quitar</button>` : ''}
          <button type="button" id="su-cluster-save" style="flex:1;padding:10px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#1a5cf5,#1540cc);color:#fff;font-size:13px;font-weight:800;cursor:pointer;">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const previewEl = modal.querySelector('#su-cluster-preview');
    const currentCustomDef = () => ({ cards, stickers, badge, label });

    const getCardOverride = (pid) => {
      let c = cards.find(c => c.placeId === pid);
      if (!c) {
        const i = shownPlaces.findIndex((p, idx) => placeIdOf(p) === pid);
        const slot = CLUSTER_CARD_SLOTS[i] || CLUSTER_CARD_SLOTS[CLUSTER_CARD_SLOTS.length - 1];
        // Usar la posición/giro/tamaño DEL SLOT como punto de partida —
        // no hardcodeado en 0/0/0/1. "Adelante"/"Atrás" recorre TODOS los
        // elementos del cluster para calcular el orden (allElements()),
        // creando una entrada nueva acá para cualquier tarjeta que
        // todavía no tuviera una guardada — con 0/0/0/1 (el centro) como
        // default, cualquier tarjeta sin editar previamente saltaba al
        // centro apenas usabas Adelante/Atrás sobre CUALQUIER otra
        // tarjeta del mismo cluster, sin siquiera haberla tocado.
        c = { placeId: pid, shape: 'portrait', rotation: slot.rot, scale: slot.scale, dx: slot.dx, dy: slot.dy, borderColor: '#ffffff', borderWidth: 2, borderRadius: 9, z: slot.z };
        cards.push(c);
      }
      return c;
    };

    // ── Orden (adelante/atrás DE A UNO, no al extremo) ──────────
    // Junta tarjetas + stickers + badge, ordenados por su z actual, y
    // "avanzar"/"retroceder" intercambia el z con el VECINO inmediato en
    // ese orden — un paso por vez, no un salto al frente/fondo absoluto.
    //
    // Si algún elemento viene de una sesión vieja (guardado antes de que
    // existiera el campo `z`), sin este chequeo caían todos a 0 con el
    // `?? 0` de abajo y, al haber varios "empatados" en el mismo valor,
    // el intercambio terminaba siendo un no-op (0 se cambia por 0) —
    // por eso después de un rato "dejaba de funcionar". Acá se le asigna
    // un z real y ÚNICO la primera vez que se detecta uno faltante o
    // repetido, autoreparando datos viejos.
    const allElements = () => {
      const list = [];
      shownPlaces.forEach((place, i) => {
        const ov = getCardOverride(placeIdOf(place));
        if (ov.z == null) ov.z = (CLUSTER_CARD_SLOTS[i] || CLUSTER_CARD_SLOTS[CLUSTER_CARD_SLOTS.length - 1]).z;
        list.push({ kind: 'card', ref: ov });
      });
      stickers.forEach((s, i) => { if (s.z == null) s.z = 20 + i; list.push({ kind: 'sticker', ref: s }); });
      if (badge.z == null) badge.z = 30;
      list.push({ kind: 'badge', ref: badge });
      if (label.z == null) label.z = 25;
      if (label.text) list.push({ kind: 'label', ref: label }); // solo entra al orden si tiene texto (si no, no se dibuja)
      // Deduplicar z repetidos (de datos viejos) reasignando en el
      // mismo orden en que ya estaban, sin cambiar el orden visual actual.
      const seen = new Set();
      list.sort((a, b) => (a.ref.z ?? 0) - (b.ref.z ?? 0)).forEach(e => {
        while (seen.has(e.ref.z)) e.ref.z += 1;
        seen.add(e.ref.z);
      });
      return list;
    };
    const stepZ = (obj, direction) => { // direction: +1 adelante, -1 atrás
      const list = allElements().sort((a, b) => (a.ref.z ?? 0) - (b.ref.z ?? 0));
      const idx = list.findIndex(e => e.ref === obj);
      if (idx === -1) return;
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= list.length) return; // ya está en la punta, no hay con quién cambiar
      const other = list[swapIdx].ref;
      const tmp = obj.z;
      obj.z = other.z;
      other.z = tmp;
    };
    const bringForwardOne = (obj) => stepZ(obj, 1);
    const sendBackwardOne = (obj) => stepZ(obj, -1);

    // ── Preview + gesto (1 dedo mover, 2 dedos pinch escalar+girar) ──
    function renderPreview() {
      try {
        const cd = currentCustomDef();
        previewEl.innerHTML = `<div style="position:relative;width:100%;height:100%;">${_buildClusterStickerHtml(group, cd)}</div>`;
        const wrap = previewEl.firstElementChild.firstElementChild;
        // touch-action:none se aplica ACÁ, no en _buildClusterStickerHtml
        // (que también dibuja el pin real en el mapa) — solo adentro de
        // este editor hace falta bloquear el gesto nativo del navegador
        // para poder manejar el pellizco a mano; en el mapa real ese
        // mismo touch-action:none rompía el pan nativo del mapa cuando
        // el drag arrancaba justo sobre una tarjeta/sticker/badge (el
        // "barrido" — MapLibre perdía el manejo fluido por compositor y
        // pasaba a un fallback más entrecortado).
        wrap.querySelectorAll('[data-card-idx],[data-sticker-idx],[data-badge],[data-label]').forEach(node => {
          node.style.touchAction = 'none';
        });
        wrap.querySelectorAll('[data-card-idx]').forEach(node => {
          const idx = parseInt(node.dataset.cardIdx, 10);
          if (sel?.kind === 'card' && sel.idx === idx) { node.style.outline = '2px dashed #67e8f9'; node.style.outlineOffset = '2px'; }
        });
        wrap.querySelectorAll('[data-sticker-idx]').forEach(node => {
          const idx = parseInt(node.dataset.stickerIdx, 10);
          if (sel?.kind === 'sticker' && sel.idx === idx) { node.style.outline = '2px dashed #67e8f9'; node.style.outlineOffset = '2px'; }
        });
        const badgeNode = wrap.querySelector('[data-badge]');
        if (badgeNode && sel?.kind === 'badge') { badgeNode.style.outline = '2px dashed #67e8f9'; badgeNode.style.outlineOffset = '2px'; }
        const labelNode = wrap.querySelector('[data-label]');
        if (labelNode && sel?.kind === 'label') { labelNode.style.outline = '2px dashed #67e8f9'; labelNode.style.outlineOffset = '2px'; }
      } catch (err) {
        // Con los datos ya saneados esto no debería pasar más, pero si
        // algo se escapa igual, que quede bien visible en la consola en
        // vez de dejar el preview "congelado" en silencio.
        console.error('[CLUSTER] renderPreview() excepción:', err);
      }
    }

    // Resuelve a qué (kind, idx, obj) corresponde un nodo del preview.
    // Envuelto en try/catch a propósito: si algún lugar del grupo tiene
    // datos con una forma inesperada (típico de categorías con lugares
    // cargados a mano), que explote ACÁ no debe tirar abajo todo el
    // sistema de gestos para el resto de la sesión — antes una excepción
    // sin atrapar en medio de un pointerdown cortaba la ejecución justo
    // antes de setPointerCapture()/pts.set(), dejando el drag muerto
    // silenciosamente ("a veces solo el badge" funcionaba porque el badge
    // no depende de shownPlaces, así que nunca disparaba este error).
    function resolveNode(node) {
      if (!node) return null;
      try {
        if (node.dataset.cardIdx !== undefined) {
          const idx = parseInt(node.dataset.cardIdx, 10);
          const place = shownPlaces[idx];
          if (!place) { console.error('[CLUSTER] resolveNode: no hay lugar en shownPlaces[' + idx + ']'); return null; }
          return { kind: 'card', idx, obj: getCardOverride(placeIdOf(place)) };
        }
        if (node.dataset.stickerIdx !== undefined) {
          const idx = parseInt(node.dataset.stickerIdx, 10);
          if (!stickers[idx]) { console.error('[CLUSTER] resolveNode: no hay sticker en idx ' + idx); return null; }
          return { kind: 'sticker', idx, obj: stickers[idx] };
        }
        if (node.hasAttribute('data-badge')) return { kind: 'badge', idx: 0, obj: badge };
        if (node.hasAttribute('data-label')) return { kind: 'label', idx: 0, obj: label };
      } catch (err) {
        console.error('[CLUSTER] resolveNode() excepción:', err);
      }
      return null;
    }

    // Busca en el DOM actual del preview el nodo que corresponde a `sel`
    // — hace falta porque el nodo original se destruye en cada
    // renderPreview() completo, así que el que quedó seleccionado antes
    // ya no es el mismo objeto DOM.
    function findSelNode() {
      if (!sel) return null;
      const wrap = previewEl.firstElementChild?.firstElementChild;
      if (!wrap) return null;
      let node = null;
      if (sel.kind === 'card') node = wrap.querySelector(`[data-card-idx="${sel.idx}"]`);
      else if (sel.kind === 'sticker') node = wrap.querySelector(`[data-sticker-idx="${sel.idx}"]`);
      else if (sel.kind === 'badge') node = wrap.querySelector('[data-badge]');
      else if (sel.kind === 'label') node = wrap.querySelector('[data-label]');
      if (!node) return null;
      const r = resolveNode(node);
      return r ? { node, obj: r.obj } : null;
    }

    // Gesto unificado A NIVEL DEL CONTENEDOR (previewEl), no por elemento:
    // tocar una tarjeta/sticker/badge lo selecciona — desde ahí, CUALQUIER
    // zona del preview (no hace falta seguir tocando el elemento chiquito)
    // sirve para moverlo/pellizcarlo, hasta que se toque otro elemento
    // distinto (ahí cambia la selección) o se cierre el panel. 1 dedo =
    // mover, 2 dedos = pellizco (distancia = tamaño, ángulo = giro).
    // Durante el gesto solo se toca el `transform` del nodo activo
    // (liviano, no regenera contenido); el re-render completo pasa
    // recién cuando se levanta el último dedo.
    let activeNode = null, activeObj = null, activeKind = null;
    const pts = new Map();
    let mode = null, start = null;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const baseTransform = () => `translate(calc(-50% + ${activeObj.dx || 0}px),calc(-50% + ${activeObj.dy || 0}px)) rotate(${activeObj.rotation || 0}deg)`;
    const metric = () => activeKind === 'sticker' ? (activeObj.size ?? 26) : (activeObj.scale ?? 1);

    previewEl.addEventListener('pointerdown', (e) => {
      try {
        const targetNode = e.target.closest('[data-card-idx],[data-sticker-idx],[data-badge],[data-label]');
        if (pts.size === 0) {
          if (targetNode) {
            const r = resolveNode(targetNode);
            if (!r) return;
            // Tocó un elemento DISTINTO al seleccionado → suelta el
            // anterior y pasa a controlar este.
            const isDifferent = !sel || sel.kind !== r.kind || sel.idx !== r.idx;
            if (isDifferent) select(r.kind, r.idx, targetNode);
            activeNode = targetNode; activeObj = r.obj; activeKind = r.kind;
          } else {
            // Tocó una zona vacía del preview: si YA hay algo seleccionado,
            // seguir controlando ESE elemento desde acá — no hace falta
            // tener los dedos exactos sobre él.
            const found = findSelNode();
            if (!found) return;
            activeNode = found.node; activeObj = found.obj; activeKind = sel.kind;
          }
        }
        if (!activeNode) return;
        e.preventDefault();
        previewEl.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) {
          mode = 'drag';
          start = { dx: activeObj.dx || 0, dy: activeObj.dy || 0, p: [...pts.values()][0] };
        } else if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          mode = 'pinch';
          start = { dist: dist(a, b) || 1, angle: angle(a, b), metric: metric(), rotation: activeObj.rotation || 0 };
        }
      } catch (err) {
        // Última red de seguridad: que un dato inesperado nunca deje el
        // gesto "congelado" en silencio — si algo se escapa del
        // saneamiento, esto lo hace visible en la consola.
        console.error('[CLUSTER] pointerdown excepción:', err);
      }
    });
    previewEl.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !activeNode) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === 'drag' && pts.size === 1) {
        const p = [...pts.values()][0];
        activeObj.dx = Math.round(start.dx + (p.x - start.p.x));
        activeObj.dy = Math.round(start.dy + (p.y - start.p.y));
        activeNode.style.transform = baseTransform();
      } else if (mode === 'pinch' && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = dist(a, b) || 1;
        const ratio = d / start.dist;
        const newMetric = start.metric * ratio;
        if (activeKind === 'sticker') activeObj.size = Math.max(12, Math.min(90, Math.round(newMetric)));
        else activeObj.scale = Math.max(0.35, Math.min(2.2, newMetric));
        activeObj.rotation = Math.round(start.rotation + (angle(a, b) - start.angle));
        // Preview en vivo: mueve+gira real (transform puro); el tamaño
        // real (cambia ancho/alto, contenido) se aplica al soltar —
        // mientras tanto un scale() visual da el feedback del pinch.
        const visualRatio = metric() / start.metric;
        activeNode.style.transform = baseTransform() + ` scale(${visualRatio})`;
      }
    });
    const releasePointer = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      try { previewEl.releasePointerCapture(e.pointerId); } catch (_) {}
      if (pts.size === 0) {
        mode = null;
        const hadActive = !!activeNode;
        activeNode = null; activeObj = null; activeKind = null;
        if (hadActive) { renderPreview(); renderSelProps(); }
      } else if (pts.size === 1 && activeObj) {
        // pasó de pellizco a un solo dedo sin soltar del todo: retoma el
        // drag desde la posición actual, sin saltos.
        mode = 'drag';
        const p = [...pts.values()][0];
        start = { dx: activeObj.dx || 0, dy: activeObj.dy || 0, p };
      }
    };
    previewEl.addEventListener('pointerup', releasePointer);
    previewEl.addEventListener('pointercancel', releasePointer);

    function select(kind, idx, node) {
      sel = { kind, idx };
      // A propósito NO llama a renderPreview() acá: esto se ejecuta desde
      // adentro de un pointerdown (ver wireGesture), y reconstruir el DOM
      // del preview en ese momento destruiría el nodo recién tocado antes
      // de que setPointerCapture() alcance a agarrarlo — el gesto se corta
      // a la mitad. Solo togglea el outline directo sobre los nodos que
      // ya están en pantalla.
      previewEl.querySelectorAll('[data-card-idx],[data-sticker-idx],[data-badge],[data-label]').forEach(n => {
        n.style.outline = ''; n.style.outlineOffset = '';
      });
      if (node) { node.style.outline = '2px dashed #67e8f9'; node.style.outlineOffset = '2px'; }
      renderSelProps();
      renderCardChips();
      renderStickerChips();
    }

    // ── Propiedades mínimas de lo seleccionado ──────────────────
    const selWrap = modal.querySelector('#su-cluster-sel-props');
    const selTitle = modal.querySelector('#su-cluster-sel-title');
    const selFields = modal.querySelector('#su-cluster-sel-fields');
    modal.querySelector('#su-cluster-sel-front').addEventListener('click', () => { if (!sel) return; bringForwardOne(currentSelObj()); renderPreview(); });
    modal.querySelector('#su-cluster-sel-back').addEventListener('click', () => { if (!sel) return; sendBackwardOne(currentSelObj()); renderPreview(); });
    modal.querySelector('#su-cluster-sel-deselect').addEventListener('click', () => { sel = null; renderPreview(); renderSelProps(); renderCardChips(); renderStickerChips(); });

    function currentSelObj() {
      if (sel.kind === 'card') { const place = shownPlaces[sel.idx]; return getCardOverride(placeIdOf(place)); }
      if (sel.kind === 'sticker') return stickers[sel.idx];
      return badge;
    }

    function renderSelProps() {
      if (!sel) { selWrap.style.display = 'none'; return; }
      selWrap.style.display = 'block';

      if (sel.kind === 'card') {
        const place = shownPlaces[sel.idx];
        const ov = getCardOverride(placeIdOf(place));
        selTitle.textContent = `📸 ${place.name || ''}`;
        selFields.innerHTML = `
          <div><div style="font-size:9px;color:#6b7280;">Forma</div>
            <select id="scf-shape" style="width:100%;padding:5px;border-radius:5px;border:1px solid rgba(255,255,255,0.14);background:#1a1a24;color:#d1d5db;font-size:11px;">
              <option value="portrait" ${ov.shape==='portrait'?'selected':''}>Portrait</option>
              <option value="square" ${ov.shape==='square'?'selected':''}>Square</option>
            </select></div>
          <div><div style="font-size:9px;color:#6b7280;">Tamaño (preciso)</div><input id="scf-scale" type="range" min="0.35" max="2.2" step="0.02" value="${ov.scale ?? 1}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Giro (preciso)</div><input id="scf-rot" type="range" min="-180" max="180" step="1" value="${ov.rotation || 0}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Border radius</div><input id="scf-radius" type="range" min="0" max="30" step="1" value="${ov.borderRadius}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Color de borde</div><input id="scf-bcolor" type="color" value="${ov.borderColor}" style="width:100%;height:28px;padding:0;border-radius:6px;border:1px solid rgba(255,255,255,0.14);background:none;cursor:pointer;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Grosor de borde</div><input id="scf-bwidth" type="range" min="0" max="6" step="0.5" value="${ov.borderWidth}" style="width:100%;accent-color:#1a5cf5;"></div>`;
        modal.querySelector('#scf-shape').addEventListener('change', (e) => { ov.shape = e.target.value; renderPreview(); });
        modal.querySelector('#scf-scale').addEventListener('input', (e) => { ov.scale = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-rot').addEventListener('input', (e) => { ov.rotation = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-radius').addEventListener('input', (e) => { ov.borderRadius = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-bcolor').addEventListener('input', (e) => { ov.borderColor = e.target.value; renderPreview(); });
        modal.querySelector('#scf-bwidth').addEventListener('input', (e) => { ov.borderWidth = parseFloat(e.target.value); renderPreview(); });

      } else if (sel.kind === 'sticker') {
        const s = stickers[sel.idx];
        if (!s) { sel = null; selWrap.style.display = 'none'; return; }
        selTitle.textContent = '✨ Sticker';
        selFields.innerHTML = `
          <div style="grid-column:1 / -1;display:flex;gap:8px;align-items:center;">
            <div style="flex:1;">
              <div style="font-size:9px;color:#6b7280;">Emoji</div>
              <input id="scf-emoji" type="text" maxlength="8" value="${s.emoji || ''}" style="width:100%;padding:6px;text-align:center;font-size:16px;border-radius:6px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#e5e7eb;box-sizing:border-box;">
            </div>
            <div style="font-size:9px;color:#6b7280;padding-top:14px;">o</div>
            <div style="flex:1;">
              <div style="font-size:9px;color:#6b7280;">Imagen propia</div>
              <label id="scf-image-label" style="display:flex;align-items:center;justify-content:center;gap:4px;width:100%;padding:6px;border-radius:6px;border:1px dashed rgba(255,255,255,0.25);background:rgba(255,255,255,0.03);color:#9ca3af;font-size:10.5px;cursor:pointer;box-sizing:border-box;">
                <span>${s.imageUrl ? '🖼️ Cambiar' : '📤 Subir'}</span>
                <input id="scf-image-file" type="file" accept="image/*" style="display:none;">
              </label>
            </div>
          </div>
          ${s.imageUrl ? `<div style="grid-column:1 / -1;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border-radius:6px;padding:5px 8px;">
            <img src="${s.imageUrl}" style="width:22px;height:22px;object-fit:contain;border-radius:4px;">
            <span style="font-size:10px;color:#9ca3af;flex:1;">Imagen propia activa</span>
            <button type="button" id="scf-image-remove" style="background:rgba(239,68,68,0.15);border:none;color:#f87171;font-size:9px;padding:3px 7px;border-radius:5px;cursor:pointer;">Quitar</button>
          </div>` : ''}
          <div><div style="font-size:9px;color:#6b7280;">Tamaño (preciso)</div><input id="scf-size" type="range" min="12" max="90" step="1" value="${s.size ?? 26}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Giro (preciso)</div><input id="scf-srot" type="range" min="-180" max="180" step="1" value="${s.rotation || 0}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Color de stroke</div><input id="scf-stroke" type="color" value="${s.strokeColor || '#ffffff'}" style="width:100%;height:28px;padding:0;border-radius:6px;border:1px solid rgba(255,255,255,0.14);background:none;cursor:pointer;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Grosor de stroke</div><input id="scf-strokew" type="range" min="0" max="6" step="0.5" value="${s.strokeWidth ?? 2}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div style="grid-column:1 / -1;"><button type="button" id="scf-remove" style="width:100%;padding:6px;border-radius:6px;border:none;background:rgba(239,68,68,0.15);color:#f87171;font-size:10px;cursor:pointer;">🗑️ Quitar sticker</button></div>`;
        // El teclado de emojis en móvil suele insertar el emoji como una
        // "composición" (IME) — dispara compositionstart/compositionend en
        // vez de (o antes que) un 'input' normal, y en varios navegadores
        // el 'input' que sí llega trae e.isComposing=true con el valor
        // todavía sin confirmar. Escuchando solo 'input' se perdía el
        // emoji hasta que algo más (como la barra espaciadora) forzaba un
        // 'input' final — por eso "aparecía al tocar espacio".
        const emojiEl = modal.querySelector('#scf-emoji');
        const applyEmoji = (e) => { s.emoji = e.target.value; if (e.target.value) s.imageUrl = ''; renderPreview(); }; // escribir emoji descarta la imagen propia (mismo criterio que el sticker del pin individual)
        emojiEl.addEventListener('input', (e) => { if (!e.isComposing) applyEmoji(e); });
        emojiEl.addEventListener('compositionend', applyEmoji);
        modal.querySelector('#scf-size').addEventListener('input', (e) => { s.size = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-srot').addEventListener('input', (e) => { s.rotation = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-stroke').addEventListener('input', (e) => { s.strokeColor = e.target.value; renderPreview(); });
        modal.querySelector('#scf-strokew').addEventListener('input', (e) => { s.strokeWidth = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-remove').addEventListener('click', () => { stickers.splice(sel.idx, 1); sel = null; renderPreview(); renderSelProps(); renderStickerChips(); });
        modal.querySelector('#scf-image-remove')?.addEventListener('click', () => { s.imageUrl = ''; renderPreview(); renderSelProps(); });

        // Subir imagen propia — mismo mecanismo que el sticker del pin
        // individual (comprimir a máx 300px + subir a Supabase Storage).
        modal.querySelector('#scf-image-file').addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) { alert('Solo imágenes.'); return; }
          if (file.size > 10 * 1024 * 1024) { alert('Imagen demasiado grande (máx 10 MB).'); return; }

          const label = modal.querySelector('#scf-image-label');
          const origHtml = label.innerHTML;
          label.style.opacity = '0.5';
          label.querySelector('span').textContent = '⏳ Subiendo...';

          const compressImage = (f) => new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(f);
            img.onload = () => {
              URL.revokeObjectURL(url);
              const MAX = 300; // los stickers son chicos, no hace falta más resolución
              let w = img.width, h = img.height;
              if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else       { w = Math.round(w * MAX / h); h = MAX; }
              }
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              canvas.getContext('2d').drawImage(img, 0, 0, w, h);
              canvas.toBlob(resolve, 'image/png', 0.9); // png para conservar transparencia si la tiene
            };
            img.src = url;
          });

          try {
            const compressed = await compressImage(file);
            const { getSupabase } = await import('/src/services/SupabaseService.js');
            const supabase = getSupabase();
            if (!supabase) throw new Error('Supabase no inicializado');

            const path = 'pins/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.png';
            const { error } = await supabase.storage
              .from('place-photos')
              .upload(path, compressed, { contentType: 'image/png', upsert: false });
            if (error) throw error;

            const { data: urlData } = supabase.storage.from('place-photos').getPublicUrl(path);
            s.imageUrl = urlData.publicUrl;
            s.emoji = ''; // subir imagen descarta el emoji (mismo criterio que el sticker del pin individual)
            renderPreview();
            renderSelProps();
          } catch (err) {
            alert('Error al subir el sticker: ' + err.message);
            label.style.opacity = '';
            label.innerHTML = origHtml;
          } finally {
            e.target.value = '';
          }
        });

      } else if (sel.kind === 'badge') {
        selTitle.textContent = '🔢 Badge';
        const BADGE_PRESET = ['#111827', '#1a5cf5', '#f97316', '#ef4444', '#10b981', '#8b5cf6'];
        selFields.innerHTML = `
          <div style="grid-column:1 / -1;"><div style="font-size:9px;color:#6b7280;margin-bottom:3px;">Texto (vacío = automático: "+N", o nada si es un solo lugar)</div>
          <input id="scf-badge-text" type="text" maxlength="12" value="${badge.label || ''}" placeholder="+N" style="width:100%;padding:6px;text-align:center;border-radius:6px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#e5e7eb;font-size:12px;box-sizing:border-box;"></div>
          <div style="grid-column:1 / -1;"><div style="font-size:9px;color:#6b7280;margin-bottom:4px;">Color</div>
          <div id="scf-badge-colors" style="display:flex;gap:6px;"></div></div>
          <div><div style="font-size:9px;color:#6b7280;">Tamaño (preciso)</div><input id="scf-bscale" type="range" min="0.5" max="2" step="0.02" value="${badge.scale ?? 1}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Giro (preciso)</div><input id="scf-brot" type="range" min="-180" max="180" step="1" value="${badge.rotation || 0}" style="width:100%;accent-color:#1a5cf5;"></div>`;
        modal.querySelector('#scf-badge-text').addEventListener('input', (e) => { badge.label = e.target.value; renderPreview(); });
        const row = modal.querySelector('#scf-badge-colors');
        BADGE_PRESET.forEach(c => {
          const b = document.createElement('button');
          b.type = 'button';
          b.style.cssText = `width:24px;height:24px;border-radius:50%;background:${c};border:2px solid ${c === badge.color ? '#67e8f9' : 'rgba(255,255,255,0.25)'};cursor:pointer;`;
          b.addEventListener('click', () => { badge.color = c; renderPreview(); renderSelProps(); });
          row.appendChild(b);
        });
        modal.querySelector('#scf-bscale').addEventListener('input', (e) => { badge.scale = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-brot').addEventListener('input', (e) => { badge.rotation = parseFloat(e.target.value); renderPreview(); });

      } else if (sel.kind === 'label') {
        selTitle.textContent = '🏷️ Etiqueta';
        const LABEL_PRESET = ['#1a1a2e', '#ffffff', '#1a5cf5', '#f97316', '#ef4444', '#10b981'];
        selFields.innerHTML = `
          <div style="grid-column:1 / -1;"><div style="font-size:9px;color:#6b7280;margin-bottom:3px;">Texto</div>
          <input id="scf-label-text" type="text" maxlength="40" value="${label.text || ''}" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#e5e7eb;font-size:12px;box-sizing:border-box;"></div>
          <div style="grid-column:1 / -1;"><div style="font-size:9px;color:#6b7280;margin-bottom:4px;">Color de texto</div>
          <div id="scf-label-colors" style="display:flex;gap:6px;"></div></div>
          <div><div style="font-size:9px;color:#6b7280;">Fondo</div><input id="scf-label-bg" type="color" value="${(() => { const m = (label.bg||'').match(/#[0-9a-fA-F]{6}/); return m ? m[0] : '#ffffff'; })()}" style="width:100%;height:28px;padding:0;border-radius:6px;border:1px solid rgba(255,255,255,0.14);background:none;cursor:pointer;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Tamaño (preciso)</div><input id="scf-lscale" type="range" min="0.5" max="2" step="0.02" value="${label.scale ?? 1}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div><div style="font-size:9px;color:#6b7280;">Giro (preciso)</div><input id="scf-lrot" type="range" min="-180" max="180" step="1" value="${label.rotation || 0}" style="width:100%;accent-color:#1a5cf5;"></div>
          <div style="grid-column:1 / -1;"><button type="button" id="scf-label-remove" style="width:100%;padding:6px;border-radius:6px;border:none;background:rgba(239,68,68,0.15);color:#f87171;font-size:10px;cursor:pointer;">🗑️ Quitar etiqueta</button></div>`;
        modal.querySelector('#scf-label-text').addEventListener('input', (e) => { label.text = e.target.value; renderPreview(); });
        modal.querySelector('#scf-label-bg').addEventListener('input', (e) => { label.bg = e.target.value; renderPreview(); });
        const lrow = modal.querySelector('#scf-label-colors');
        LABEL_PRESET.forEach(c => {
          const b = document.createElement('button');
          b.type = 'button';
          b.style.cssText = `width:24px;height:24px;border-radius:50%;background:${c};border:2px solid ${c === label.color ? '#67e8f9' : 'rgba(255,255,255,0.25)'};cursor:pointer;`;
          b.addEventListener('click', () => { label.color = c; renderPreview(); renderSelProps(); });
          lrow.appendChild(b);
        });
        modal.querySelector('#scf-lscale').addEventListener('input', (e) => { label.scale = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-lrot').addEventListener('input', (e) => { label.rotation = parseFloat(e.target.value); renderPreview(); });
        modal.querySelector('#scf-label-remove').addEventListener('click', () => { label.text = ''; sel = null; renderPreview(); renderSelProps(); });
      }
    }

    // ── Chips (atajo para seleccionar sin buscar en el preview) ──
    const cardChipsEl = modal.querySelector('#su-cluster-cards-chips');
    function renderCardChips() {
      cardChipsEl.innerHTML = '';
      shownPlaces.forEach((place, i) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        const active = sel?.kind === 'card' && sel.idx === i;
        chip.style.cssText = `padding:6px 10px;border-radius:999px;border:1px solid ${active ? 'rgba(0,188,212,0.5)' : 'rgba(255,255,255,0.12)'};background:${active ? 'rgba(0,188,212,0.18)' : 'transparent'};color:${active ? '#67e8f9' : '#9ca3af'};font-size:10.5px;cursor:pointer;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
        chip.textContent = `📸 ${place.name || i + 1}`;
        chip.addEventListener('click', () => { select('card', i); renderPreview(); });
        cardChipsEl.appendChild(chip);
      });
    }
    const stickerChipsEl = modal.querySelector('#su-cluster-stickers-chips');
    function renderStickerChips() {
      stickerChipsEl.innerHTML = '';
      stickers.forEach((s, i) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        const active = sel?.kind === 'sticker' && sel.idx === i;
        chip.style.cssText = `padding:6px 10px;border-radius:999px;border:1px solid ${active ? 'rgba(0,188,212,0.5)' : 'rgba(255,255,255,0.12)'};background:${active ? 'rgba(0,188,212,0.18)' : 'transparent'};color:${active ? '#67e8f9' : '#9ca3af'};font-size:12px;cursor:pointer;`;
        chip.textContent = s.emoji || '✨';
        chip.addEventListener('click', () => { select('sticker', i); renderPreview(); });
        stickerChipsEl.appendChild(chip);
      });
    }
    modal.querySelector('#su-cluster-add-sticker').addEventListener('click', () => {
      stickers.push({ emoji: '✨', dx: 0, dy: 0, size: 26, rotation: 0, strokeColor: '#ffffff', strokeWidth: 2, z: 20 + stickers.length });
      select('sticker', stickers.length - 1);
      renderPreview();
      renderStickerChips();
    });
    modal.querySelector('#su-cluster-badge-chip').addEventListener('click', () => { select('badge', 0); renderPreview(); });
    modal.querySelector('#su-cluster-label-chip').addEventListener('click', () => {
      if (!label.text) label.text = groupPlaces[0]?.name || 'Etiqueta'; // placeholder editable — si no, no hay nada que seleccionar/ver
      select('label', 0);
      renderPreview();
      renderSelProps();
    });

    // ── Lugares incluidos ────────────────────────────────────────
    const placesListEl = modal.querySelector('#su-cluster-places-list');
    function renderPlacesList() {
      placesListEl.innerHTML = '';
      groupPlaces.forEach((p, i) => {
        const pid = placeIdOf(p);
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:#d1d5db;cursor:pointer;';
        row.innerHTML = `<input type="checkbox" ${included.has(pid) ? 'checked' : ''} style="accent-color:#1a5cf5;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name || pid}</span>`;
        row.querySelector('input').addEventListener('change', (e) => {
          if (e.target.checked) included.add(pid); else included.delete(pid);
        });
        placesListEl.appendChild(row);
      });
    }
    renderPlacesList();

    // ── Agregar más lugares al cluster (no solo los que ya venían
    // agrupados por cercanía) — busca en TODOS los lugares cargados de
    // la categoría actual y los suma al grupo en vivo. ──
    const addSearchEl = modal.querySelector('#su-cluster-add-place-search');
    const addResultsEl = modal.querySelector('#su-cluster-add-place-results');
    function addPlaceToCluster(place) {
      const pid = placeIdOf(place);
      if (included.has(pid)) return;
      group.push({ el: { _place: place }, ll: { lat: place.lat ?? place.location?.lat ?? 0, lng: place.lng ?? place.location?.lng ?? 0 } });
      included.add(pid);
      groupPlaces = group.map(({ el }) => el._place);
      shownPlaces = groupPlaces.slice(0, CLUSTER_MAX_CARDS);
      renderPlacesList();
      renderCardChips();
      renderPreview();
      const countEl = modal.querySelector('#su-cluster-places-count');
      if (countEl) countEl.textContent = `Lugares incluidos (${groupPlaces.length})`;
      const cardsCountEl = modal.querySelector('#su-cluster-cards-count');
      if (cardsCountEl) cardsCountEl.textContent = `Tarjetas (${shownPlaces.length} de ${groupPlaces.length} lugares)`;
      addSearchEl.value = '';
      addResultsEl.innerHTML = '';
    }
    if (addSearchEl) {
      addSearchEl.addEventListener('input', () => {
        const q = addSearchEl.value.trim().toLowerCase();
        addResultsEl.innerHTML = '';
        if (!q) return;
        const already = new Set(groupPlaces.map(p => placeIdOf(p)));
        const matches = (this.mapView.allPlaces || [])
          .filter(p => p.name && p.name.toLowerCase().includes(q) && !already.has(placeIdOf(p)))
          .slice(0, 8);
        matches.forEach(p => {
          const row = document.createElement('button');
          row.type = 'button';
          row.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 8px;border-radius:6px;border:none;background:rgba(255,255,255,0.06);color:#d1d5db;font-size:11.5px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          row.textContent = p.name;
          row.addEventListener('click', () => addPlaceToCluster(p));
          addResultsEl.appendChild(row);
        });
        if (!matches.length) {
          addResultsEl.innerHTML = '<div style="font-size:11px;color:#6b7280;padding:4px;">Sin resultados</div>';
        }
      });
    }

    // Cierre centralizado — resetea this.mapView._clusterModalOpen con un
    // pequeño margen (400ms) después de remover el modal, para absorber
    // cualquier evento de puntero residual (el dedo que seguía "apoyado"
    // justo cuando se cerró) antes de volver a habilitar el long-press.
    const closeModal = () => {
      modal.remove();
      setTimeout(() => { this.mapView._clusterModalOpen = false; }, 400);
    };

    modal.querySelector('#su-cluster-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.querySelector('#su-cluster-save').addEventListener('click', async () => {
      const place_ids = Array.from(included);
      if (place_ids.length < 1) { alert('Tildá al menos un lugar'); return; }
      const btn = modal.querySelector('#su-cluster-save');
      btn.disabled = true; btn.textContent = 'Guardando...';
      const payload = { id: existingCluster?.id, place_ids, cards, stickers, badge, label };
      try {
        const res = await fetch('/api/supabase-clusters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        closeModal();
        // Si es de UN solo lugar, además de guardar el diseño hay que
        // marcar ese lugar con pin_style='cluster' para que el mapa lo
        // dibuje con este estilo (ver la rama 'cluster' de _buildPinHtml).
        if (place_ids.length === 1) {
          try {
            await fetch('/api/supabase-place-update', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ place_id: place_ids[0], pin_style: 'cluster' }),
            });
          } catch (e) { console.error('[CLUSTER] no se pudo fijar pin_style:', e); }
        }
        await this.mapView.reloadPinClusters();
      } catch (err) {
        console.error('[CLUSTER] Error guardando:', err);
        alert('Error guardando el cluster: ' + err.message);
        btn.disabled = false; btn.textContent = 'Guardar';
      }
    });

    if (isEdit) {
      modal.querySelector('#su-cluster-delete').addEventListener('click', async () => {
        if (!confirm('¿Quitar la personalización de este cluster? Los lugares vuelven al agrupamiento automático.')) return;
        try {
          await fetch('/api/supabase-clusters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: existingCluster.id }),
          });
          closeModal();
          await this.mapView.reloadPinClusters();
        } catch (err) {
          alert('Error quitando el cluster: ' + err.message);
        }
      });
    }

    renderCardChips();
    renderStickerChips();
    renderPreview();
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
              this.callbacks.onCategoriesUpdated?.();
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
              this.callbacks.onCategoriesUpdated?.();
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
      opening_hours:     place.openingHoursText || null,
      featured:          place.featured || null,
      pin_style:         place.pinStyle || 'photo',
      pin_emoji:         place.pinEmoji || '',
      pin_icon_url:      place.pinIconUrl || '',
      pin_size:          place.pinSize || 'normal',
      pin_stroke_color:  place.pinStrokeColor || '',
      pin_stroke_width:  place.pinStrokeWidth ?? '',
      pin_badge_color:   place.pinBadgeColor || '',
      pin_event_mode:    place.pinEventMode || false,
      pin_event_label:   place.pinEventLabel || '',
      pin_badge_style:   place.pinBadgeStyle || 'icon',
      pin_show_stacked_photos: !!place.pinShowStackedPhotos,
      pin_photo_stack_style: place.pinPhotoStackStyle || 'fan',
      pin_photo_stack_shape: place.pinPhotoStackShape || 'portrait',
      pin_badge_shape:   place.pinBadgeShape || 'circle',
      pin_photo_stack_size: place.pinPhotoStackSize || 'med',
      pin_label_position: place.pinLabelPosition || 'below',
      pin_show_meta_text: place.pinShowMetaText !== false,
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

    // Escapa valores antes de meterlos en atributos HTML (value="...", etc).
    // Sin esto, un nombre con comillas (" o ') rompe el atributo a la mitad
    // y el input queda con el value vacío/corrupto — eso era el bug del
    // título que se "borraba" al reabrir un lugar guardado con comillas.
    const _esc = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

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

    // Renderizar galería de fotos — arrastrables para reordenar
    const renderGalleryItems = (photos) =>
      photos.map((url, i) =>
        '<div class="su-gal-item" data-idx="' + i + '" style="position:relative;width:80px;height:80px;flex-shrink:0;touch-action:none;">' +
          '<img src="' + url + '" draggable="false" style="width:80px;height:80px;border-radius:10px;object-fit:cover;border:' + (i === 0 ? '2px solid #00bcd4' : '1.5px solid rgba(255,255,255,0.1)') + ';pointer-events:none;">' +
          (i === 0 ? '<div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;color:#fff;background:rgba(0,188,212,0.8);border-radius:0 0 8px 8px;padding:1px 0;pointer-events:none;">PRINCIPAL</div>' : '') +
          '<button class="su-gal-del" data-idx="' + i + '" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#ef4444;border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700;line-height:1;z-index:2;">✕</button>' +
          // Handle de drag — todo el thumbnail es arrastrable, esto es solo
          // la pista visual de que se puede mover
          '<div class="su-gal-handle" style="position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:#1a1a2e;border:1px solid rgba(255,255,255,0.25);color:#9ca3af;display:flex;align-items:center;justify-content:center;pointer-events:none;">' +
            '<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.8"/><circle cx="16" cy="6" r="1.8"/><circle cx="8" cy="12" r="1.8"/><circle cx="16" cy="12" r="1.8"/><circle cx="8" cy="18" r="1.8"/><circle cx="16" cy="18" r="1.8"/></svg>' +
          '</div>' +
        '</div>'
      ).join('');

    modal.innerHTML =
      '<div id="su-pf-inner" style="width:100%;max-width:480px;background:#1a1a2e;border-radius:20px 20px 0 0;padding:20px;max-height:92dvh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
          '<span style="font-size:15px;font-weight:700;color:#fff;">' + (editingPlaceId ? '✏️ Editar lugar' : '🏪 Nuevo lugar') + '</span>' +
          '<button id="su-pf-close" style="background:none;border:none;color:#9ca3af;font-size:20px;cursor:pointer;">✕</button>' +
        '</div>' +

        '<input id="su-pf-name"    class="su-input" placeholder="Nombre del lugar *" value="' + _esc(prefill?.name) + '">' +
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

        '<input id="su-pf-address" class="su-input" placeholder="Dirección" value="' + _esc(prefill?.formatted_address) + '">' +
        '<input id="su-pf-phone"   class="su-input" placeholder="Teléfono" value="' + _esc(prefill?.phone) + '">' +
        '<input id="su-pf-website" class="su-input" placeholder="Website" value="' + _esc(prefill?.website) + '">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<input id="su-pf-rating" class="su-input" placeholder="Rating (ej: 4.5)" type="number" step="0.1" min="0" max="5" value="' + _esc(prefill?.rating) + '">' +
          '<input id="su-pf-reviews-count" class="su-input" placeholder="Nº reseñas" type="number" min="0" value="' + (prefill?.user_ratings_total || '') + '">' +
        '</div>' +

        // ── Descripción del lugar ──────────────────────────────
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Descripción <span style="font-weight:400;text-transform:none;font-size:10px;">(se auto-rellena desde Google)</span></div>' +
          '<textarea id="su-pf-description" class="su-input" rows="3" placeholder="Breve descripción del lugar..." style="resize:vertical;min-height:64px;font-size:13px;">' + _esc(prefill?.description) + '</textarea>' +
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

        // ── PIN EN EL MAPA — foto (default) o emoji/sticker con 3 tamaños ──
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Pin en el mapa</div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button type="button" id="su-pin-mode-photo" style="flex:1;padding:9px;border-radius:8px;border:1.5px solid rgba(0,188,212,0.5);background:rgba(0,188,212,0.18);color:#67e8f9;font-size:12px;font-weight:700;cursor:pointer;">🖼️ Foto</button>' +
            '<button type="button" id="su-pin-mode-sticker" style="flex:1;padding:9px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:12px;font-weight:700;cursor:pointer;">😀 Sticker</button>' +
            '<button type="button" id="su-pin-mode-bubble" style="flex:1;padding:9px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:12px;font-weight:700;cursor:pointer;">💬 Globo</button>' +
            '<button type="button" id="su-pin-mode-social" style="flex:1;padding:9px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:12px;font-weight:700;cursor:pointer;">🎨 Social</button>' +
            '<button type="button" id="su-pin-mode-cluster" style="flex:1;padding:9px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:12px;font-weight:700;cursor:pointer;">🖼️ Cluster</button>' +
          '</div>' +
          '<input id="su-pin-style-hidden" type="hidden" value="' + (prefill?.pin_style || 'photo') + '">' +

          '<div id="su-pin-sticker-panel" style="display:none;flex-direction:column;gap:8px;background:rgba(255,255,255,0.04);border-radius:12px;padding:10px;">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
              '<div id="su-pin-preview-bg" style="flex-shrink:0;width:64px;height:64px;border-radius:12px;background:linear-gradient(135deg,#374151,#1f2937);display:flex;align-items:center;justify-content:center;">' +
                '<div id="su-pin-preview" style="display:flex;align-items:center;justify-content:center;"></div>' +
              '</div>' +
              '<div style="flex:1;display:flex;flex-direction:column;gap:4px;">' +
                '<div style="font-size:10px;color:#6b7280;">Vista previa del pin</div>' +
                '<div id="su-pin-size-row" style="display:flex;gap:4px;">' +
                  '<button type="button" class="su-pin-size-btn" data-size="mini" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">Mini</button>' +
                  '<button type="button" class="su-pin-size-btn" data-size="normal" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">Normal</button>' +
                  '<button type="button" class="su-pin-size-btn" data-size="grande" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">Grande</button>' +
                '</div>' +
                '<div id="su-pin-bubble-hint" style="display:none;font-size:10px;color:#6b7280;">El globo muestra el ícono + el nombre del lugar, tamaño fijo.</div>' +
              '</div>' +
            '</div>' +
            '<input id="su-pin-size-hidden" type="hidden" value="' + (prefill?.pin_size || 'normal') + '">' +

            '<div id="su-pin-stroke-row" style="display:flex;gap:8px;align-items:flex-end;">' +
              '<div style="flex:1;display:flex;flex-direction:column;gap:4px;">' +
                '<div style="font-size:10px;color:#6b7280;">Color del contorno</div>' +
                '<input id="su-pin-stroke-color" type="color" value="' + (prefill?.pin_stroke_color || '#ffffff') + '" style="width:100%;height:32px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;cursor:pointer;padding:2px;">' +
              '</div>' +
              '<div style="flex:1;display:flex;flex-direction:column;gap:4px;">' +
                '<div style="font-size:10px;color:#6b7280;">Grosor del contorno (px)</div>' +
                '<input id="su-pin-stroke-width" type="number" min="0" max="8" step="0.5" value="' + (prefill?.pin_stroke_width ?? '2') + '" class="su-input" style="height:32px;padding:0 8px;">' +
              '</div>' +
            '</div>' +

            '<div style="display:flex;flex-wrap:wrap;gap:5px;">' +
              ['🌮','🍔','🍕','🌭','🍺','☕','🍦','🎉','🛍️','💇','🦷','🌳','⚽','🎬','🏨','💊','🐾','🎨'].map(em =>
                '<button type="button" class="su-pin-emoji-quick" data-emoji="' + em + '" style="width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' + em + '</button>'
              ).join('') +
            '</div>' +

            '<div id="su-pin-social-row" style="display:none;flex-direction:column;gap:8px;">' +
              '<div style="height:1px;background:rgba(255,255,255,0.08);margin:2px 0;"></div>' +
              '<div style="font-size:10px;color:#6b7280;">Color del badge (hasta 6 por categoría — elegí el que le corresponda a esta subcategoría)</div>' +
              '<div id="su-pin-badge-color-row" style="display:flex;gap:6px;">' +
                ['#f97316','#8b5cf6','#ec4899','#10b981','#3b82f6','#eab308'].map(c =>
                  '<button type="button" class="su-pin-badge-color-btn" data-color="' + c + '" style="width:30px;height:30px;border-radius:50%;background:' + c + ';border:2px solid transparent;cursor:pointer;padding:0;"></button>'
                ).join('') +
              '</div>' +
              '<input id="su-pin-badge-color-hidden" type="hidden" value="' + (prefill?.pin_badge_color || '#f97316') + '">' +
              '<div style="font-size:10px;color:#6b7280;">Forma del pin</div>' +
              '<div id="su-pin-badge-shape-row" style="display:flex;gap:6px;">' +
                '<button type="button" class="su-pin-badge-shape-btn" data-val="circle" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">⚪ Círculo</button>' +
                '<button type="button" class="su-pin-badge-shape-btn" data-val="square" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">◻️ Cuadrado</button>' +
              '</div>' +
              '<input id="su-pin-badge-shape-hidden" type="hidden" value="' + (prefill?.pin_badge_shape === 'square' ? 'square' : 'circle') + '">' +
              '<div style="font-size:10px;color:#6b7280;">Estilo del pin</div>' +
              '<div id="su-pin-badge-style-row" style="display:flex;gap:6px;">' +
                '<button type="button" class="su-pin-badge-style-btn" data-val="icon" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">🔶 Ícono</button>' +
                '<button type="button" class="su-pin-badge-style-btn" data-val="dot" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">⚪ Solo punto</button>' +
              '</div>' +
              '<input id="su-pin-badge-style-hidden" type="hidden" value="' + (prefill?.pin_badge_style === 'dot' ? 'dot' : 'icon') + '">' +

              '<div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<label class="su-toggle-wrap">' +
                  '<input type="checkbox" id="su-pin-show-photos"' + (prefill?.pin_show_stacked_photos ? ' checked' : '') + '>' +
                  '<span class="su-toggle-slider"></span>' +
                '</label>' +
                '<span class="su-label" style="margin:0;">Mostrar fotos apiladas (independiente del pin y del evento)</span>' +
              '</div>' +
              '<div id="su-pin-photos-config-row" style="display:' + (prefill?.pin_show_stacked_photos ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">' +
                '<div style="font-size:10px;color:#6b7280;">Diseño del stack</div>' +
                '<div style="display:flex;gap:6px;">' +
                  '<button type="button" class="su-pin-photo-style-btn" data-val="fan" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">🎴 Abanico</button>' +
                  '<button type="button" class="su-pin-photo-style-btn" data-val="fan-center" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">🦚 Centrado</button>' +
                  '<button type="button" class="su-pin-photo-style-btn" data-val="fan-drift" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">🃏 Cascada</button>' +
                '</div>' +
                '<div style="font-size:10px;color:#6b7280;">Forma de las fotos apiladas</div>' +
                '<div style="display:flex;gap:6px;">' +
                  '<button type="button" class="su-pin-photo-shape-btn" data-val="portrait" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">▯ Portrait</button>' +
                  '<button type="button" class="su-pin-photo-shape-btn" data-val="square" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">▢ Square</button>' +
                '</div>' +
                '<div style="font-size:10px;color:#6b7280;">Tamaño de las fotos apiladas (independiente del tamaño del pin)</div>' +
                '<div style="display:flex;gap:6px;">' +
                  '<button type="button" class="su-pin-photo-size-btn" data-val="chico" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">Chico</button>' +
                  '<button type="button" class="su-pin-photo-size-btn" data-val="med" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">Mediano</button>' +
                  '<button type="button" class="su-pin-photo-size-btn" data-val="grande" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">Grande</button>' +
                '</div>' +
              '</div>' +
              '<input id="su-pin-photo-style-hidden" type="hidden" value="' + (['fan-center','fan-drift'].includes(prefill?.pin_photo_stack_style) ? prefill.pin_photo_stack_style : 'fan') + '">' +
              '<input id="su-pin-photo-shape-hidden" type="hidden" value="' + (prefill?.pin_photo_stack_shape === 'square' ? 'square' : 'portrait') + '">' +
              '<input id="su-pin-photo-size-hidden" type="hidden" value="' + (prefill?.pin_photo_stack_size || 'med') + '">' +

              '<div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<label class="su-toggle-wrap">' +
                  '<input type="checkbox" id="su-pin-event-mode"' + (prefill?.pin_event_mode ? ' checked' : '') + '>' +
                  '<span class="su-toggle-slider"></span>' +
                '</label>' +
                '<span class="su-label" style="margin:0;">Modo evento (solo agrega etiqueta de fecha/hora — no afecta las fotos)</span>' +
              '</div>' +
              '<input id="su-pin-event-label" class="su-input" placeholder="ej: NOW UNTIL 9:30 PM" style="display:' + (prefill?.pin_event_mode ? 'block' : 'none') + ';font-size:12px;" value="' + _esc(prefill?.pin_event_label) + '">' +

              '<div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>' +
              '<div style="font-size:10px;color:#6b7280;">Posición del texto (nombre + metadata) respecto al pin</div>' +
              '<div id="su-pin-label-pos-row" style="display:flex;gap:6px;">' +
                '<button type="button" class="su-pin-label-pos-btn" data-val="below" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">⬇️ Abajo</button>' +
                '<button type="button" class="su-pin-label-pos-btn" data-val="left" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">⬅️ Izquierda</button>' +
                '<button type="button" class="su-pin-label-pos-btn" data-val="right" style="flex:1;padding:7px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#9ca3af;font-size:10px;cursor:pointer;">➡️ Derecha</button>' +
              '</div>' +
              '<input id="su-pin-label-pos-hidden" type="hidden" value="' + (prefill?.pin_label_position || 'below') + '">' +
              '<div style="display:flex;align-items:center;gap:8px;margin-top:2px;">' +
                '<label class="su-toggle-wrap">' +
                  '<input type="checkbox" id="su-pin-show-meta"' + (prefill?.pin_show_meta_text !== false ? ' checked' : '') + '>' +
                  '<span class="su-toggle-slider"></span>' +
                '</label>' +
                '<span class="su-label" style="margin:0;">Mostrar texto debajo del nombre (rating/categoría/abierto o la fecha del evento)</span>' +
              '</div>' +
            '</div>' +
            '<input id="su-pin-emoji-input" class="su-input" placeholder="O escribí/pegá cualquier emoji" style="font-size:14px;" value="' + _esc(prefill?.pin_emoji) + '">' +

            '<div style="height:1px;background:rgba(255,255,255,0.08);margin:2px 0;"></div>' +
            '<label id="su-pin-sticker-file-label" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;background:rgba(255,255,255,0.05);border:1.5px dashed rgba(255,255,255,0.12);border-radius:8px;cursor:pointer;font-size:11px;color:#9ca3af;">' +
              '<span>🖼️ ' + (prefill?.pin_icon_url ? 'Cambiar sticker propio' : 'O subí tu propio sticker/imagen') + '</span>' +
              '<input id="su-pin-sticker-file" type="file" accept="image/*" style="display:none;">' +
            '</label>' +
            '<input id="su-pin-icon-url-hidden" type="hidden" value="' + _esc(prefill?.pin_icon_url) + '">' +
          '</div>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<input id="su-pf-lat" class="su-input" placeholder="Latitud *" type="number" step="any" value="' + _esc(prefill?.lat) + '">' +
          '<input id="su-pf-lng" class="su-input" placeholder="Longitud *" type="number" step="any" value="' + _esc(prefill?.lng) + '">' +
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
        '<button id="su-pf-save" class="su-btn su-btn-purple" style="padding:12px;font-size:14px;margin-top:4px;">' + (editingPlaceId ? '💾 Guardar cambios' : '💾 Guardar lugar') + '</button>' +
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

      // ── Drag para reordenar (mouse y touch, via pointer events) ──────
      // Se activa recién con long-press (450ms quieto). Todo el manejo
      // (scroll horizontal ANTES del long-press, drag DESPUÉS) es manual
      // acá mismo — cambiar touch-action a mitad de un gesto táctil no es
      // confiable entre navegadores, así que directamente no dependemos
      // de eso: touch-action:none siempre, y el scroll lo hacemos nosotros
      // moviendo galEl.scrollLeft a mano mientras se espera el long-press.
      const galEl = document.getElementById('su-pf-gallery');
      const items = Array.from(galEl.querySelectorAll('.su-gal-item'));
      if (!items.length) return;
      const STEP = items[0].offsetWidth + 8; // ancho del thumbnail + gap real (8px)
      const LONG_PRESS_MS = 450;
      const MOVE_CANCEL_PX = 8; // si se mueve más que esto antes del timer, es scroll, no drag
      let dragItem = null, dragOrigIdx = null, startX = 0, startY = 0, lastX = 0, order = null;
      let pressTimer = null, dragActive = false, scrolling = false;

      items.forEach(item => {
        item.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.su-gal-del')) return;
          dragItem = item;
          dragOrigIdx = parseInt(item.getAttribute('data-idx'));
          startX = e.clientX; startY = e.clientY; lastX = e.clientX;
          dragActive = false; scrolling = false;
          item.setPointerCapture(e.pointerId);
          clearTimeout(pressTimer);
          pressTimer = setTimeout(() => {
            if (scrolling) return; // ya se decidió que esto era scroll, no drag
            dragActive = true;
            order = items.map(it => parseInt(it.getAttribute('data-idx')));
            item.style.zIndex = '20';
            item.style.transition = 'none';
            item.style.boxShadow = '0 10px 24px rgba(0,0,0,0.45)';
            item.style.transform = 'scale(1.06)';
            if (navigator.vibrate) navigator.vibrate(12); // feedback hápticio si está disponible
          }, LONG_PRESS_MS);
        });

        item.addEventListener('pointermove', (e) => {
          if (dragItem !== item) return;

          if (!dragActive) {
            const moved = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
            if (moved > MOVE_CANCEL_PX) {
              // Se movió antes de completar el long-press → es scroll, no
              // drag. Cancelamos el timer y scrolleamos NOSOTROS a mano
              // (touch-action:none bloquea el scroll nativo del navegador)
              clearTimeout(pressTimer);
              scrolling = true;
            }
            if (scrolling) {
              e.preventDefault();
              galEl.scrollLeft -= (e.clientX - lastX);
              lastX = e.clientX;
            }
            return;
          }

          e.preventDefault();
          const dx = e.clientX - startX;
          item.style.transform = `translateX(${dx}px) scale(1.06)`;

          const fromPos = order.indexOf(dragOrigIdx);
          let toPos = Math.round(fromPos + dx / STEP);
          toPos = Math.max(0, Math.min(items.length - 1, toPos));
          if (toPos !== fromPos) {
            order.splice(fromPos, 1);
            order.splice(toPos, 0, dragOrigIdx);
          }
          // Correr a los demás thumbnails a su nueva posición visual
          items.forEach(it => {
            if (it === dragItem) return;
            const origIdx = parseInt(it.getAttribute('data-idx'));
            const pos = order.indexOf(origIdx);
            const offset = (pos - origIdx) * STEP;
            it.style.transition = 'transform 0.15s ease';
            it.style.transform = `translateX(${offset}px)`;
          });
        });

        const endDrag = () => {
          clearTimeout(pressTimer);
          if (dragItem !== item) return;
          if (dragActive) {
            item.style.zIndex = '';
            item.style.boxShadow = '';
            // "order" tiene los índices originales en el nuevo orden visual
            // — reconstruir el array real de fotos a partir de eso
            const newPhotos = order.map(origIdx => photos[origIdx]);
            photos.length = 0;
            photos.push(...newPhotos);
            _refreshGallery();
          }
          dragItem = null; dragOrigIdx = null; order = null;
          dragActive = false; scrolling = false;
        };
        item.addEventListener('pointerup', endDrag);
        item.addEventListener('pointercancel', endDrag);
      });
    }
    _bindGalleryEvents();

    // ── PIN EN EL MAPA — toggle foto/sticker, emoji, tamaño, preview ──
    const PIN_SIZE_MAP = { mini: 16, normal: 22, grande: 34 };

    const _updatePinPreview = () => {
      const size = document.getElementById('su-pin-size-hidden').value || 'normal';
      const emoji = document.getElementById('su-pin-emoji-input').value.trim();
      const iconUrl = document.getElementById('su-pin-icon-url-hidden').value;
      const strokeColor = document.getElementById('su-pin-stroke-color').value || '#ffffff';
      const outlineWRaw = parseFloat(document.getElementById('su-pin-stroke-width').value);
      const outlineW = isNaN(outlineWRaw) ? 2 : outlineWRaw;
      const noStroke = outlineW === 0;
      const diag = +(outlineW * 0.7071).toFixed(2);
      const px = PIN_SIZE_MAP[size] || 22;
      const preview = document.getElementById('su-pin-preview');

      if (iconUrl) {
        if (noStroke) {
          preview.innerHTML = '<img src="' + iconUrl + '" style="width:' + px + 'px;height:' + px + 'px;object-fit:contain;display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35));">';
        } else {
          preview.innerHTML = '<img src="' + iconUrl + '" style="width:' + px + 'px;height:' + px + 'px;object-fit:contain;display:block;filter:drop-shadow(' + outlineW + 'px 0 0 ' + strokeColor + ') drop-shadow(-' + outlineW + 'px 0 0 ' + strokeColor + ') drop-shadow(0 ' + outlineW + 'px 0 ' + strokeColor + ') drop-shadow(0 -' + outlineW + 'px 0 ' + strokeColor + ') drop-shadow(' + diag + 'px ' + diag + 'px 0 ' + strokeColor + ') drop-shadow(-' + diag + 'px ' + diag + 'px 0 ' + strokeColor + ') drop-shadow(' + diag + 'px -' + diag + 'px 0 ' + strokeColor + ') drop-shadow(-' + diag + 'px -' + diag + 'px 0 ' + strokeColor + ') drop-shadow(0 3px 6px rgba(0,0,0,0.3));">';
        }
      } else if (noStroke) {
        preview.innerHTML = '<div style="font-family:\'Apple Color Emoji\',\'Segoe UI Emoji\',\'Segoe UI Symbol\',\'Noto Color Emoji\',sans-serif;font-size:' + px + 'px;line-height:1;text-shadow:0 3px 5px rgba(0,0,0,0.35);">' + (emoji || '📍') + '</div>';
      } else {
        // Apilado de 12 puntos (cada 30°) — mismo criterio que MapView.js,
        // -webkit-text-stroke no se aplica a emoji a color en la mayoría
        // de navegadores, así que usamos el apilado que sí funciona
        const N = 12;
        const stack = Array.from({ length: N }, (_, i) => {
          const angle = (i / N) * 2 * Math.PI;
          const x = +(Math.cos(angle) * outlineW).toFixed(2);
          const y = +(Math.sin(angle) * outlineW).toFixed(2);
          return x + 'px ' + y + 'px 0 ' + strokeColor;
        }).join(',');
        preview.innerHTML = '<div style="font-family:\'Apple Color Emoji\',\'Segoe UI Emoji\',\'Segoe UI Symbol\',\'Noto Color Emoji\',sans-serif;font-size:' + px + 'px;line-height:1;text-shadow:' + stack + ',0 3px 5px rgba(0,0,0,0.25);">' + (emoji || '📍') + '</div>';
      }
    };

    document.getElementById('su-pin-stroke-color').addEventListener('input', _updatePinPreview);

    // Color del badge (modo Social) — 6 presets
    const badgeColorBtns = document.querySelectorAll('.su-pin-badge-color-btn');
    const badgeColorHidden = document.getElementById('su-pin-badge-color-hidden');
    const _paintBadgeColorBtns = () => {
      badgeColorBtns.forEach(b => {
        b.style.border = b.dataset.color === badgeColorHidden.value ? '2px solid #fff' : '2px solid transparent';
        b.style.boxShadow = b.dataset.color === badgeColorHidden.value ? '0 0 0 2px ' + b.dataset.color : 'none';
      });
    };
    badgeColorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        badgeColorHidden.value = btn.dataset.color;
        _paintBadgeColorBtns();
      });
    });
    _paintBadgeColorBtns();

    // Modo evento (Social) — SOLO muestra/oculta el input de etiqueta de
    // fecha/hora. Ya no toca nada relacionado a fotos ni al pin.
    const eventModeCheckbox = document.getElementById('su-pin-event-mode');
    const eventLabelInput = document.getElementById('su-pin-event-label');
    eventModeCheckbox.addEventListener('change', () => {
      eventLabelInput.style.display = eventModeCheckbox.checked ? 'block' : 'none';
    });

    // Mostrar/ocultar el texto de metadata debajo del nombre — no necesita
    // wiring extra más allá de leer el checkbox al guardar

    // Posición del label: abajo / izquierda / derecha
    const labelPosBtns = document.querySelectorAll('.su-pin-label-pos-btn');
    const labelPosHidden = document.getElementById('su-pin-label-pos-hidden');
    const _paintLabelPosBtns = () => {
      labelPosBtns.forEach(b => {
        const active = b.dataset.val === labelPosHidden.value;
        b.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
        b.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
        b.style.color       = active ? '#67e8f9'              : '#9ca3af';
      });
    };
    labelPosBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        labelPosHidden.value = btn.dataset.val;
        _paintLabelPosBtns();
      });
    });
    _paintLabelPosBtns();

    // Estilo del pin (ícono o solo punto) — independiente del evento y de
    // las fotos, siempre visible
    const badgeStyleBtns = document.querySelectorAll('.su-pin-badge-style-btn');
    const badgeStyleHidden = document.getElementById('su-pin-badge-style-hidden');
    const _paintBadgeStyleBtns = () => {
      badgeStyleBtns.forEach(b => {
        const active = b.dataset.val === badgeStyleHidden.value;
        b.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
        b.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
        b.style.color       = active ? '#67e8f9'              : '#9ca3af';
      });
    };
    badgeStyleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        badgeStyleHidden.value = btn.dataset.val;
        _paintBadgeStyleBtns();
      });
    });
    _paintBadgeStyleBtns();

    // Mostrar fotos apiladas — checkbox independiente, no depende del
    // modo evento ni del estilo del pin
    const showPhotosCheckbox = document.getElementById('su-pin-show-photos');
    const photosConfigRow = document.getElementById('su-pin-photos-config-row');
    showPhotosCheckbox.addEventListener('change', () => {
      photosConfigRow.style.display = showPhotosCheckbox.checked ? 'flex' : 'none';
    });

    // Diseño del stack de fotos: abanico (fan) | cascada | cluster
    const photoStyleBtns = document.querySelectorAll('.su-pin-photo-style-btn');
    const photoStyleHidden = document.getElementById('su-pin-photo-style-hidden');
    const _paintPhotoStyleBtns = () => {
      photoStyleBtns.forEach(b => {
        const active = b.dataset.val === photoStyleHidden.value;
        b.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
        b.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
        b.style.color       = active ? '#67e8f9'              : '#9ca3af';
      });
    };
    photoStyleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        photoStyleHidden.value = btn.dataset.val;
        _paintPhotoStyleBtns();
      });
    });
    _paintPhotoStyleBtns();

    // Forma de las fotos apiladas: portrait o square
    const photoShapeBtns = document.querySelectorAll('.su-pin-photo-shape-btn');
    const photoShapeHidden = document.getElementById('su-pin-photo-shape-hidden');
    const _paintPhotoShapeBtns = () => {
      photoShapeBtns.forEach(b => {
        const active = b.dataset.val === photoShapeHidden.value;
        b.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
        b.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
        b.style.color       = active ? '#67e8f9'              : '#9ca3af';
      });
    };
    photoShapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        photoShapeHidden.value = btn.dataset.val;
        _paintPhotoShapeBtns();
      });
    });
    _paintPhotoShapeBtns();

    // Tamaño de las fotos apiladas — chico/med/grande, independiente del
    // tamaño del pin (que usa su-pin-size-hidden)
    const photoSizeBtns = document.querySelectorAll('.su-pin-photo-size-btn');
    const photoSizeHidden = document.getElementById('su-pin-photo-size-hidden');
    const _paintPhotoSizeBtns = () => {
      photoSizeBtns.forEach(b => {
        const active = b.dataset.val === photoSizeHidden.value;
        b.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
        b.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
        b.style.color       = active ? '#67e8f9'              : '#9ca3af';
      });
    };
    photoSizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        photoSizeHidden.value = btn.dataset.val;
        _paintPhotoSizeBtns();
      });
    });
    _paintPhotoSizeBtns();

    // Forma del pin — círculo o cuadrado, aplica con o sin evento
    const badgeShapeBtns = document.querySelectorAll('.su-pin-badge-shape-btn');
    const badgeShapeHidden = document.getElementById('su-pin-badge-shape-hidden');
    const _paintBadgeShapeBtns = () => {
      badgeShapeBtns.forEach(b => {
        const active = b.dataset.val === badgeShapeHidden.value;
        b.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
        b.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
        b.style.color       = active ? '#67e8f9'              : '#9ca3af';
      });
    };
    badgeShapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        badgeShapeHidden.value = btn.dataset.val;
        _paintBadgeShapeBtns();
      });
    });
    _paintBadgeShapeBtns();

    document.getElementById('su-pin-stroke-width').addEventListener('input', _updatePinPreview);

    // Toggle modo Foto / Sticker / Globo / Social
    const pinModePhotoBtn   = document.getElementById('su-pin-mode-photo');
    const pinModeStickerBtn = document.getElementById('su-pin-mode-sticker');
    const pinModeBubbleBtn  = document.getElementById('su-pin-mode-bubble');
    const pinModeSocialBtn  = document.getElementById('su-pin-mode-social');
    const pinModeClusterBtn = document.getElementById('su-pin-mode-cluster');
    const pinStickerPanel   = document.getElementById('su-pin-sticker-panel');
    const pinSizeRow        = document.getElementById('su-pin-size-row');
    const pinStrokeRow      = document.getElementById('su-pin-stroke-row');
    const pinBubbleHint     = document.getElementById('su-pin-bubble-hint');
    const pinSocialRow      = document.getElementById('su-pin-social-row');

    const _paintPinModeBtn = (btn, active) => {
      btn.style.background  = active ? 'rgba(0,188,212,0.18)' : 'transparent';
      btn.style.borderColor = active ? 'rgba(0,188,212,0.5)'  : 'rgba(255,255,255,0.12)';
      btn.style.color       = active ? '#67e8f9'              : '#9ca3af';
    };
    const _setPinMode = (mode) => {
      document.getElementById('su-pin-style-hidden').value = mode;
      const showPanel = mode === 'sticker' || mode === 'bubble' || mode === 'social';
      // 'cluster' no usa ninguno de los controles de abajo (tamaño,
      // contorno, emoji): su diseño se arma con long-press en el mapa.
      pinStickerPanel.style.display = showPanel ? 'flex' : 'none';
      _paintPinModeBtn(pinModePhotoBtn,   mode === 'photo');
      _paintPinModeBtn(pinModeStickerBtn, mode === 'sticker');
      _paintPinModeBtn(pinModeBubbleBtn,  mode === 'bubble');
      _paintPinModeBtn(pinModeSocialBtn,  mode === 'social');
      _paintPinModeBtn(pinModeClusterBtn, mode === 'cluster');
      // El globo tiene tamaño fijo (icono + nombre) y no usa contorno de
      // color — oculta esos controles, solo quedan visibles emoji/sticker.
      // Social tampoco usa tamaño/contorno — usa su propio color de badge.
      pinSizeRow.style.display   = mode === 'bubble' ? 'none' : 'flex';
      pinStrokeRow.style.display = (mode === 'bubble' || mode === 'social') ? 'none' : 'flex';
      pinBubbleHint.style.display = mode === 'bubble' ? 'block' : 'none';
      pinSocialRow.style.display = mode === 'social' ? 'flex' : 'none';
      if (showPanel) _updatePinPreview();
    };
    pinModePhotoBtn.addEventListener('click', () => _setPinMode('photo'));
    pinModeStickerBtn.addEventListener('click', () => _setPinMode('sticker'));
    pinModeBubbleBtn.addEventListener('click', () => _setPinMode('bubble'));
    pinModeSocialBtn.addEventListener('click', () => _setPinMode('social'));
    // El diseño del pin tipo cluster (tarjetas/stickers/badge/etiqueta) NO
    // se edita en este formulario: se edita con long-press sobre el pin en
    // el mapa, con el mismo editor que los clusters. Acá solo se elige el
    // estilo; el diseño arranca vacío y se compone después.
    pinModeClusterBtn.addEventListener('click', () => _setPinMode('cluster'));
    _setPinMode(document.getElementById('su-pin-style-hidden').value || 'photo');

    // Tamaño mini/normal/grande
    const pinSizeBtns = document.querySelectorAll('.su-pin-size-btn');
    const _setPinSize = (size) => {
      document.getElementById('su-pin-size-hidden').value = size;
      pinSizeBtns.forEach(b => {
        const active = b.getAttribute('data-size') === size;
        b.style.background = active ? 'rgba(0,188,212,0.25)' : 'transparent';
        b.style.color       = active ? '#67e8f9' : '#9ca3af';
        b.style.borderColor = active ? 'rgba(0,188,212,0.5)' : 'rgba(255,255,255,0.12)';
      });
      _updatePinPreview();
    };
    pinSizeBtns.forEach(btn => btn.addEventListener('click', () => _setPinSize(btn.getAttribute('data-size'))));
    _setPinSize(document.getElementById('su-pin-size-hidden').value || 'normal');

    // Emoji rápido (grid) y emoji manual (input)
    document.querySelectorAll('.su-pin-emoji-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('su-pin-emoji-input').value = btn.getAttribute('data-emoji');
        document.getElementById('su-pin-icon-url-hidden').value = ''; // elegir emoji descarta el sticker custom
        _updatePinPreview();
      });
    });
    document.getElementById('su-pin-emoji-input').addEventListener('input', () => {
      document.getElementById('su-pin-icon-url-hidden').value = ''; // escribir emoji descarta el sticker custom
      _updatePinPreview();
    });

    // Subir sticker/imagen propia — mismo mecanismo (comprimir + Supabase Storage)
    document.getElementById('su-pin-sticker-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Solo imágenes.'); return; }
      if (file.size > 10 * 1024 * 1024) { alert('Imagen demasiado grande (máx 10 MB).'); return; }

      const label = document.getElementById('su-pin-sticker-file-label');
      const origHtml = label.innerHTML;
      label.style.opacity = '0.5';
      label.querySelector('span').textContent = '⏳ Subiendo...';

      const compressImage = (f) => new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(f);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const MAX = 300; // los stickers son chicos, no hace falta más resolución
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else       { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(resolve, 'image/png', 0.9); // png para conservar transparencia si la tiene
        };
        img.src = url;
      });

      try {
        const compressed = await compressImage(file);
        const { getSupabase } = await import('/src/services/SupabaseService.js');
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase no inicializado');

        const path = 'pins/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.png';
        const { error } = await supabase.storage
          .from('place-photos')
          .upload(path, compressed, { contentType: 'image/png', upsert: false });
        if (error) throw error;

        const { data: urlData } = supabase.storage.from('place-photos').getPublicUrl(path);
        document.getElementById('su-pin-icon-url-hidden').value = urlData.publicUrl;
        document.getElementById('su-pin-emoji-input').value = ''; // subir sticker descarta el emoji
        _updatePinPreview();
      } catch (err) {
        alert('Error al subir el sticker: ' + err.message);
      } finally {
        label.style.opacity = '';
        label.innerHTML = origHtml;
        e.target.value = '';
      }
    });

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
      if (file.size > 25 * 1024 * 1024) { alert('Imagen demasiado grande (máx 25 MB).'); return; }
      if (photos.length >= 5) { alert('Máximo 5 fotos.'); return; }

      const label = document.getElementById('su-gal-file-label');
      label.style.opacity = '0.5';
      const origText = label.childNodes[0]?.textContent || '';
      label.childNodes[0].textContent = '⏳ Comprimiendo...';

      // ── Comprimir antes de subir ──
      const compressImage = (f) => new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(f);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const MAX = 1280; // máx 1280px en el lado más largo
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else       { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(resolve, 'image/jpeg', 0.82);
        };
        img.src = url;
      });

      try {
        const compressed = await compressImage(file);
        label.childNodes[0].textContent = '⏳ Subiendo...';
        const { getSupabase } = await import('/src/services/SupabaseService.js');
        const supabase = getSupabase();
        if (!supabase) throw new Error('Supabase no inicializado');

        const path = 'places/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.jpg';

        const { error } = await supabase.storage
          .from('place-photos')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
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
        pin_style:          document.getElementById('su-pin-style-hidden').value || 'photo',
        pin_emoji:          document.getElementById('su-pin-emoji-input').value.trim() || '',
        pin_icon_url:       document.getElementById('su-pin-icon-url-hidden').value || '',
        pin_size:           document.getElementById('su-pin-size-hidden').value || 'normal',
        pin_stroke_color:   document.getElementById('su-pin-stroke-color').value || '',
        pin_stroke_width:   document.getElementById('su-pin-stroke-width').value || '',
        pin_badge_color:    document.getElementById('su-pin-badge-color-hidden')?.value || '',
        pin_event_mode:     document.getElementById('su-pin-event-mode')?.checked || false,
        pin_event_label:    document.getElementById('su-pin-event-label')?.value || '',
        pin_badge_style:    document.getElementById('su-pin-badge-style-hidden')?.value || 'icon',
        pin_show_stacked_photos: document.getElementById('su-pin-show-photos')?.checked || false,
        pin_photo_stack_style: document.getElementById('su-pin-photo-style-hidden')?.value || 'fan',
        pin_photo_stack_shape: document.getElementById('su-pin-photo-shape-hidden')?.value || 'portrait',
        pin_badge_shape:    document.getElementById('su-pin-badge-shape-hidden')?.value || 'circle',
        pin_photo_stack_size: document.getElementById('su-pin-photo-size-hidden')?.value || 'med',
        pin_label_position: document.getElementById('su-pin-label-pos-hidden')?.value || 'below',
        pin_show_meta_text: document.getElementById('su-pin-show-meta')?.checked ?? true,
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
          pin_style:          document.getElementById('su-pin-style-hidden').value || 'photo',
          pin_emoji:          document.getElementById('su-pin-emoji-input').value.trim() || null,
          pin_icon_url:       document.getElementById('su-pin-icon-url-hidden').value || null,
          pin_size:           document.getElementById('su-pin-size-hidden').value || 'normal',
          pin_stroke_color:   document.getElementById('su-pin-stroke-color').value || null,
          pin_stroke_width:   document.getElementById('su-pin-stroke-width').value || null,
          pin_badge_color:    document.getElementById('su-pin-badge-color-hidden')?.value || null,
          pin_event_mode:     document.getElementById('su-pin-event-mode')?.checked || false,
          pin_event_label:    document.getElementById('su-pin-event-label')?.value || null,
          pin_badge_style:    document.getElementById('su-pin-badge-style-hidden')?.value || 'icon',
          pin_show_stacked_photos: document.getElementById('su-pin-show-photos')?.checked || false,
          pin_photo_stack_style: document.getElementById('su-pin-photo-style-hidden')?.value || 'fan',
          pin_photo_stack_shape: document.getElementById('su-pin-photo-shape-hidden')?.value || 'portrait',
          pin_badge_shape:    document.getElementById('su-pin-badge-shape-hidden')?.value || 'circle',
          pin_photo_stack_size: document.getElementById('su-pin-photo-size-hidden')?.value || 'med',
          pin_label_position: document.getElementById('su-pin-label-pos-hidden')?.value || 'below',
          pin_show_meta_text: document.getElementById('su-pin-show-meta')?.checked ?? true,
          ...(isEdit
            ? { place_id: editingPlaceId }
            : { place_id: prefill?.place_id || null }),
        };
        console.log('📤 Payload enviado:', JSON.stringify(payload).slice(0, 500));
        const res = await fetch(isEdit ? '/api/supabase-place-update' : '/api/supabase-place-save', {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log('📥 Respuesta:', JSON.stringify(data).slice(0, 300));
        if (!data.success) throw new Error(data.message || JSON.stringify(data));
        modal.remove();

        // Limpiar caché y recargar inmediatamente
        const mapView = window.wpApp?.mapView;
        if (mapView && mapView.currentCatId) {
          const cat = mapView.currentCatId;
          await fetch('/api/supabase-places?category=' + cat + '&_clear_cache=1');
          await mapView.loadCategory(cat);
        }

        if (isEdit) {
          this._showToast('✅ Cambios guardados');
          setTimeout(() => this._openPlaces(), 1200);
        } else {
          this._showToast('✅ Lugar guardado — aparece en el mapa');
        }
      } catch(e) {
        errEl.textContent = 'Error: ' + e.message;
        errEl.style.display = 'block';
        saveBtn.textContent = '💾 Guardar lugar';
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

      /* ── Modal genérico (usado por el panel de clusters) ── */
      .su-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 99998;
        display: flex; align-items: center; justify-content: center; padding: 20px;
      }
      .su-modal-box {
        width: 100%; max-height: 90vh; overflow-y: auto;
        background: #14141c; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px; padding: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        font-family: 'Uni Sans Bold Regular', sans-serif;
        box-sizing: border-box;
      }
    `;
    document.head.appendChild(style);
  }
}