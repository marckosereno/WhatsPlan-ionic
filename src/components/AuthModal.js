// ====================================================================
// WHATSPLAN — AuthModal.js
// Login Google / email+password — Fase 8
// ====================================================================

import { AuthService, ProfileService } from '/src/services/SupabaseService.js';

export class AuthModal {
  constructor({ onAuthSuccess } = {}) {
    this.onAuthSuccess = onAuthSuccess;
    this.currentUser   = null;
    this.modal         = null;
    this._render();
    this._setupListeners();
    this._checkCurrentUser();
  }

  // ── Render ───────────────────────────────────────────────────────
  _render() {
    document.getElementById('auth-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'auth-modal-overlay';
    overlay.innerHTML = `
      <div id="auth-modal" class="auth-modal">

        <div class="auth-modal-header">
          <button id="auth-modal-close" class="auth-modal-close">✕</button>
          <h2 class="auth-modal-title">Únete a WhatsPlan</h2>
          <p class="auth-modal-subtitle">Crea actividades y conecta con otros en Nuevo Progreso</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Entrar</button>
          <button class="auth-tab" data-tab="register">Registrarse</button>
        </div>

        <!-- Login -->
        <div id="auth-form-login" class="auth-form">
          <input type="email"    id="auth-email"    class="auth-input" placeholder="tu@email.com">
          <input type="password" id="auth-password" class="auth-input" placeholder="Contraseña">
          <button id="auth-btn-login" class="auth-btn-primary">Entrar</button>
          <div class="auth-divider"><span>o</span></div>
          <button id="auth-btn-google" class="auth-btn-google">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </button>
        </div>

        <!-- Registro -->
        <div id="auth-form-register" class="auth-form hidden">
          <input type="text"     id="auth-name"         class="auth-input" placeholder="Tu nombre">
          <input type="email"    id="auth-email-reg"    class="auth-input" placeholder="tu@email.com">
          <input type="password" id="auth-password-reg" class="auth-input" placeholder="Contraseña (mín. 6 caracteres)">
          <button id="auth-btn-register" class="auth-btn-primary">Crear cuenta</button>
          <div class="auth-divider"><span>o</span></div>
          <button id="auth-btn-google-reg" class="auth-btn-google">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </button>
        </div>

        <p id="auth-message" class="auth-message hidden"></p>
      </div>`;

    document.body.appendChild(overlay);
    this.modal = overlay;
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById('auth-modal-styles')) return;
    const s = document.createElement('style');
    s.id = 'auth-modal-styles';
    s.textContent = `
      #auth-modal-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 9000;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        align-items: flex-end;
        justify-content: center;
      }
      #auth-modal-overlay.visible { display: flex; }

      @keyframes authSlideUp {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }

      .auth-modal {
        background: white;
        border-radius: 24px 24px 0 0;
        padding: 28px 24px 40px;
        width: 100%;
        max-width: 480px;
        animation: authSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        max-height: 90dvh;
        overflow-y: auto;
      }

      .auth-modal-header { margin-bottom: 20px; }
      .auth-modal-close {
        float: right;
        background: #f3f4f6;
        border: none;
        border-radius: 50%;
        width: 32px; height: 32px;
        font-size: 14px;
        cursor: pointer;
        color: #374151;
        display: flex; align-items: center; justify-content: center;
      }
      .auth-modal-title {
        font-size: 22px;
        font-weight: 800;
        color: #111;
        margin: 0 0 6px;
        font-family: 'Yahoo Sans Bold Regular', system-ui, sans-serif;
        clear: both;
      }
      .auth-modal-subtitle { font-size: 14px; color: #6b7280; margin: 0; }

      .auth-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 24px;
        border-bottom: 1.5px solid #f3f4f6;
      }
      .auth-tab {
        flex: 1;
        padding: 10px;
        background: none;
        border: none;
        font-size: 15px;
        font-weight: 600;
        color: #9ca3af;
        cursor: pointer;
        border-bottom: 2.5px solid transparent;
        margin-bottom: -1.5px;
        transition: all 0.2s;
        font-family: var(--wp-font);
      }
      .auth-tab.active { color: #111; border-bottom-color: #111; }

      .auth-form { display: flex; flex-direction: column; gap: 12px; }
      .auth-form.hidden { display: none; }

      .auth-input {
        padding: 14px 16px;
        border: 1.5px solid #e5e7eb;
        border-radius: 14px;
        font-size: 16px;
        outline: none;
        transition: border 0.2s;
        font-family: var(--wp-font);
        background: #fafafa;
      }
      .auth-input:focus { border-color: #2563eb; background: white; }

      .auth-btn-primary {
        padding: 15px;
        background: #111;
        color: white;
        border: none;
        border-radius: 14px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.2s;
        font-family: var(--wp-font);
      }
      .auth-btn-primary:disabled { opacity: 0.6; }

      .auth-btn-google {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px;
        background: white;
        color: #374151;
        border: 1.5px solid #e5e7eb;
        border-radius: 14px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
        font-family: var(--wp-font);
      }
      .auth-btn-google:active { background: #f9fafb; }

      .auth-divider {
        text-align: center;
        position: relative;
        color: #9ca3af;
        font-size: 13px;
        padding: 4px 0;
      }
      .auth-divider::before, .auth-divider::after {
        content: '';
        position: absolute;
        top: 50%;
        width: 44%;
        height: 1px;
        background: #e5e7eb;
      }
      .auth-divider::before { left: 0; }
      .auth-divider::after  { right: 0; }

      .auth-message {
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        margin-top: 4px;
        font-family: var(--wp-font);
      }
      .auth-message.error   { background: #fee2e2; color: #dc2626; }
      .auth-message.success { background: #dcfce7; color: #16a34a; }
      .auth-message.hidden  { display: none; }
    `;
    document.head.appendChild(s);
  }

