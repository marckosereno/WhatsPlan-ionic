// ====================================================================
// PLAN MODAL - Whatsplan
// Crear planes desde plantillas o desde cero, agregar pasos, compartir
// ====================================================================

import { PlanService } from '/src/services/PlanService.js';

const R3D = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';

// Catálogo de tipos de paso — mismo que ACTIVITY_TYPES en ActivityModal
const STEP_TYPES = [
  { key:'tacos',       emoji:'🌮', icon3d:R3D+'Taco/3D/taco_3d.png',                                    label:'Unos tacos',        cat:'RESTAURANTS' },
  { key:'mariscos',    emoji:'🦐', icon3d:R3D+'Shrimp/3D/shrimp_3d.png',                                label:'Mariscos',          cat:'RESTAURANTS' },
  { key:'hamburguer',  emoji:'🍔', icon3d:R3D+'Hamburger/3D/hamburger_3d.png',                           label:'Hamburguesas',      cat:'RESTAURANTS' },
  { key:'coffee',      emoji:'☕', icon3d:R3D+'Hot+Beverage/3D/hot_beverage_3d.png',                     label:'Un café',           cat:'RESTAURANTS' },
  { key:'antojitos',   emoji:'🫔', icon3d:R3D+'Burrito/3D/burrito_3d.png',                              label:'Antojitos',         cat:'RESTAURANTS' },
  { key:'brunch',      emoji:'🥞', icon3d:R3D+'Pancakes/3D/pancakes_3d.png',                            label:'Brunch',            cat:'RESTAURANTS' },
  { key:'drinks',      emoji:'🍻', icon3d:R3D+'Clinking+Beer+Mugs/3D/clinking_beer_mugs_3d.png',        label:'Unas chelas',       cat:'ENTERTAINMENT' },
  { key:'shots',       emoji:'🥃', icon3d:R3D+'Tumbler+Glass/3D/tumbler_glass_3d.png',                  label:'Shots y cocteles',  cat:'ENTERTAINMENT' },
  { key:'musica',      emoji:'🎵', icon3d:R3D+'Musical+Note/3D/musical_note_3d.png',                    label:'Bailar / Música',   cat:'ENTERTAINMENT' },
  { key:'karaoke',     emoji:'🎤', icon3d:R3D+'Microphone/3D/microphone_3d.png',                        label:'Karaoke',           cat:'ENTERTAINMENT' },
  { key:'chill',       emoji:'🎮', icon3d:R3D+'Video+Game/3D/video_game_3d.png',                        label:'Chill y juegos',    cat:'ENTERTAINMENT' },
  { key:'ropa',        emoji:'👗', icon3d:R3D+'Dress/3D/dress_3d.png',                                  label:'Ir de shopping',    cat:'SHOPPING' },
  { key:'artesanias',  emoji:'🎨', icon3d:R3D+'Artist+Palette/3D/artist_palette_3d.png',                label:'Artesanías',        cat:'SHOPPING' },
  { key:'mercado',     emoji:'🛒', icon3d:R3D+'Shopping+Cart/3D/shopping_cart_3d.png',                  label:'El mercado',        cat:'SHOPPING' },
  { key:'dentist',     emoji:'🦷', icon3d:R3D+'Tooth/3D/tooth_3d.png',                                  label:'Ir al dentista',    cat:'HEALTH' },
  { key:'dental_tour', emoji:'😁', icon3d:R3D+'Beaming+Face+with+Smiling+Eyes/3D/beaming_face_with_smiling_eyes_3d.png', label:'Tour dental', cat:'HEALTH' },
  { key:'spa',         emoji:'💆', icon3d:R3D+'Person+Getting+Massage/3D/person_getting_massage_3d.png', label:'Spa / Masaje',     cat:'HEALTH' },
  { key:'farmacia',    emoji:'💊', icon3d:R3D+'Pill/3D/pill_3d.png',                                    label:'Farmacia',          cat:'HEALTH' },
  { key:'paseo',       emoji:'🌳', icon3d:R3D+'Deciduous+Tree/3D/deciduous_tree_3d.png',                label:'Un paseo',          cat:'PARKS' },
  { key:'foto',        emoji:'📸', icon3d:R3D+'Camera+with+Flash/3D/camera_with_flash_3d.png',          label:'Sesión de fotos',   cat:'PARKS' },
  { key:'deporte',     emoji:'⚽', icon3d:R3D+'Soccer+Ball/3D/soccer_ball_3d.png',                      label:'Deporte',           cat:'PARKS' },
];

const TEMPLATE_STEPS = {
  dental:    ['dentist','dental_tour','tacos','farmacia'],
  nightlife: ['drinks','shots','musica','karaoke','tacos'],
  family:    ['tacos','mercado','artesanias','paseo'],
  shopping:  ['farmacia','ropa','artesanias','mercado'],
};

export class PlanModal {
  constructor({ currentUser, onPlanCreated } = {}) {
    this.currentUser = currentUser;
    this.onPlanCreated = onPlanCreated;
    this.currentPlan = null;   // plan activo siendo editado
    this.currentStep = 1;      // 1=plantillas, 2=detalle+pasos, 3=compartir
    this._rendered = false;
    this._render();
  }

  setUser(user) { this.currentUser = user; }

  preloadActivity(activity) {
    if (!this.currentPlan) return;
    if (!this.currentPlan.pendingActivities) this.currentPlan.pendingActivities = [];
    if (!this.currentPlan.pendingActivities.find(a => a.id === activity.id)) {
      this.currentPlan.pendingActivities.push(activity);
    }
  }

  // Guardar actividad para inyectar en cuanto el usuario elija plantilla o "desde cero"
  setPendingActivity(activity) {
    this._pendingActivity = activity || null;
  }

  // Inyectar _pendingActivity en currentPlan recién creado
  _injectPendingActivity() {
    if (!this._pendingActivity || !this.currentPlan) return;
    if (!this.currentPlan.pendingActivities) this.currentPlan.pendingActivities = [];
    const already = this.currentPlan.pendingActivities.find(a => a.id === this._pendingActivity.id);
    if (!already) {
      this.currentPlan.pendingActivities.push(this._pendingActivity);
    }
    this._pendingActivity = null; // consumir — solo se inyecta una vez
  }

