// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-compose.js
// Ayudas de la barra de escribir del chat (plan-chat.js):
//  · Respondiendo a… : una tira arriba de la barra con el nombre y el
//    texto del mensaje (raya azul a la izquierda es la cita, no una
//    tarjeta) y × para quitarla.
//  · @menciones: al escribir "@" sale una tira con las caras y nombres
//    de los del plan que coinciden; tocar uno lo completa ("@Ana ").
//  · Fotos: elegir una foto, achicarla (lado mayor 1600 px, JPG 82 %) y
//    ver una foto en grande (tocar cierra).
// ════════════════════════════════════════════════════════════════════
import { face } from '/src/components/chat/chat-render.js';

export function paintReply(pm, foot, msg, me, onClear) {
  foot.querySelector('.wp-ch-reply')?.remove();
  if (!msg) return;
  const who = msg.user_id === me ? 'ti' : pm._phName(msg.user_id);
  const el = document.createElement('div');
  el.className = 'wp-ch-reply';
  el.innerHTML = `<span><b>Respondiendo a ${who}</b><small>${pm._esc(msg.body || (msg.image_path ? '📷 Foto' : ''))}</small></span>
    <button type="button" aria-label="Quitar respuesta">×</button>`;
  el.querySelector('button').addEventListener('click', onClear);
  foot.querySelector('.wp-ch-bar').before(el);
}

// Sugerencias de @: members = [{ id, name }]
export function paintMentions(pm, foot, input, members) {
  const v = input.value.slice(0, input.selectionStart), m = /(^|\s)@([\wáéíóúñÁÉÍÓÚÑ]*)$/.exec(v);
  let box = foot.querySelector('.wp-ch-at-list');
  if (!m) { box?.remove(); return; }
  const q = m[2].toLowerCase(), hits = members.filter(x => x.name.toLowerCase().startsWith(q)).slice(0, 6);
  if (!hits.length) { box?.remove(); return; }
  if (!box) {
    box = document.createElement('div');
    box.className = 'wp-ch-at-list';
    foot.querySelector('.wp-ch-bar').before(box);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-name]'); if (!b) return;
      const at = input.selectionStart, before = input.value.slice(0, at).replace(/@[\wáéíóúñÁÉÍÓÚÑ]*$/, `@${b.dataset.name} `);
      input.value = before + input.value.slice(at);
      input.setSelectionRange(before.length, before.length);
      input.focus();
      box.remove();
      input.dispatchEvent(new Event('input'));
    });
  }
  box.innerHTML = hits.map(x => `<button type="button" data-name="${pm._esc(x.name)}">${face(pm, x.id, 'wp-ch-face s')}<span>${pm._esc(x.name)}</span></button>`).join('');
}

export function pickPhoto() {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => resolve(inp.files?.[0] || null);
    inp.click();
  });
}

export function shrinkPhoto(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}

export function openPhoto(url) {
  if (!url) return;
  const v = document.createElement('div');
  v.className = 'wp-ch-view';
  v.innerHTML = `<i style="background-image:url('${url.replace(/'/g, '%27')}')"></i>`;
  document.body.appendChild(v);
  void v.offsetWidth; v.classList.add('in');
  v.addEventListener('click', () => { v.classList.remove('in'); setTimeout(() => v.remove(), 220); });
}
