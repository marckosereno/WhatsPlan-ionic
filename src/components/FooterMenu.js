// ====================================================================
// WHATSPLAN — src/components/FooterMenu.js
// Footer: pills independientes por ícono y label
// ====================================================================

const ICON_HOME = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.5742 21.8187C12.2295 22.0604 11.7699 22.0601 11.4253 21.8184L11.4228 21.8166L11.4172 21.8127L11.3986 21.7994C11.3829 21.7882 11.3607 21.7722 11.3325 21.7517C11.2762 21.7106 11.1956 21.6511 11.0943 21.5741C10.8917 21.4203 10.6058 21.1962 10.2641 20.9101C9.58227 20.3389 8.67111 19.5139 7.75692 18.4988C5.96368 16.5076 4 13.6105 4 10.3636C4 8.16134 4.83118 6.0397 6.32548 4.46777C7.82141 2.89413 9.86146 2 12 2C14.1385 2 16.1786 2.89413 17.6745 4.46777C19.1688 6.0397 20 8.16134 20 10.3636C20 13.6105 18.0363 16.5076 16.2431 18.4988C15.3289 19.5139 14.4177 20.3389 13.7359 20.9101C13.3942 21.1962 13.1083 21.4203 12.9057 21.5741C12.8044 21.6511 12.7238 21.7106 12.6675 21.7517C12.6393 21.7722 12.6171 21.7882 12.6014 21.7994L12.5828 21.8127L12.5772 21.8166L12.5754 21.8179L12.5742 21.8187ZM9 10C9 8.34315 10.3431 7 12 7C13.6569 7 15 8.34315 15 10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10Z" fill="currentColor"/></svg>`;

const ICON_ACTIVIDADES = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 2C8.55228 2 9 2.44772 9 3H15C15 2.44772 15.4477 2 16 2C16.5523 2 17 2.44772 17 3C19.7614 3 22 5.23858 22 8V17C22 19.7614 19.7614 22 17 22H7C4.23858 22 2 19.7614 2 17V8C2 5.23858 4.23858 3 7 3C7 2.44772 7.44772 2 8 2ZM15.7295 11.6839C16.1073 11.281 16.0869 10.6482 15.6839 10.2705C15.281 9.89274 14.6482 9.91315 14.2705 10.3161L11.1559 13.6383L9.62852 12.404C9.19896 12.0569 8.56933 12.1237 8.22221 12.5533C7.87508 12.9829 7.94192 13.6125 8.37148 13.9596L10.6215 15.7778C11.0289 16.107 11.6213 16.0661 11.9795 15.6839L15.7295 11.6839Z" fill="currentColor"/></svg>`;

const ICON_SOCIAL = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 13.8153 2.48451 15.5196 3.33127 16.9883C3.50372 17.2874 3.5333 17.6516 3.38777 17.9647L2.53406 19.8016C2.00986 20.7933 2.72736 22 3.86159 22H12C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM9 9C8.44772 9 8 9.44772 8 10C8 10.5523 8.44772 11 9 11H11C11.5523 11 12 10.5523 12 10C12 9.44772 11.5523 9 11 9H9ZM9 13C8.44772 13 8 13.4477 8 14C8 14.5523 8.44772 15 9 15H15C15.5523 15 16 14.5523 16 14C16 13.4477 15.5523 13 15 13H9Z" fill="currentColor"/></svg>`;

const PILL_STYLE = `
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(16px) saturate(1.8);
  -webkit-backdrop-filter: blur(16px) saturate(1.8);
  box-shadow: 0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9);
  border-radius: 50px;
`;

