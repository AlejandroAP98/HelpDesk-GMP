/**
 * Copia los archivos del wrapper de Capacitor al frontend.
 *
 * Esto evita duplicar codigo: el frontend importa desde /mobile/src/
 * y al construir la app nativa, esos archivos se sincronizan via este script.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.resolve(ROOT, '..', 'frontend');
const MOBILE_SRC = path.resolve(ROOT, 'src');
const FRONTEND_LIB = path.resolve(FRONTEND, 'src', 'lib', 'capacitor');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  const content = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(dest, content);
  console.log(`  ${path.relative(ROOT, src)} -> ${path.relative(ROOT, dest)}`);
}

function main() {
  console.log('Sincronizando mobile/src -> frontend/src/lib/capacitor');

  ensureDir(FRONTEND_LIB);

  const files = fs.readdirSync(MOBILE_SRC).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const src = path.join(MOBILE_SRC, file);
    const dest = path.join(FRONTEND_LIB, file);
    copyFile(src, dest);
  }

  console.log('Listo.');
}

main();
