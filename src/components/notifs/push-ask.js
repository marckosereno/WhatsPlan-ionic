// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — notifs/push-ask.js
// Hoja que ofrece activar los avisos de la app nativa, ANTES del diálogo
// del sistema (Android solo deja mostrarlo un par de veces: si el usuario
// lo rechaza en frío, ya no vuelve a salir). La abre PushService.offer()
// tras unirse a un plan o crear uno.
//   openPushAsk('prompt') → explica y, con "Activar", lanza el diálogo
//   openPushAsk('denied') → están bloqueados: pasos para encenderlos
// Estilos: /styles/notifs.css (.wp-pa-*)
// ════════════════════════════════════════════════════════════════════
import { PushService } from '/src/services/PushService.js';
import { attachPulse } from '/src/components/place-plans/pulse.js';
import { ensureCss } from '/src/components/tabs/tab-screen.js';

const BELL = '<svg width="26" height="26" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M440.08 341.31c-1.66-2-3.29-4-4.89-5.93-22-26.61-35.31-42.67-35.31-118 0-39-9.33-71-27.72-95-13.56-17.73-31.89-31.18-56.05-41.12a3 3 0 0 1-.82-.67C306.6 51.49 282.82 32 256 32s-50.59 19.49-59.28 48.56a3.13 3.13 0 0 1-.81.65c-56.38 23.21-83.78 67.74-83.78 136.14 0 75.36-13.29 91.42-35.31 118-1.6 1.93-3.23 3.89-4.89 5.93a35.16 35.16 0 0 0-4.65 37.62c6.17 13 19.32 21.07 34.33 21.07H410.5c14.94 0 28-8.06 34.19-21a35.17 35.17 0 0 0-4.61-37.66ZM256 480a80.06 80.06 0 0 0 70.44-42.13 4 4 0 0 0-3.54-5.87H189.12a4 4 0 0 0-3.55 5.87A80.06 80.06 0 0 0 256 480Z"/></svg>';

export function openPushAsk(state = 'prompt') {
  if (document.getElementById('wp-pa')) return;
  ensureCss('wp-notifs-css', '/styles/notifs.css');
  const denied = state === 'denied';
  const root = document.createElement('div');
  root.id = 'wp-pa';
  root.innerHTML = `
    <div class="wp-pa-scrim"></div>
    <div class="wp-pa-card" role="dialog" aria-modal="true" aria-label="Avisos">
      <i class="wp-pa-grab" aria-hidden="true"></i>
      <div class="wp-pa-ic">${BELL}</div>
      <h3>${denied ? 'Los avisos están apagados' : 'No te pierdas el plan'}</h3>
      <p>${denied
        ? 'Sin avisos no sabrás cuando alguien se una o te escriba. Puedes encenderlos en Ajustes del teléfono: Aplicaciones, WhatsPlan, Notificaciones.'
        : 'Te avisamos cuando alguien se une a tu plan, cuando te escriben en el chat y una hora antes de que empiece. Solo lo de tus planes.'}</p>
      <button type="button" class="wp-pa-go" data-a="go">${denied ? (hasSettings() ? 'Abrir ajustes' : 'Entendido') : 'Activar avisos'}</button>
      ${denied && !hasSettings() ? '' : '<button type="button" class="wp-pa-no" data-a="no">Ahora no</button>'}
    </div>`;
  document.body.appendChild(root);
  attachPulse(root);
  void root.offsetWidth;
  root.classList.add('in');

  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    root.classList.remove('in');
    setTimeout(() => root.remove(), 320);
  };
  root.querySelector('.wp-pa-scrim').addEventListener('click', close);
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    if (b.dataset.a === 'no') return close();
    if (denied) { await openSettings(); return close(); }
    b.disabled = true;
    await PushService.enable();    // aquí sale el diálogo del sistema
    close();
  });
}

// "Abrir ajustes" solo si la app trae el plugin capacitor-native-settings
const settingsPlugin = () => window.Capacitor?.Plugins?.NativeSettings;
const hasSettings = () => !!settingsPlugin();
async function openSettings() {
  try { await settingsPlugin()?.open({ optionAndroid: 'applicationDetails', optionIOS: 'app' }); } catch (_) {}
}