export class FooterMenu {
  constructor({ onActividades, onHome, onSocial } = {}) {
    this.callbacks = { actividades: onActividades, home: onHome, social: onSocial };
    this.current = 'home';
    this._build();
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById('wp-footer-styles')) return;
    const s = document.createElement('style');
    s.id = 'wp-footer-styles';
    s.textContent = `
      #wp-footer-menu {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 9995;
        padding: 0 16px;
        padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
        pointer-events: none;
      }

      .wp-menu-bar {
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 64px;
        pointer-events: none;
      }

      /* Side groups */
      .wp-menu-side {
        display: flex;
        align-items: center;
        gap: 0;
      }

      /* Individual pill — icon or label */
      .wp-pill {
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,0.88);
        backdrop-filter: blur(16px) saturate(1.8);
        -webkit-backdrop-filter: blur(16px) saturate(1.8);
        box-shadow: 0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9);
        border-radius: 50px;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        pointer-events: all;
        will-change: transform;
        flex-shrink: 0;
      }

      /* Icon pill */
      .wp-pill-icon {
        width: 42px;
        color: #374151;
      }
      .wp-pill-icon svg { width: 20px; height: 20px; }

      /* Label pill */
      .wp-pill-label {
        padding: 0 14px;
        font-size: 13px;
        font-weight: 700;
        color: #374151;
        font-family: 'Yahoo Sans Bold Regular', 'Inter Tight', system-ui, sans-serif;
        white-space: nowrap;
      }

      /* Active state */
      .wp-pill.active-pill {
        background: rgba(37,99,235,0.12);
        color: #2563eb;
      }
      .wp-pill.active-pill .wp-pill-label { color: #2563eb; }

      /* Center button — same height as pills */
      .wp-menu-center {
        flex-shrink: 0;
        pointer-events: all;
        will-change: transform;
      }

      .wp-menu-center-btn {
        width: 52px; height: 52px;
        border-radius: 50%;
        background: linear-gradient(145deg, #3b82f6, #1d4ed8);
        border: 3px solid white;
        box-shadow:
          0 8px 24px rgba(37,99,235,0.45),
          0 2px 8px rgba(0,0,0,0.12),
          inset 0 1px 0 rgba(255,255,255,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        color: white;
        will-change: transform;
      }
      .wp-menu-center-btn svg { width: 22px; height: 22px; }
    `;
    document.head.appendChild(s);
  }

  _build() {
    const wrap = document.createElement('div');
    wrap.id = 'wp-footer-menu';
    wrap.innerHTML = `
      <div class="wp-menu-bar">

        <!-- LEFT: Icono + Label Actividades -->
        <div class="wp-menu-side">
          <div class="wp-pill wp-pill-icon" id="wpm-act-icon" data-item="actividades">
            ${ICON_ACTIVIDADES}
          </div>
          <div class="wp-pill wp-pill-label" id="wpm-act-label" data-item="actividades">
            Activ...
          </div>
        </div>

        <!-- CENTER: Solo ícono circular -->
        <div class="wp-menu-center" id="wpm-home">
          <div class="wp-menu-center-btn">
            ${ICON_HOME}
          </div>
        </div>

        <!-- RIGHT: Label + Icono Social -->
        <div class="wp-menu-side">
          <div class="wp-pill wp-pill-label" id="wpm-soc-label" data-item="social">
            Social
          </div>
          <div class="wp-pill wp-pill-icon" id="wpm-soc-icon" data-item="social">
            ${ICON_SOCIAL}
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(wrap);
    this._attachEvents();
  }

  _attachEvents() {
    // Actividades pills
    ['wpm-act-icon','wpm-act-label'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        this._tap(id);
        this._setActive('actividades');
        if (this.callbacks.actividades) this.callbacks.actividades();
      });
    });

    // Home
    document.getElementById('wpm-home')?.addEventListener('click', () => {
      this._tapCenter();
      this._setActive('home');
      if (this.callbacks.home) this.callbacks.home();
    });

    // Social pills
    ['wpm-soc-icon','wpm-soc-label'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        this._tap(id);
        this._setActive('social');
        if (this.callbacks.social) this.callbacks.social();
      });
    });
  }

  _tap(id) {
    const el = document.getElementById(id);
    if (!el || !window.gsap) return;
    window.gsap.timeline()
      .to(el, { scale: 0.88, duration: 0.08, ease: 'power2.out' })
      .to(el, { scale: 1.08, duration: 0.22, ease: 'back.out(3)' })
      .to(el, { scale: 1, duration: 0.18, ease: 'power2.out' });
  }

  _tapCenter() {
    const btn = document.querySelector('.wp-menu-center-btn');
    if (!btn || !window.gsap) return;
    window.gsap.timeline()
      .to(btn, { scale: 0.88, duration: 0.08, ease: 'power2.out' })
      .to(btn, { scale: 1.1, duration: 0.25, ease: 'back.out(3)' })
      .to(btn, { scale: 1, duration: 0.2, ease: 'power2.out' });
  }

  _setActive(id) {
    this.current = id;

    // Reset all pills
    document.querySelectorAll('.wp-pill').forEach(p => p.classList.remove('active-pill'));

    // Activate
    if (id === 'actividades') {
      document.getElementById('wpm-act-icon')?.classList.add('active-pill');
      document.getElementById('wpm-act-label')?.classList.add('active-pill');
    } else if (id === 'social') {
      document.getElementById('wpm-soc-icon')?.classList.add('active-pill');
      document.getElementById('wpm-soc-label')?.classList.add('active-pill');
    }

    // Center button
    const btn = document.querySelector('.wp-menu-center-btn');
    if (btn) {
      btn.style.background = id === 'home'
        ? 'linear-gradient(145deg, #3b82f6, #1d4ed8)'
        : 'linear-gradient(145deg, #9ca3af, #6b7280)';
      btn.style.boxShadow = id === 'home'
        ? '0 8px 24px rgba(37,99,235,0.45), 0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)'
        : '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)';
    }
  }

  animateIn() {
    const items = ['wpm-act-icon','wpm-act-label','wpm-home','wpm-soc-label','wpm-soc-icon'];
    if (!window.gsap) return;
    items.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      window.gsap.fromTo(el,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(1.8)', delay: 0.2 + i * 0.06 }
      );
    });
  }
}
