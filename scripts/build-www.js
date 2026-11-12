// Copia la web (sin bundler) a www/ para que Capacitor la empaquete en la app.
// Uso: npm run build:www
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
for (const f of ['index.html', 'src', 'styles']) if (existsSync(f)) cpSync(f, `www/${f}`, { recursive: true });
console.log('www/ listo');
