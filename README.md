# WhatsPlan-ionic
## App nativa (Android) y push

Capacitor empaqueta la web (sin bundler) en `www/`. Id de la app: `com.whatsplan.app`.

```bash
npm install
npm run android:sync     # copia la web a www/ y sincroniza android/
npm run android:open     # abre Android Studio → ▶ en el teléfono o emulador
```

- `src/native/native.js`: puente con la app. `API_ORIGIN` apunta al dominio de Vercel (en la app, `/api/...` se manda allá).
- Push: `android/app/google-services.json` (Firebase) + `src/services/PushService.js` + `supabase/41_push_tokens.sql` + Edge Function `supabase/functions/push-send`.
- Activar el envío: (1) correr el SQL 41; (2) `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat cuenta-servicio.json)" PUSH_WEBHOOK_SECRET=<texto-al-azar>`; (3) `supabase functions deploy push-send --no-verify-jwt`; (4) en Supabase → Database → Webhooks: tabla `notifications`, evento INSERT, tipo HTTP request al URL de la función, header `x-webhook-secret` con el mismo texto.
- Avisos de chat y recordatorio de 1 hora antes: correr `supabase/42_push_chat_reminders.sql` (activa la extensión pg_cron en Database > Extensions si el aviso lo pide) y volver a desplegar la función push-send.
- Preferencias de avisos (Ajustes > Avisos): correr `supabase/43_push_prefs.sql` y volver a desplegar push-send, que respeta las categorías apagadas.
- Nunca subir al repo el JSON de la cuenta de servicio.
