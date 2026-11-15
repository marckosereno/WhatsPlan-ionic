// Emoji del set de LG (emoji-cdn, https://github.com/oddmario/emoji-cdn) como <img>.
// Si la imagen no carga (sin internet, CDN caído) se cae al emoji de texto.
const BASE = 'https://emoji-cdn.mqrio.dev/';

export function lgEmojiUrl(emoji) {
  return `${BASE}${encodeURIComponent(emoji)}?style=lg`;
}

// size en px (ancho y alto); extra = estilos inline adicionales
export function lgEmojiImg(emoji, size = 24, extra = '') {
  const e = String(emoji || '');
  if (!e) return '';
  return `<img src="${lgEmojiUrl(e)}" alt="${e}" draggable="false" style="width:${size}px;height:${size}px;object-fit:contain;display:block;${extra}" onerror="this.replaceWith(document.createTextNode(this.alt))">`;
}