  // ── Mostrar modal ────────────────────────────────────────────────
  show() {
    this.currentPlan = null;
    this.currentStep = 1;
    // _pendingActivity se puede setear antes de show() via setPendingActivity()
    this._goToStep(1);
    document.getElementById('plan-modal-overlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  hide() {
    document.getElementById('plan-modal-overlay').style.display = 'none';
    document.body.style.overflow = '';
  }

  // Abrir directo en Step 2 con un plan existente ya cargado y actividad pre-inyectada
  showAtStep2WithPlan(plan, activity) {
    this.currentPlan = {
      id:          plan.id,
      title:       plan.title       || '',
      emoji:       plan.emoji       || '✨',
      description: plan.description || '',
      steps:       (plan.plan_activities || []).map(pa => pa.activity || pa),
      from_template_id: plan.from_template_id || null,
      pendingActivities: []
    };
    // Inyectar la actividad directamente
    if (activity) {
      const already = this.currentPlan.pendingActivities.find(a => a.id === activity.id);
      if (!already) this.currentPlan.pendingActivities.push(activity);
    }
    this.currentStep = 2;
    this._goToStep(2);
    document.getElementById('plan-modal-overlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // ── Render base ──────────────────────────────────────────────────
  _render() {
    if (this._rendered) return;
    this._rendered = true;

    const existing = document.getElementById('plan-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'plan-modal-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:999998;background:white;flex-direction:column;';

    overlay.innerHTML = `
      <!-- Progress bar -->
      <div style="height:3px;background:#f0f0f0;flex-shrink:0;">
        <div id="pm-progress" style="height:100%;background:#111;transition:width 0.3s ease;width:33%;"></div>
      </div>

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;flex-shrink:0;">
        <button id="pm-back" style="width:32px;height:32px;border-radius:50%;background:#f0f0f0;border:none;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#666;opacity:0;pointer-events:none;">←</button>
        <div style="text-align:center;">
          <div id="pm-step-label" style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Paso 1 de 3</div>
        </div>
        <button id="pm-close" style="width:32px;height:32px;border-radius:50%;background:#f0f0f0;border:none;font-size:16px;cursor:pointer;color:#666;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <!-- Contenido dinámico -->
      <div id="pm-content" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;"></div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('pm-close').addEventListener('click', () => this.hide());
    document.getElementById('pm-back').addEventListener('click', () => {
      if (this.currentStep > 1) this._goToStep(this.currentStep - 1);
    });
  }

  // ── Navegación entre pasos ───────────────────────────────────────
  _goToStep(step) {
    this.currentStep = step;
    const progress = { 1: '33%', 2: '66%', 3: '100%' };
    const labels   = { 1: 'Paso 1 de 3', 2: 'Paso 2 de 3', 3: 'Paso 3 de 3' };

    document.getElementById('pm-progress').style.width = progress[step];
    document.getElementById('pm-step-label').textContent = labels[step];

    const back = document.getElementById('pm-back');
    if (step > 1) { back.style.opacity = '1'; back.style.pointerEvents = 'auto'; }
    else          { back.style.opacity = '0'; back.style.pointerEvents = 'none'; }

    const content = document.getElementById('pm-content');
    content.innerHTML = '';

    if (step === 1) this._renderStep1(content);
    if (step === 2) this._renderStep2(content);
    if (step === 3) this._renderStep3(content);
  }

  // ── guardar estado del paso 2 antes de salir ──────────────────────
  _saveStep2State() {
    const title = document.getElementById('pm-plan-title');
    const desc  = document.getElementById('pm-plan-desc');
    const date  = document.getElementById('pm-plan-date');
    const max   = document.querySelector('.pm-max-btn.selected');
    if (title) this.currentPlan.title       = title.value;
    if (desc)  this.currentPlan.description = desc.value;
    if (date)  this.currentPlan.scheduled_date = date.value || null;
    if (max)   this.currentPlan.max_participants = parseInt(max.dataset.max) || 4;
  }

  // ── STEP 1: Elegir plantilla o crear desde cero ──────────────────
  async _renderStep1(container) {
    container.innerHTML = `
      <div style="padding:4px 20px 16px;flex-shrink:0;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">👆</div>
        <h2 style="font-size:20px;font-weight:800;color:#111;margin:0 0 4px;">What's the plan?</h2>
        <p style="font-size:13px;color:#9ca3af;margin:0;">Elige una plantilla o crea el tuyo</p>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 20px 20px;">

        <!-- Desde cero -->
        <button id="pm-from-scratch" style="width:100%;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;border:2px dashed #e5e7eb;background:white;cursor:pointer;margin-bottom:16px;-webkit-tap-highlight-color:transparent;">
          <div style="width:44px;height:44px;border-radius:12px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">✨</div>
          <div style="text-align:left;">
            <div style="font-size:14px;font-weight:700;color:#111;">Crear desde cero</div>
            <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Arma tu propio itinerario</div>
          </div>
          <span style="margin-left:auto;color:#9ca3af;font-size:18px;">›</span>
        </button>

        <!-- Plantillas -->
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">✦ Plantillas</div>
        <div id="pm-templates-list">
          <div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">Cargando...</div>
        </div>
      </div>
    `;

    document.getElementById('pm-from-scratch').addEventListener('click', () => {
      this.currentPlan = { title: '', emoji: '✨', steps: [], from_template_id: null };
      this._injectPendingActivity();
      this._goToStep(2);
    });

    // Cargar plantillas
    try {
      const templates = await PlanService.getTemplates();
      const list = document.getElementById('pm-templates-list');
      if (!list) return;

      if (!templates.length) {
        list.innerHTML = '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:16px;">Sin plantillas disponibles</p>';
        return;
      }

      list.innerHTML = templates.map(t => {
        const steps = (t.plan_activities || []).slice(0, 3)
          .map(s => STEP_TYPES.find(st => st.key === s.type)?.emoji || '📍').join(' ');
        return `
          <button class="pm-template-btn" data-id="${t.id}" data-title="${t.title}" data-emoji="${t.emoji}" data-desc="${t.description || ''}"
            style="width:100%;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;border:1.5px solid #e5e7eb;background:white;cursor:pointer;margin-bottom:10px;-webkit-tap-highlight-color:transparent;">
            <div style="width:44px;height:44px;border-radius:12px;background:#f9fafb;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${t.emoji}</div>
            <div style="text-align:left;flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:700;color:#111;">${t.title}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${steps || ''} ${t.description ? '· ' + t.description.substring(0, 35) + '...' : ''}</div>
            </div>
            <span style="color:#9ca3af;font-size:18px;flex-shrink:0;">›</span>
          </button>`;
      }).join('');

      list.querySelectorAll('.pm-template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tmpl = templates.find(t => t.id === btn.dataset.id);
          if (!tmpl) return;
          // Pre-cargar pasos de la plantilla
          const steps = (tmpl.plan_activities || []).map(s => {
            const type = STEP_TYPES.find(st => st.key === s.type) || STEP_TYPES[0];
            return { ...s, emoji: type.emoji, icon3d: type.icon3d, label: s.label || type.label };
          });
          this.currentPlan = {
            title: tmpl.title,
            emoji: tmpl.emoji,
            description: tmpl.description || '',
            steps,
            from_template_id: tmpl.id
          };
          this._injectPendingActivity();
          this._goToStep(2);
        });
      });
    } catch (e) {
      const list = document.getElementById('pm-templates-list');
      if (list) list.innerHTML = '<p style="text-align:center;color:#ef4444;font-size:13px;padding:16px;">Error cargando plantillas</p>';
    }
  }

  // ── STEP 2: Nombre + actividades + detalles ─────────────────────
  _renderStep2(container) {
    const plan     = this.currentPlan;
    const maxOpts  = [2, 3, 4, 5, 6, 8, 10];
    const savedMax = plan.max_participants || 4;
    const isPublic = plan.is_public !== false;

    // Calcular fecha auto desde actividades con fecha
    const acts = plan.pendingActivities || [];
    const actsWithDate = acts.filter(a => a.scheduled_at);
    const _autoDate = actsWithDate.length
      ? actsWithDate.reduce((min, a) => a.scheduled_at < min ? a.scheduled_at : min, actsWithDate[0].scheduled_at)
      : null;
    // Si hay fecha auto, usarla; si no, usar la guardada manualmente
    if (_autoDate && !plan._dateSetManually) {
      plan.scheduled_date = _autoDate;
    }
    const savedDate = plan.scheduled_date || '';
    const _hasAutoDate = !!(_autoDate && !plan._dateSetManually);

    container.innerHTML = `
      <!-- Nombre y emoji -->
      <div style="padding:4px 20px 12px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <button id="pm-emoji-btn" style="width:52px;height:52px;border-radius:14px;border:1.5px solid #e5e7eb;background:#f9fafb;font-size:26px;cursor:pointer;flex-shrink:0;">${plan.emoji}</button>
          <input id="pm-plan-title" type="text" placeholder="Nombre del plan..." maxlength="50" value="${plan.title}"
            style="flex:1;border:1.5px solid #e5e7eb;border-radius:12px;padding:12px 14px;font-size:15px;font-weight:600;outline:none;font-family:inherit;">
        </div>
        <input id="pm-plan-desc" type="text" placeholder="Descripción breve (opcional)..." maxlength="100" value="${plan.description || ''}"
          style="width:100%;border:1.5px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;">
      </div>

      <div style="flex:1;overflow-y:auto;padding:0 20px;">

        <!-- Actividades del plan -->
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Actividades</div>
        <div id="pm-activities-list"></div>

        <!-- Botones de acción -->
        <div style="display:flex;gap:8px;margin-bottom:20px;">
          <button id="pm-add-existing" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-radius:14px;border:1.5px solid #e5e7eb;background:white;cursor:pointer;color:#374151;font-size:12px;font-weight:700;-webkit-tap-highlight-color:transparent;">
            🗺️ Del mapa
          </button>
          <button id="pm-add-new" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-radius:14px;border:1.5px solid #6366f1;background:#eef2ff;cursor:pointer;color:#6366f1;font-size:12px;font-weight:700;-webkit-tap-highlight-color:transparent;">
            + Nueva
          </button>
        </div>

        <!-- Cuándo — auto si hay actividades con fecha -->
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">¿Cuándo?</div>
        ${_hasAutoDate
          ? '<div id="pm-date-auto" style="width:100%;border:1.5px solid #e5e7eb;border-radius:12px;padding:11px 14px;font-size:13px;color:#6b7280;background:#f9fafb;box-sizing:border-box;margin-bottom:8px;display:flex;align-items:center;gap:8px;">' +
            '<span>📅</span><span>Tomada de tus actividades</span>' +
            '<button id="pm-date-override" style="margin-left:auto;font-size:11px;color:#6366f1;background:none;border:none;cursor:pointer;font-weight:700;">Cambiar</button>' +
            '</div>' +
            '<input id="pm-plan-date" type="datetime-local" value="' + savedDate + '" style="display:none;width:100%;border:1.5px solid #6366f1;border-radius:12px;padding:11px 14px;font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:20px;color:#111;">'
          : '<input id="pm-plan-date" type="datetime-local" value="${savedDate}" style="width:100%;border:1.5px solid #e5e7eb;border-radius:12px;padding:11px 14px;font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:20px;color:#111;">'}

        <!-- Máximo de personas -->
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Máximo de personas</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
          ${maxOpts.map(n => '<button class="pm-max-btn' + (n===savedMax?' selected':'') + '" data-max="' + n + '" style="padding:9px 14px;border-radius:10px;border:1.5px solid ' + (n===savedMax? '#1a5cf5' :'#e5e5e5') + ';background:' + (n===savedMax? '#1a5cf5' :'white') + ';color:' + (n===savedMax?'white':'#374151') + ';font-size:13px;font-weight:600;cursor:pointer;">' + (n===10?'10+':n) + '</button>').join('')}
        </div>

        <!-- Visibilidad -->
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Visibilidad</div>
        <div style="display:flex;gap:10px;margin-bottom:24px;">
          <button id="pm-vis-public" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid ${isPublic? '#1a5cf5' :'#e5e7eb'};background:${isPublic? '#1a5cf5' :'white'};color:${isPublic?'white':'#374151'};font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            🌍 Público
          </button>
          <button id="pm-vis-private" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid ${!isPublic? '#1a5cf5' :'#e5e7eb'};background:${!isPublic? '#1a5cf5' :'white'};color:${!isPublic?'white':'#374151'};font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            🔒 Solo amigos
          </button>
        </div>

      </div>

      <!-- Footer -->
      <div style="padding:12px 20px calc(12px + env(safe-area-inset-bottom));flex-shrink:0;border-top:1px solid #f0f0f0;background:white;">
        <button id="pm-next-2" style="width:100%;padding:14px;background:#111;color:white;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;">
          Confirmar plan →
        </button>
      </div>
    `;

    this._renderActivitiesList();

    document.getElementById('pm-emoji-btn').addEventListener('click', () => this._showEmojiPicker());
    document.getElementById('pm-next-2').addEventListener('click',   () => this._handleSavePlan());

    // Agregar actividad existente del mapa
    document.getElementById('pm-add-existing').addEventListener('click', () => this._showActivitiesSheet());

    // Crear nueva actividad — abre ActivityModal normal
    document.getElementById('pm-add-new').addEventListener('click', () => {
      document.getElementById('plan-modal-overlay').style.display = 'none';
      const am = window.wpApp?.activityModal;
      if (am) {
        am.setUser(this.currentUser);
        // Cuando se crea, la capturo y la agrego al plan
        const originalCreated = window.wpApp?.onActivityCreated;
        window.wpApp._pendingPlanCapture = (activity) => {
          if (!this.currentPlan.pendingActivities) this.currentPlan.pendingActivities = [];
          this.currentPlan.pendingActivities.push(activity);
          document.getElementById('plan-modal-overlay').style.display = 'flex';
          this._renderActivitiesList();
        };
        am.show();
      }
    });

    // Max personas
    container.querySelectorAll('.pm-max-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.pm-max-btn').forEach(b => {
          b.classList.remove('selected');
          b.style.background='white'; b.style.color='#374151'; b.style.borderColor='#e5e5e5';
        });
        btn.classList.add('selected');
        btn.style.background='#1a5cf5'; btn.style.color='white'; btn.style.borderColor='#1a5cf5';
        this.currentPlan.max_participants = parseInt(btn.dataset.max);
      });
    });

    // Visibilidad
    const pubBtn  = document.getElementById('pm-vis-public');
    const privBtn = document.getElementById('pm-vis-private');
    const _setVis = (pub) => {
      this.currentPlan.is_public = pub;
      pubBtn.style.background  = pub  ? '#1a5cf5' : 'white';
      pubBtn.style.color       = pub  ? 'white' : '#374151';
      pubBtn.style.borderColor = pub  ? '#1a5cf5' : '#e5e7eb';
      privBtn.style.background = !pub ? '#1a5cf5' : 'white';
      privBtn.style.color      = !pub ? 'white' : '#374151';
      privBtn.style.borderColor= !pub ? '#1a5cf5' : '#e5e7eb';
    };
    pubBtn.addEventListener('click',  () => _setVis(true));
    privBtn.addEventListener('click', () => _setVis(false));

    document.getElementById('pm-plan-title').addEventListener('input', e => { this.currentPlan.title = e.target.value; });
    document.getElementById('pm-plan-desc').addEventListener('input',  e => { this.currentPlan.description = e.target.value; });
    document.getElementById('pm-plan-date').addEventListener('change', e => {
      this.currentPlan.scheduled_date = e.target.value || null;
      if (e.target.value) this.currentPlan._dateSetManually = true;
    });
    // Botón "Cambiar" en modo auto-fecha
    document.getElementById('pm-date-override')?.addEventListener('click', () => {
      const autoLabel = document.getElementById('pm-date-auto');
      const dateInput = document.getElementById('pm-plan-date');
      if (autoLabel) autoLabel.style.display = 'none';
      if (dateInput) {
        dateInput.style.display = 'block';
        dateInput.style.marginBottom = '20px';
        dateInput.focus();
      }
      this.currentPlan._dateSetManually = true;
    });
  }

  // ── Lista de actividades del plan ────────────────────────────────
  _renderActivitiesList() {
    const list = document.getElementById('pm-activities-list');
    if (!list) return;
    const acts = this.currentPlan.pendingActivities || [];

    if (!acts.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:20px 16px;background:#f9fafb;border-radius:14px;margin-bottom:12px;">
          <div style="font-size:28px;margin-bottom:6px;">🗺️</div>
          <p style="font-size:13px;color:#9ca3af;margin:0;">Sin actividades aún.<br>Agrega una del mapa o crea una nueva.</p>
        </div>`;
      return;
    }

    list.innerHTML = acts.map((a, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f9fafb;border-radius:14px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:#111;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#111;">${a.title || a.type}</div>
          <div style="font-size:11px;color:#16a34a;">✓ ${a.place_name || 'Lugar en el mapa'}</div>
        </div>
        <button class="pm-remove-act" data-index="${i}"
          style="width:26px;height:26px;border-radius:50%;border:none;background:#fee2e2;color:#ef4444;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
      </div>`).join('');

    list.querySelectorAll('.pm-remove-act').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPlan.pendingActivities.splice(parseInt(btn.dataset.index), 1);
        this._renderActivitiesList();
      });
    });
  }

  // ── Sheet: elegir activity existente del mapa ─────────────────────
  async _showActivitiesSheet() {
    document.getElementById('pm-act-sheet')?.remove();
    const sheet = document.createElement('div');
    sheet.id = 'pm-act-sheet';
    sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999999;background:white;border-radius:24px 24px 0 0;max-height:75vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.25s ease;';
    sheet.innerHTML = `
      <div style="width:36px;height:4px;background:#e5e7eb;border-radius:4px;margin:12px auto 0;flex-shrink:0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;flex-shrink:0;">
        <div style="font-size:16px;font-weight:800;color:#111;">Actividades en el mapa</div>
        <button id="pm-act-sheet-close" style="width:30px;height:30px;border-radius:50%;border:none;background:#f3f4f6;font-size:16px;cursor:pointer;">✕</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 16px 24px;">
        <div id="pm-act-sheet-list">
          <div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">Cargando actividades...</div>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    document.getElementById('pm-act-sheet-close').addEventListener('click', () => sheet.remove());

    try {
      const acts = await PlanService.getActiveActivitiesForPlan();
      const already = (this.currentPlan.pendingActivities || []).map(a => a.id);
      const available = acts.filter(a => !already.includes(a.id));
      const listEl = document.getElementById('pm-act-sheet-list');
      if (!listEl) return;

      if (!available.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">No hay actividades activas en el mapa.<br>Crea una nueva con "+ Nueva".</div>';
        return;
      }

      listEl.innerHTML = available.map(a => {
        const parts = parseInt(a.participants ? a.participants.length : 0);
        const max   = a.max_participants || 4;
        const time  = a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }) : '';
        return `<div class="pm-act-opt" data-id="${a.id}"
          style="display:flex;align-items:center;gap:12px;padding:12px;background:white;border-radius:14px;border:1.5px solid #f0f0f0;cursor:pointer;margin-bottom:8px;-webkit-tap-highlight-color:transparent;">
          <div style="width:44px;height:44px;border-radius:12px;background:#f9fafb;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">
            ${a.icon_url ? '<img src="'+a.icon_url+'" style="width:32px;height:32px;object-fit:contain;">' : '📍'}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:#111;">${a.title || a.type}</div>
            <div style="font-size:11px;color:#9ca3af;">${a.place_name || ''}${time?' · '+time:''}</div>
            <div style="font-size:11px;color:#6366f1;margin-top:2px;">👥 ${parts}/${max} personas</div>
          </div>
          <div style="width:28px;height:28px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:16px;color:#9ca3af;">+</div>
        </div>`;
      }).join('');

      listEl.querySelectorAll('.pm-act-opt').forEach(el => {
        el.addEventListener('click', () => {
          const act = available.find(a => a.id === el.dataset.id);
          if (!act) return;

          const uid = this.currentUser?.id;
          const isOwner  = act.creator_id === uid;
          const isMember = (act.participants || []).includes(uid);

          const _doAdd = () => {
            if (!this.currentPlan.pendingActivities) this.currentPlan.pendingActivities = [];
            this.currentPlan.pendingActivities.push(act);
            sheet.remove();
            this._renderActivitiesList();
            window.wpApp?.showMapToast?.('Actividad agregada al plan ✓', '#10b981');
          };

          if (isOwner || isMember) {
            // Es dueño o ya es miembro → añadir directo
            _doAdd();
          } else {
            // Actividad ajena → pedir confirmación para unirse
            this._confirmJoinForPlan(act, sheet, _doAdd);
          }
        });
      });
    } catch(e) {
      const listEl = document.getElementById('pm-act-sheet-list');
      if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#ef4444;font-size:13px;">Error cargando actividades</div>';
    }
  }

  // ── Confirmar unirse antes de añadir al plan ────────────────────
  _confirmJoinForPlan(activity, sheet, onConfirmed) {
    document.getElementById('pm-join-confirm')?.remove();

    const popup = document.createElement('div');
    popup.id = 'pm-join-confirm';
    popup.style.cssText = 'position:fixed;inset:0;z-index:99999999;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;';

    const actTitle = activity.title || activity.type || 'Actividad';
    const actPlace = activity.place_name || '';

    popup.innerHTML =
      '<div style="background:white;border-radius:24px 24px 0 0;padding:24px 20px calc(24px + env(safe-area-inset-bottom));width:100%;max-width:480px;animation:slideUp 0.25s ease;">' +
        '<div style="text-align:center;margin-bottom:16px;">' +
          '<div style="font-size:36px;margin-bottom:8px;">👋</div>' +
          '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:4px;">¿Unirte a esta actividad?</div>' +
          '<div style="font-size:13px;color:#9ca3af;">' + actTitle + (actPlace ? ' · ' + actPlace : '') + '</div>' +
        '</div>' +
        '<p style="font-size:13px;color:#374151;text-align:center;margin:0 0 20px;line-height:1.5;">' +
          'Para añadirla a tu plan necesitas unirte primero.' +
        '</p>' +
        '<button id="pm-join-yes" style="width:100%;padding:14px;background:#111;color:white;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">' +
          'Unirme y añadir al plan' +
        '</button>' +
        '<button id="pm-join-no" style="width:100%;padding:14px;background:#f3f4f6;color:#374151;border:none;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer;">' +
          'Cancelar' +
        '</button>' +
      '</div>';

    document.body.appendChild(popup);

    document.getElementById('pm-join-no').addEventListener('click', () => popup.remove());
    popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });

    document.getElementById('pm-join-yes').addEventListener('click', async () => {
      const btn = document.getElementById('pm-join-yes');
      btn.disabled = true;
      btn.textContent = 'Uniéndote...';
      try {
        await window.wpApp?.handleJoinActivity?.(activity.id);
        popup.remove();
        onConfirmed();
      } catch(e) {
        btn.disabled = false;
        btn.textContent = 'Unirme y añadir al plan';
        window.wpApp?.showMapToast?.(e.message || 'Error al unirse', '#ef4444');
      }
    });
  }

  _renderStepsList() {
    const list = document.getElementById('pm-steps-list');
    if (!list) return;
    const steps = this.currentPlan.steps || [];

    if (!steps.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:24px 16px;background:#f9fafb;border-radius:14px;margin-bottom:12px;">
          <div style="font-size:32px;margin-bottom:8px;">🗺️</div>
          <p style="font-size:13px;color:#9ca3af;margin:0;">Sin pasos todavía.<br>Agrega actividades a tu plan.</p>
        </div>`;
      return;
    }

    list.innerHTML = steps.map((s, i) => {
      const hasPlace = !!s.place_name;
      return `
      <div class="pm-step-item" data-index="${i}"
        style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f9fafb;border-radius:14px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:#111;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
        <div style="font-size:22px;flex-shrink:0;">${s.emoji || '📍'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#111;">${s.label || s.type}</div>
          ${hasPlace
            ? `<div style="font-size:11px;color:#16a34a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">✓ ${s.place_name}</div>`
            : `<div class="pm-assign-place" data-index="${i}" style="font-size:11px;color:#6366f1;font-weight:600;cursor:pointer;">👆 Toca para elegir lugar</div>`
          }
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          ${hasPlace ? `<button class="pm-clear-place" data-index="${i}" style="width:26px;height:26px;border-radius:50%;border:none;background:#e0e7ff;color:#6366f1;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Cambiar lugar">↺</button>` : ''}
          <button class="pm-remove-step" data-index="${i}" style="width:26px;height:26px;border-radius:50%;border:none;background:#fee2e2;color:#ef4444;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
        </div>
      </div>`;
    }).join('');

    // Tap en "Toca para elegir lugar"
    list.querySelectorAll('.pm-assign-place').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        this._pickPlaceForStep(idx);
      });
    });

    // Tap en paso con lugar → cambiar lugar
    list.querySelectorAll('.pm-clear-place').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this._pickPlaceForStep(idx);
      });
    });

    // Quitar paso
    list.querySelectorAll('.pm-remove-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this.currentPlan.steps.splice(idx, 1);
        this._renderStepsList();
      });
    });
  }

  // ── Sheet de lugar para un paso (lista sugeridos + mapa) ──────────
  async _pickPlaceForStep(stepIndex) {
    const step = this.currentPlan.steps[stepIndex];
    if (!step) return;

    document.getElementById('pm-place-sheet')?.remove();

    const stepType = STEP_TYPES.find(t => t.key === step.type);
    const catKey   = stepType?.cat || 'RESTAURANTS';

    const sheet = document.createElement('div');
    sheet.id = 'pm-place-sheet';
    sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999999;background:white;border-radius:24px 24px 0 0;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.25s ease;';

    sheet.innerHTML = `
      <div style="width:36px;height:4px;background:#e5e7eb;border-radius:4px;margin:12px auto 0;flex-shrink:0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;flex-shrink:0;">
        <div>
          <div style="font-size:16px;font-weight:800;color:#111;">${step.emoji || ''} ${step.label || step.type}</div>
          <div style="font-size:12px;color:#9ca3af;">Elige un lugar</div>
        </div>
        <button id="pm-place-sheet-close" style="width:30px;height:30px;border-radius:50%;border:none;background:#f3f4f6;font-size:16px;cursor:pointer;">✕</button>
      </div>

      <!-- Chips de subcategoría -->
      <div id="pm-sc-chips" style="display:flex;gap:8px;overflow-x:auto;padding:0 16px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;flex-shrink:0;"></div>

      <!-- Lista scrollable -->
      <div style="flex:1;overflow-y:auto;padding:0 16px;">

        <!-- Botón seleccionar en mapa -->
        <div id="pm-pick-on-map" style="background:#fff8e1;border-radius:14px;padding:14px 16px;margin-bottom:12px;border:1.5px dashed #fcd34d;cursor:pointer;display:flex;align-items:center;gap:12px;">
          <span style="font-size:24px;flex-shrink:0;">🗺️</span>
          <div>
            <p style="margin:0;font-size:13px;font-weight:700;color:#d97706;">Seleccionar en el mapa</p>
            <p style="margin:2px 0 0;font-size:11px;color:#d97706;">Toca cualquier lugar del mapa</p>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="flex:1;height:1px;background:#f0f0f0;"></div>
          <span style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;">Sugeridos</span>
          <div style="flex:1;height:1px;background:#f0f0f0;"></div>
        </div>

        <div id="pm-suggested-places" style="display:flex;flex-direction:column;gap:8px;padding-bottom:24px;">
          <div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">Cargando...</div>
        </div>
      </div>
    `;

    document.body.appendChild(sheet);

    const _assignPlace = (place) => {
      this.currentPlan.steps[stepIndex].place_name = place.name || place.place_name || null;
      this.currentPlan.steps[stepIndex].place_id   = place.place_id || null;
      this.currentPlan.steps[stepIndex].lat        = place.lat || place.location?.lat || null;
      this.currentPlan.steps[stepIndex].lng        = place.lng || place.location?.lng || null;
      sheet.remove();
      this._renderStepsList();
      window.wpApp?.showMapToast?.('Lugar asignado ✓', '#10b981');
    };

    document.getElementById('pm-place-sheet-close').addEventListener('click', () => sheet.remove());

    // Botón seleccionar en mapa
    document.getElementById('pm-pick-on-map').addEventListener('click', () => {
      sheet.remove();
      const mapView = window.wpApp?.mapView;
      if (!mapView) return;

      document.getElementById('plan-modal-overlay').style.display = 'none';

      const hint = document.createElement('div');
      hint.style.cssText = 'position:fixed;top:12px;left:16px;right:68px;z-index:99999;animation:fadeIn 0.2s ease;';
      hint.innerHTML = '<div style="background:#111;color:white;padding:0 16px;height:44px;border-radius:50px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,0.3);overflow:hidden;white-space:nowrap;"><span style="font-size:18px;">👆</span><span>Elige dónde: ' + (step.label || step.type) + '</span></div>';
      const cancelBtn = document.createElement('button');
      cancelBtn.style.cssText = 'position:fixed;top:12px;right:12px;width:44px;height:44px;background:#111;color:white;border:none;border-radius:50%;cursor:pointer;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.3);z-index:99999;touch-action:manipulation;';
      cancelBtn.textContent = '✕';
      document.body.appendChild(hint);
      document.body.appendChild(cancelBtn);

      const _cleanup = () => {
        hint.remove(); cancelBtn.remove();
        mapView.disablePickMode?.();
        document.getElementById('plan-modal-overlay').style.display = 'flex';
      };
      cancelBtn.addEventListener('click', _cleanup);
      cancelBtn.addEventListener('touchend', e => { e.preventDefault(); _cleanup(); });

      const catData = (mapView.categories||[]).find(c => c.menuKey === catKey);
      const _doEnable = () => {
        if (mapView.pickModeActive) return;
        mapView.enablePickMode((place) => {
          hint.remove(); cancelBtn.remove();
          _assignPlace(place);
          document.getElementById('plan-modal-overlay').style.display = 'flex';
        });
      };
      if (catData) mapView.loadPlacesByCategory(catData).catch(()=>{}).finally(_doEnable);
      else _doEnable();
    });

    // Cargar chips y sugeridos
    await this._loadPlaceSheetData(catKey, stepType, _assignPlace);
  }

  async _loadPlaceSheetData(catKey, stepType, onSelect) {
    // Chips de subcategoría
    const chipsEl = document.getElementById('pm-sc-chips');
    if (chipsEl) {
      let allSubcats = [];
      try {
        const mod = await import('/src/services/CategoryService.js');
        allSubcats = await mod.getSubcategories(null, false, false);
      } catch(e) {}

      const typeSubs = (stepType?.subcats || [])
        .map(val => allSubcats.find(s => s.value === val))
        .filter(Boolean);

      const chips = [{ val: '', label: 'Todos' }, ...typeSubs.map(s => ({
        val: s.value,
        label: (s.emoji ? s.emoji + ' ' : '') + (s.label_es || s.value)
      }))];

      chipsEl.innerHTML = chips.map((s, i) =>
        '<button class="pm-sc-chip" data-val="' + s.val + '" style="padding:7px 14px;border-radius:50px;font-size:12px;font-weight:600;white-space:nowrap;border:1.5px solid ' + (i===0? '#1a5cf5' :'#e5e5e5') + ';background:' + (i===0? '#1a5cf5' :'white') + ';color:' + (i===0?'white':'#374151') + ';cursor:pointer;flex-shrink:0;">' + s.label + '</button>'
      ).join('');

      chipsEl.querySelectorAll('.pm-sc-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          chipsEl.querySelectorAll('.pm-sc-chip').forEach(b => {
            b.style.background='white'; b.style.color='#374151'; b.style.borderColor='#e5e5e5';
          });
          btn.style.background='#1a5cf5'; btn.style.color='white'; btn.style.borderColor='#1a5cf5';
          this._renderSuggestedPlaces(catKey, stepType, btn.dataset.val, onSelect);
        });
      });
    }

    await this._renderSuggestedPlaces(catKey, stepType, '', onSelect);
  }

  async _renderSuggestedPlaces(catKey, stepType, filterSubcat, onSelect) {
    const container = document.getElementById('pm-suggested-places');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">Cargando...</div>';

    const allPlaces = window.wpApp?.mapView?.allPlaces || window.wpApp?.mapView?.places || [];
    let places = allPlaces.filter(p => !p._hidden && (p.category||'') === catKey);

    if (places.length === 0) {
      try {
        const res = await fetch('/api/supabase-places?category=' + encodeURIComponent(catKey) + '&_t=' + Date.now());
        const data = await res.json();
        if (data.places?.length) places = data.places;
      } catch(e) {}
    }

    if (filterSubcat) {
      places = places.filter(p => (p.subcategoryTags||[]).includes(filterSubcat));
    } else if (stepType?.subcats?.length) {
      const typed = places.filter(p => stepType.subcats.some(s => (p.subcategoryTags||[]).includes(s)));
      if (typed.length > 0) places = typed;
    }

    // Featured primero, luego por rating
    places = places.sort((a, b) => {
      const fa = a.featured ? 1 : 0, fb = b.featured ? 1 : 0;
      if (fb !== fa) return fb - fa;
      return parseFloat(b.rating||0) - parseFloat(a.rating||0);
    }).slice(0, 12);

    if (!places.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">No hay lugares para esta actividad.<br>Selecciona en el mapa. 🗺️</div>';
      return;
    }

    container.innerHTML = places.map(p => {
      const photo  = p.photoUrl || (p.photosUrls&&p.photosUrls[0]) || '';
      const rating = p.rating ? '⭐ ' + parseFloat(p.rating).toFixed(1) : '';
      const addr   = (p.formattedAddress||p.formatted_address||'').substring(0,40);
      const featBadge = p.featured
        ? '<span style="font-size:9px;font-weight:700;background:' + (p.featured==='verified'?'#10b981':p.featured==='premium'?'#8b5cf6':'#f59e0b') + ';color:white;padding:1px 5px;border-radius:20px;white-space:nowrap;flex-shrink:0;">' + (p.featured==='verified'?'✓ Verified':p.featured==='premium'?'💎 Premium':'⭐ Featured') + '</span>'
        : '';
      return '<div class="pm-place-row" data-name="' + (p.name||'').replace(/"/g,'&quot;') +
        '" data-lat="' + (p.location?.lat||p.lat||'') +
        '" data-lng="' + (p.location?.lng||p.lng||'') +
        '" data-id="' + (p.place_id||p.placeId||'') +
        '" style="display:flex;align-items:center;gap:12px;padding:12px;background:white;border-radius:14px;border:1.5px solid #f0f0f0;cursor:pointer;-webkit-tap-highlight-color:transparent;">' +
        (photo
          ? '<img src="' + photo + '" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0;">'
          : '<div style="width:52px;height:52px;border-radius:10px;background:#f0f0f0;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;">📍</div>') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
            '<div style="font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (p.name||'') + '</div>' +
            featBadge +
          '</div>' +
          (rating ? '<div style="font-size:12px;color:#f59e0b;margin-top:2px;">' + rating + '</div>' : '') +
          (addr   ? '<div style="font-size:11px;color:#9ca3af;margin-top:2px;">' + addr + '</div>' : '') +
        '</div>' +
        '<div style="width:28px;height:28px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;color:#9ca3af;">›</div>' +
        '</div>';
    }).join('');

    container.querySelectorAll('.pm-place-row').forEach(row => {
      row.addEventListener('click', () => {
        onSelect({
          name:     row.dataset.name,
          place_id: row.dataset.id,
          lat:      parseFloat(row.dataset.lat),
          lng:      parseFloat(row.dataset.lng)
        });
      });
    });
  }

  // ── Sheet para agregar un paso ───────────────────────────────────
  _showAddStepSheet() {
    document.getElementById('pm-add-step-sheet')?.remove();

    const sheet = document.createElement('div');
    sheet.id = 'pm-add-step-sheet';
    sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999999;background:white;border-radius:24px 24px 0 0;padding:0 0 32px;box-shadow:0 -8px 40px rgba(0,0,0,0.18);max-height:75vh;display:flex;flex-direction:column;animation:slideUp 0.25s ease;';

    // Agrupar por categoría
    const groups = [
      { label: '🍽️ Comer y beber',    cat: 'RESTAURANTS' },
      { label: '🎉 Salir',             cat: 'ENTERTAINMENT' },
      { label: '🛍️ Compras',           cat: 'SHOPPING' },
      { label: '💆 Salud',             cat: 'HEALTH' },
      { label: '🌳 Explorar',          cat: 'PARKS' },
    ];

    const rowsHtml = groups.map(g => {
      const items = STEP_TYPES.filter(s => s.cat === g.cat);
      return `
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:14px 0 8px 0;">${g.label}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${this._chunkArray(items, 2).map(pair => `
            <div style="display:flex;gap:8px;">
              ${pair.map(s => `
                <button class="pm-step-type-btn" data-key="${s.key}"
                  style="flex:1;display:flex;align-items:center;gap:8px;padding:11px 12px;border-radius:14px;border:1.5px solid #e5e7eb;background:white;cursor:pointer;-webkit-tap-highlight-color:transparent;">
                  <img src="${s.icon3d}" style="width:26px;height:26px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'">
                  <span style="font-size:13px;font-weight:700;color:#111;text-align:left;">${s.label}</span>
                </button>`).join('')}
              ${pair.length === 1 ? '<div style="flex:1;"></div>' : ''}
            </div>`).join('')}
        </div>`;
    }).join('');

    sheet.innerHTML = `
      <div style="width:36px;height:4px;background:#e5e7eb;border-radius:4px;margin:12px auto 0;flex-shrink:0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;flex-shrink:0;">
        <div style="font-size:16px;font-weight:800;color:#111;">Agregar paso</div>
        <button id="pm-sheet-close" style="width:30px;height:30px;border-radius:50%;border:none;background:#f3f4f6;font-size:16px;cursor:pointer;">✕</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 16px;">${rowsHtml}</div>
    `;

    document.body.appendChild(sheet);
    document.getElementById('pm-sheet-close').addEventListener('click', () => sheet.remove());

    sheet.querySelectorAll('.pm-step-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = STEP_TYPES.find(s => s.key === btn.dataset.key);
        if (!type) return;
        this.currentPlan.steps.push({
          type: type.key,
          label: type.label,
          emoji: type.emoji,
          icon_url: type.icon3d,
          place_name: null,
          place_id: null,
          lat: null, lng: null
        });
        sheet.remove();
        this._renderStepsList();
      });
    });
  }

  // ── Guardar plan + asociar activities ───────────────────────────
  async _handleSavePlan() {
    if (!this.currentUser) {
      window.wpApp?.showMapToast?.('Inicia sesión para crear un plan', '#f59e0b');
      return;
    }

    const title = this.currentPlan.title.trim();
    if (!title) {
      const input = document.getElementById('pm-plan-title');
      if (input) { input.focus(); input.style.borderColor='#ef4444'; setTimeout(()=>input.style.borderColor='#e5e7eb',2000); }
      window.wpApp?.showMapToast?.('Dale un nombre a tu plan', '#f59e0b');
      return;
    }

    const btn = document.getElementById('pm-next-2');
    if (btn) { btn.disabled=true; btn.textContent='Guardando...'; }

    try {
      // 1. Calcular scheduled_date: manual > auto desde actividades > null
      const _acts = this.currentPlan.pendingActivities || [];
      const _actsWithDate = _acts.filter(a => a.scheduled_at);
      const _autoDate = _actsWithDate.length
        ? _actsWithDate.reduce((min, a) => a.scheduled_at < min ? a.scheduled_at : min, _actsWithDate[0].scheduled_at)
        : null;
      const _finalDate = this.currentPlan._dateSetManually
        ? (this.currentPlan.scheduled_date || null)
        : (_autoDate || this.currentPlan.scheduled_date || null);

      // Crear el plan (solo metadata)
      const plan = await PlanService.createPlan({
        title,
        description:    this.currentPlan.description    || '',
        emoji:          this.currentPlan.emoji           || '✨',
        creator_id:     this.currentUser.id,
        is_public:      this.currentPlan.is_public !== false,
        scheduled_date: _finalDate
      });

      // 2. Asociar activities existentes al plan
      const acts = this.currentPlan.pendingActivities || [];
      for (let i = 0; i < acts.length; i++) {
        await PlanService.addActivityToPlan(plan.id, acts[i].id, i);
      }

      // 3. Refrescar pines del mapa si hay actividades
      if (acts.length > 0) {
        window.wpApp?.loadActivitiesOnMap?.();
      }

      // 4. Obtener plan completo con share_token
      const fullPlan = await PlanService.getPlanByToken(plan.share_token);
      this.currentPlan = { ...this.currentPlan, ...fullPlan };

      this.onPlanCreated?.(fullPlan);
      this._goToStep(3);

    } catch (err) {
      console.error('Error creando plan:', err);
      window.wpApp?.showMapToast?.(err.message || 'Error al guardar el plan', '#ef4444');
      if (btn) { btn.disabled=false; btn.textContent='Confirmar plan →'; }
    }
  }

  // ── STEP 3: Confirmar + Compartir ────────────────────────────────
  _renderStep3(container) {
    const plan     = this.currentPlan;
    const shareUrl = PlanService.getShareUrl(plan.share_token);
    const steps    = (plan.plan_activities || []).map(pa => pa.activities || pa).filter(Boolean);
    const pending   = this.currentPlan.pendingActivities || [];
    const allActs   = steps.length ? steps : pending;
    const withPlace = allActs.filter(s => s.lat || s.place_name);
    const privacy  = plan.is_public !== false ? '🌍 Público' : '🔒 Solo amigos';
    const maxP     = plan.max_participants || 4;

    container.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:24px 20px;">

        <!-- Check animado -->
        <div style="text-align:center;margin-bottom:20px;">
          <div style="width:72px;height:72px;border-radius:50%;background:#111;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;animation:pm-pop 0.4s cubic-bezier(.34,1.56,.64,1);">
            <span style="font-size:32px;color:white;">✓</span>
          </div>
          <h2 style="font-size:22px;font-weight:800;color:#111;margin:0 0 4px;">${plan.emoji} ${plan.title}</h2>
          <p style="font-size:13px;color:#9ca3af;margin:0;">${privacy} · Máx ${maxP} personas</p>
        </div>

        <!-- Resumen de pasos -->
        ${allActs.length > 0 ? `
        <div style="background:#f9fafb;border-radius:16px;padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Tu plan</div>
          ${allActs.slice(0,5).map((s,i) => `
            <div style="display:flex;align-items:center;gap:10px;${i<Math.min(steps.length,5)-1?'margin-bottom:10px;':''}">
              <div style="width:24px;height:24px;border-radius:50%;background:#111;color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
              <span style="font-size:16px;">${s.emoji||'📍'}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:#111;">${s.label||s.type}</div>
                ${s.place_name ? `<div style="font-size:11px;color:#16a34a;">✓ ${s.place_name}</div>` : '<div style="font-size:11px;color:#d1d5db;">Sin lugar asignado</div>'}
              </div>
            </div>`).join('')}
          ${allActs.length>5?`<p style="font-size:11px;color:#9ca3af;text-align:center;margin:10px 0 0;">+${allActs.length-5} más</p>`:''}
        </div>` : ''}

        <!-- Pines en el mapa -->
        ${allActs.length > 0 ? `
        <div style="background:#f0fdf4;border-radius:14px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;border:1.5px solid #86efac;">
          <span style="font-size:20px;">📍</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#15803d;">${allActs.length} actividad${allActs.length!==1?'es':''} en el plan</div>
            <div style="font-size:11px;color:#16a34a;">Visibles en el mapa · Otros pueden unirse</div>
          </div>
        </div>` : ''}

        <!-- Link compartible -->
        <div style="background:#f3f4f6;border-radius:12px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:12px;color:#6b7280;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${shareUrl}</span>
          <button id="pm-copy-link" style="flex-shrink:0;background:#111;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">Copiar</button>
        </div>

        <!-- Compartir -->
        <button id="pm-share-btn" style="width:100%;padding:15px;background:#25D366;color:white;border:none;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:20px;">📤</span> Compartir por WhatsApp / SMS
        </button>
        <button id="pm-done-btn" style="width:100%;padding:14px;background:#f3f4f6;color:#374151;border:none;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer;">
          Listo
        </button>
      </div>
      <style>@keyframes pm-pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}</style>
    `;

    document.getElementById('pm-share-btn').addEventListener('click', async () => {
      const btn = document.getElementById('pm-share-btn');
      try {
        const result = await PlanService.sharePlan(plan);
        if (result === 'copied') {
          btn.innerHTML = '✓ Link copiado';
          setTimeout(() => { btn.innerHTML = '<span style="font-size:20px;">📤</span> Compartir por WhatsApp / SMS'; }, 2500);
        }
      } catch(e) {}
    });

    document.getElementById('pm-copy-link').addEventListener('click', async () => {
      const btn = document.getElementById('pm-copy-link');
      await navigator.clipboard.writeText(shareUrl).catch(()=>{});
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
    });

    document.getElementById('pm-done-btn').addEventListener('click', () => this.hide());
  }

  // ── Emoji picker simple ──────────────────────────────────────────
  _showEmojiPicker() {
    document.getElementById('pm-emoji-sheet')?.remove();
    const emojis = ['✨','🎉','🦷','🛍️','🌮','🍻','🎵','🌳','📸','💆','🏖️','🎯','🍔','☕','🥗','🌯','🎮','🎤','🛒','💊','🩺','⚽','🚴','🤝'];

    const sheet = document.createElement('div');
    sheet.id = 'pm-emoji-sheet';
    sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999999;background:white;border-radius:24px 24px 0 0;padding:16px 16px 32px;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.25s ease;';
    sheet.innerHTML = `
      <div style="width:36px;height:4px;background:#e5e7eb;border-radius:4px;margin:0 auto 16px;"></div>
      <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:12px;">Elige un emoji</div>
      <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;">
        ${emojis.map(e => `<button class="pm-emoji-opt" data-emoji="${e}" style="font-size:24px;background:none;border:none;cursor:pointer;padding:6px;border-radius:10px;">${e}</button>`).join('')}
      </div>`;
    document.body.appendChild(sheet);

    sheet.querySelectorAll('.pm-emoji-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPlan.emoji = btn.dataset.emoji;
        const emojiBtn = document.getElementById('pm-emoji-btn');
        if (emojiBtn) emojiBtn.textContent = btn.dataset.emoji;
        sheet.remove();
      });
    });

    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
  }

  // ── Util ─────────────────────────────────────────────────────────
  _chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }
}