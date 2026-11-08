// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — tabs/social-tab.js
// Pestaña "Social" de la barra de abajo: aquí vivirán los chats de los
// planes (los que van a cada plan). Por ahora: el encabezado "Mensajes"
// con sus chips y un aviso de que llega pronto, con un atajo a tus
// planes. Cuando exista el chat, esta pantalla se vuelve la lista de
// conversaciones.
//
// Uso: const t = new SocialTab({ onGoPlans }); t.open(); t.close()
// Estilos: /styles/tabs.css (.wp-so-*)
// ════════════════════════════════════════════════════════════════════
import { openTabScreen } from '/src/components/tabs/tab-screen.js';

export class SocialTab {
  constructor({ onGoPlans }) { this.onGoPlans = onGoPlans; this.scr = null; }

  open() {
    if (this.scr?.root.isConnected) return;
    this.scr = openTabScreen('social', `
      <header class="wp-pt-head"><h1>Mensajes</h1><span>Con los que van a tus planes</span></header>
      <div class="wp-pt-tabs"><button type="button" class="on">Todos</button><button type="button" disabled>Sin leer</button><button type="button" disabled>Planes</button></div>
      <div class="wp-so-soon">
        <div class="wp-so-art" aria-hidden="true"><i>💬</i><i>🎉</i><i>📸</i></div>
        <b>Muy pronto vas a platicar aquí</b>
        <span>Cada plan tendrá su chat con los que se unieron: para ponerse de acuerdo antes, avisar "ya llegué" durante y compartir fotos después.</span>
        <button type="button" class="wp-pt-cta" data-go-plans>Ver mis planes</button>
      </div>`);
    this.scr.root.addEventListener('click', (e) => { if (e.target.closest('[data-go-plans]')) this.onGoPlans?.(); });
  }

  close() { this.scr?.close(); this.scr = null; }
}
