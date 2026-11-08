// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-react.js
// Al mantener presionado un mensaje: la burbuja se resalta y aparece
// encima una barra blanca con 6 reacciones (entran en cascada; la tuya
// marcada) y debajo un menú corto (Responder · Copiar). Lo demás se
// oscurece un poco; tocar fuera cierra.
//
// Uso: openReactBar(bubbleEl, { mine, canCopy, onPick(emoji), onReply(), onCopy() })
// Estilos: /styles/chat.css (.wp-ch-rx*)
// ════════════════════════════════════════════════════════════════════
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const REPLY = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
const COPY = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';

export function openReactBar(bubble, o) {
  const r = bubble.getBoundingClientRect();
  const root = document.createElement('div');
  root.className = 'wp-ch-rx';
  root.innerHTML = `
    <div class="wp-ch-rx-bar">${REACTIONS.map((e, i) => `<button type="button" data-e="${e}" class="${e === o.mine ? 'on' : ''}" style="--i:${i}">${e}</button>`).join('')}</div>
    <div class="wp-ch-rx-menu">
      <button type="button" data-do="reply">${REPLY}<span>Responder</span></button>
      ${o.canCopy ? `<button type="button" data-do="copy">${COPY}<span>Copiar</span></button>` : ''}
    </div>`;
  document.body.appendChild(root);
  const bar = root.querySelector('.wp-ch-rx-bar'), menu = root.querySelector('.wp-ch-rx-menu');
  const vw = window.innerWidth, bw = bar.offsetWidth, mw = menu.offsetWidth;
  const left = (w) => Math.max(10, Math.min(vw - w - 10, r.left + r.width / 2 - w / 2));
  const above = r.top - bar.offsetHeight - 10 > 60;
  bar.style.left = `${left(bw)}px`;
  bar.style.top = `${above ? r.top - bar.offsetHeight - 10 : r.bottom + 10}px`;
  menu.style.left = `${left(mw)}px`;
  menu.style.top = `${above ? r.bottom + 10 : r.bottom + bar.offsetHeight + 20}px`;
  bubble.classList.add('wp-ch-held');
  void root.offsetWidth;
  root.classList.add('in');
  const close = () => {
    root.classList.remove('in');
    bubble.classList.remove('wp-ch-held');
    setTimeout(() => root.remove(), 200);
  };
  const t0 = Date.now();
  root.addEventListener('click', (e) => {
    if (Date.now() - t0 < 380) return;   // el "soltar" del mismo toque largo no la cierra
    const em = e.target.closest('[data-e]'), d = e.target.closest('[data-do]');
    if (em) o.onPick?.(em.dataset.e);
    else if (d?.dataset.do === 'reply') o.onReply?.();
    else if (d?.dataset.do === 'copy') o.onCopy?.();
    close();
  });
  return { close };
}
