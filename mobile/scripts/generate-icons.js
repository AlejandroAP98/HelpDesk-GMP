/**
 * Genera iconos de la app para Android e iOS.
 * Crea un ticket azul (#2563eb) simple en PNG.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ANDROID_RES = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const IOS_APPICON = path.resolve(__dirname, '..', 'ios', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const ICON_COLORS = { bg: '#2563eb', fg: '#ffffff' };

function makeTicketIcon(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: ICON_COLORS.bg,
    },
  })
    .composite([
      {
        input: Buffer.from(`
          <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <g fill="${ICON_COLORS.fg}">
              <rect x="${size * 0.2}" y="${size * 0.3}" width="${size * 0.6}" height="${size * 0.4}" rx="${size * 0.05}" fill="none" stroke="${ICON_COLORS.fg}" stroke-width="${size * 0.04}"/>
              <line x1="${size * 0.32}" y1="${size * 0.4}" x2="${size * 0.68}" y2="${size * 0.4}" stroke="${ICON_COLORS.fg}" stroke-width="${size * 0.02}"/>
              <line x1="${size * 0.32}" y1="${size * 0.5}" x2="${size * 0.6}" y2="${size * 0.5}" stroke="${ICON_COLORS.fg}" stroke-width="${size * 0.02}"/>
              <line x1="${size * 0.32}" y1="${size * 0.6}" x2="${size * 0.5}" y2="${size * 0.6}" stroke="${ICON_COLORS.fg}" stroke-width="${size * 0.02}"/>
            </g>
          </svg>
        `),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

async function main() {
  console.log('Generando iconos Android...');
  const androidSizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
  };
  for (const [dir, size] of Object.entries(androidSizes)) {
    const targetDir = path.join(ANDROID_RES, dir);
    fs.mkdirSync(targetDir, { recursive: true });
    const buffer = await makeTicketIcon(size);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), buffer);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), buffer);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), buffer);
    console.log(`  ${dir}: ${size}x${size}`);
  }

  console.log('Generando iconos iOS...');
  fs.mkdirSync(IOS_APPICON, { recursive: true });
  const ios1024 = await makeTicketIcon(1024);
  fs.writeFileSync(path.join(IOS_APPICON, 'icon-1024.png'), ios1024);
  console.log('  AppIcon: 1024x1024');

  console.log('Listo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
