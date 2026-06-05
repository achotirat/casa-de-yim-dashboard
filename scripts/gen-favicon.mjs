import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = (f) => resolve(__dirname, '../public', f);

// SVG brandmark: terracotta rounded-rect + white Y in serif
function svg(size) {
  const r = Math.round(size * 0.22);
  const fs = Math.round(size * 0.56);
  const cy = Math.round(size * 0.62);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#C56A45"/>
  <text x="${size/2}" y="${cy}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${fs}" font-weight="700"
    text-anchor="middle" fill="white">Y</text>
</svg>`;
}

const SIZES = [
  { size: 16,  file: 'favicon-16x16.png' },
  { size: 32,  file: 'favicon-32x32.png' },
  { size: 180, file: 'apple-touch-icon.png' },
  { size: 192, file: 'android-chrome-192x192.png' },
  { size: 512, file: 'android-chrome-512x512.png' },
];

for (const { size, file } of SIZES) {
  await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(pub(file));
  console.log(`✓ ${file}`);
}

// favicon.ico from 16 + 32
const buf16 = await sharp(Buffer.from(svg(16))).resize(16,16).png().toBuffer();
const buf32 = await sharp(Buffer.from(svg(32))).resize(32,32).png().toBuffer();
const ico = await pngToIco([buf16, buf32]);
writeFileSync(pub('favicon.ico'), ico);
console.log('✓ favicon.ico');
