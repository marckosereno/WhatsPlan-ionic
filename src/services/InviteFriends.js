// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — services/InviteFriends.js
// "Invitar amigos a la app": un mensaje con la dirección de WhatsPlan.
// Sin enlaces especiales: la hoja de compartir del teléfono (Capacitor
// Share si está, si no Web Share), si no WhatsApp y si no se copia.
// Lo usan Social (encabezado y pantalla vacía) y Perfil.
// Uso: inviteFriends({ username, toast })
// ════════════════════════════════════════════════════════════════════
export const APP_URL = 'https://whats-plan-ionic.vercel.app';

export async function inviteFriends({ username, toast } = {}) {
  const who = username ? ` Búscame como @${username}.` : '';
  const text = `Te invito a WhatsPlan: ahí armamos planes juntos y descubrimos a dónde ir.${who}`;
  const say = toast || window.wpApp?.placeModal?._showToast?.bind(window.wpApp.placeModal) || (() => {});
  const cap = window.Capacitor?.Plugins?.Share;
  try {
    if (cap?.share) { await cap.share({ title: 'WhatsPlan', text, url: APP_URL, dialogTitle: 'Invitar amigos' }); return; }
    if (navigator.share) { await navigator.share({ title: 'WhatsPlan', text, url: APP_URL }); return; }
  } catch (e) {
    if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return;   // cerró la hoja: no es error
  }
  if (window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${APP_URL}`)}`, '_blank')) return;
  try { await navigator.clipboard.writeText(`${text} ${APP_URL}`); say('Invitación copiada'); }
  catch (_) { say('No se pudo compartir'); }
}

export const INVITE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>';
