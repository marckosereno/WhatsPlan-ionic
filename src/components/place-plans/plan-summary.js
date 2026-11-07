// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/plan-summary.js
// "Resumen del plan" en "Tu plan" / plan completo: un bloque con una raya
// azul a la izquierda. Si el plan ya tiene resumen (activities.ai_summary)
// se muestra; si no, un botón "Crear resumen" lo pide a
// /api/groq-description?mode=plan (Groq, con las descripciones y reseñas
// de los lugares) mientras se ven líneas "cargando". Si el plan cambia
// (lugares u horario), el servidor lo vuelve a generar.
// Versión de pago: si el servidor responde 402 (PLAN_SUMMARY_PAID_ONLY),
// el bloque invita a la versión Pro en vez de mostrar el error.
//
// Mixin de PlaceModal2. Estilos: /styles/my-plan.css (.wp-mp-ai*)
// SQL: supabase/28_plan_ai_summary.sql
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';

const SPARK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z"/></svg>';

export class PlanSummary {
  _mpSummaryHtml(a) {
    return `<section class="wp-mp-ai${a.ai_summary ? ' has' : ''}">
        <div class="wp-mp-ai-h">${SPARK}<b>Resumen del plan</b></div>
        ${a.ai_summary ? `<p>${this._esc(a.ai_summary)}</p>`
          : `<p class="wp-mp-ai-hint">Un resumen de los lugares del plan, qué se puede hacer ahí y qué tal pinta.</p>
             <button type="button" class="wp-mp-ai-go" data-a="summary">${SPARK}<span>Crear resumen</span></button>`}
      </section>`;
  }

  async _mpSummary(ctx, btn) {
    const box = btn.closest('.wp-mp-ai');
    box.classList.add('loading');
    box.querySelector('.wp-mp-ai-hint')?.remove();
    btn.outerHTML = '<span class="wp-mp-ai-sk"><i></i><i></i><i></i></span>';
    let text = '', err = '';
    try {
      const { data } = await getSupabase().auth.getSession();
      const r = await fetch(`/api/groq-description?mode=plan&activity_id=${encodeURIComponent(ctx.a.id)}`, {
        headers: data?.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {},
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 402) err = 'pro';
      else if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
      text = j.summary || '';
    } catch (e) { err = e.message || 'No se pudo crear el resumen'; }
    box.classList.remove('loading');
    box.querySelector('.wp-mp-ai-sk')?.remove();
    if (err === 'pro') { box.insertAdjacentHTML('beforeend', '<p class="wp-mp-ai-hint">El resumen del plan es parte de la versión Pro.</p>'); return; }
    if (err) { this._showToast(err); box.outerHTML = this._mpSummaryHtml(ctx.a); return; }
    ctx.a.ai_summary = text;
    box.classList.add('has');
    box.insertAdjacentHTML('beforeend', `<p class="wp-mp-ai-new">${this._esc(text)}</p>`);
    this._haptic?.('success');
  }
}