  // ── Listeners ────────────────────────────────────────────────────
  _setupListeners() {
    document.getElementById('auth-modal-close').addEventListener('click', () => this.hide());
    this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.hide(); });

    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    });

    document.getElementById('auth-btn-login').addEventListener('click',      () => this._handleLogin());
    document.getElementById('auth-btn-register').addEventListener('click',   () => this._handleRegister());
    document.getElementById('auth-btn-google').addEventListener('click',     () => this._handleGoogle());
    document.getElementById('auth-btn-google-reg').addEventListener('click', () => this._handleGoogle());

    ['auth-email','auth-password'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._handleLogin();
      });
    });
  }

  _switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('auth-form-login').classList.toggle('hidden',    tab !== 'login');
    document.getElementById('auth-form-register').classList.toggle('hidden', tab !== 'register');
    this._clearMessage();
  }

  // ── Handlers ─────────────────────────────────────────────────────
  async _handleLogin() {
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return this._showMessage('Completa todos los campos', 'error');
    this._setLoading(true, 'auth-btn-login');
    try {
      const { user } = await AuthService.loginWithEmail(email, password);
      this._showMessage('¡Bienvenido de vuelta! 👋', 'success');
      setTimeout(() => { this.hide(); this.onAuthSuccess?.(user); }, 800);
    } catch(err) {
      this._showMessage(err.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : err.message, 'error');
    } finally { this._setLoading(false, 'auth-btn-login'); }
  }

  async _handleRegister() {
    const name     = document.getElementById('auth-name').value.trim();
    const email    = document.getElementById('auth-email-reg').value.trim();
    const password = document.getElementById('auth-password-reg').value;
    if (!name || !email || !password) return this._showMessage('Completa todos los campos', 'error');
    if (password.length < 6) return this._showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
    this._setLoading(true, 'auth-btn-register');
    try {
      const { user } = await AuthService.registerWithEmail(email, password, name);
      this._showMessage('¡Cuenta creada! Revisa tu email para confirmar ✅', 'success');
      setTimeout(() => { this.hide(); this.onAuthSuccess?.(user); }, 1200);
    } catch(err) {
      this._showMessage(err.message, 'error');
    } finally { this._setLoading(false, 'auth-btn-register'); }
  }

  async _handleGoogle() {
    try { await AuthService.loginWithGoogle(); }
    catch(err) { this._showMessage(err.message, 'error'); }
  }

  // ── Helpers ──────────────────────────────────────────────────────
  _showMessage(text, type) {
    const el = document.getElementById('auth-message');
    el.textContent = text;
    el.className   = `auth-message ${type}`;
  }
  _clearMessage() {
    const el = document.getElementById('auth-message');
    el.className = 'auth-message hidden';
    el.textContent = '';
  }
  _setLoading(loading, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled   = loading;
    btn.textContent = loading ? '⏳ Espera...' : (btnId === 'auth-btn-login' ? 'Entrar' : 'Crear cuenta');
  }

  async _checkCurrentUser() {
    try {
      const user = await AuthService.getCurrentUser();
      if (user) { this.currentUser = user; }
    } catch(_) {}
  }

  show() {
    this.modal.classList.add('visible');
    this._clearMessage();
  }
  hide() { this.modal.classList.remove('visible'); }
}
