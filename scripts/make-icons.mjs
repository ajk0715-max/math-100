// 앱 아이콘을 만든다: 공책 격자 위에 찍힌 빨간 도장 "100".
// 실행: npm run icons
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const RED = '#e8453c';

function grid() {
  const lines = [];
  for (let p = 0; p <= 512; p += 32) {
    lines.push(`<line x1="${p}" y1="0" x2="${p}" y2="512"/>`, `<line x1="0" y1="${p}" x2="512" y2="${p}"/>`);
  }
  return `<g stroke="#dde5f6" stroke-width="3">${lines.join('')}</g>`;
}

function svg({ scale = 1 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f4f6fb"/>
  ${grid()}
  <g transform="translate(256 256) scale(${scale}) rotate(-8) translate(-256 -256)">
    <circle cx="256" cy="256" r="196" fill="#f4f6fb" fill-opacity="0.85"/>
    <circle cx="256" cy="256" r="196" fill="none" stroke="${RED}" stroke-width="22"/>
    <circle cx="256" cy="256" r="162" fill="none" stroke="${RED}" stroke-width="5"/>
    <path d="M138 224 L176 190 L182 190 L182 340 L152 340 L152 236 L138 244 Z" fill="${RED}"/>
    <ellipse cx="238" cy="265" rx="30" ry="50" fill="none" stroke="${RED}" stroke-width="24"/>
    <ellipse cx="332" cy="265" rx="30" ry="50" fill="none" stroke="${RED}" stroke-width="24"/>
    <path d="M256 112 l9.5 19.3 21.2 3.1 -15.4 15 3.6 21.1 -18.9 -10 -18.9 10 3.6 -21.1 -15.4 -15 21.2 -3.1 z" fill="${RED}"/>
    <path d="M206 374 H306" stroke="${RED}" stroke-width="9" stroke-linecap="round"/>
  </g>
</svg>`;
}

async function png(name, size, opts) {
  await sharp(Buffer.from(svg(opts))).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}

await png('icon-512.png', 512, { scale: 1 });
await png('icon-192.png', 192, { scale: 1 });
await png('apple-touch-icon.png', 180, { scale: 1 });
await png('maskable-512.png', 512, { scale: 0.76 });
