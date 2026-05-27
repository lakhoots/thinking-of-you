import sharp from 'sharp';
import { readFileSync } from 'fs';
import { mkdir } from 'fs/promises';

const svg = readFileSync('./public/favicon.svg');

const sizes = [1024, 512, 192, 180, 120, 87, 80, 76, 60, 58, 40, 29, 20];

await mkdir('./public/icons', { recursive: true });

for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`./public/icons/icon-${size}.png`);
  console.log(`✓ icon-${size}.png`);
}
