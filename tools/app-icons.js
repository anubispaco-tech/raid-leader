// v0.21.1 產生主畫面圖示（加到主畫面／安裝用）：雙劍（game-icons.net crossed-swords，CC BY 3.0）放在深色底
// 用法：node tools/app-icons.js → 輸出到 src/assets/icons/（build 會複製到 public/icons/）
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = fs.readFileSync(path.join(root, 'src/ui/icon-data.js'), 'utf8');
const d = /"crossed-swords":"([^"]+)"/.exec(data)[1];
const out = path.join(root, 'src/assets/icons');
fs.mkdirSync(out, { recursive: true });

// scale = 雙劍佔畫面的比例；maskable 圖示四周會被系統裁成圓形，所以縮小到安全區內
const svg = (size, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#3a2f17"/><stop offset=".55" stop-color="#1a1d22"/><stop offset="1" stop-color="#12161d"/></radialGradient>
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" filter="url(#glow)"><path d="${d}" fill="#d0a44c"/></g>
</svg>`;
const list = [['apple-touch-icon.png', 180, 0.72], ['icon-192.png', 192, 0.72], ['icon-512.png', 512, 0.72], ['icon-maskable-512.png', 512, 0.56]];
const browser = await chromium.launch();
for (const [name, size, scale] of list) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg(size, scale)}</body></html>`);
  await page.screenshot({ path: path.join(out, name), omitBackground: false });
  await page.close();
  console.log('wrote', name);
}
await browser.close();
