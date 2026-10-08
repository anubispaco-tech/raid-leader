// 產生兩個版本：
//   index.html             → GitHub Pages 用，載入 dist/app.js 與 src/styles.css（加版本號避免快取混用新舊檔）
//   dist/raid-leader.html  → 單檔版（JS、CSS 全部內嵌），給 Claude 預覽頁或離線分享
// 開發時想直接載入 src/ 模組：node tools/build.js --dev
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const head = read('src/head.html').trim(), body = read('src/body.html').trim();
const pkg = JSON.parse(read('package.json'));

const dev = process.argv.includes('--dev'), v = pkg.version;
// 內容安全政策：只執行自己網站的腳本（擋掉被注入的 inline script），資料只能送到 GAS
// v0.13：Google 登入（accounts.google.com/gsi）
const CSP = ["default-src 'self'", "script-src 'self' https://accounts.google.com/gsi/client", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src https://fonts.gstatic.com", "img-src 'self' data: https://*.googleusercontent.com", "frame-src https://accounts.google.com/gsi/",
  "connect-src https://script.google.com https://script.googleusercontent.com https://accounts.google.com/gsi/",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');
// v0.21.1 加到主畫面：manifest＋圖示（只放在網站版；單檔預覽不需要）
const APP_META = `<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<meta name="theme-color" content="#12161d">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="副本團長">`;
const MANIFEST = { name: 'RAID LEADER 副本團長', short_name: '副本團長', lang: 'zh-Hant', start_url: '/', scope: '/', display: 'standalone',
  orientation: 'portrait', background_color: '#12161d', theme_color: '#12161d', description: '放置型團本經理 RPG：招募坦、補、輸出，攻下每一座副本。',
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
fs.writeFileSync(path.join(root, 'src/core/version.js'), `// 由 tools/build.js 依 package.json 產生，請勿手動修改\nexport const VERSION = '${v}';\n`);
const script = dev ? '<script type="module" src="src/ui/main.js"></script>' : `<script src="dist/app.js?v=${v}"></script>`;
const pages = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
${dev ? '' : `<meta http-equiv="Content-Security-Policy" content="${CSP}">`}
<meta name="referrer" content="no-referrer">
${dev ? '' : APP_META}
${head}
<link rel="stylesheet" href="src/styles.css?v=${v}">
</head>
<body>
${body}
${script}
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), pages);

const js = (await esbuild.build({ entryPoints: [path.join(root, 'src/ui/main.js')], bundle: true, format: 'iife', write: false,
  target: 'es2020', banner: { js: `/* 副本團長 v${pkg.version} */` } })).outputFiles[0].text;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/app.js'), js);
fs.writeFileSync(path.join(root, 'dist/raid-leader.html'),
  `${head}\n<style>\n${read('src/styles.css')}</style>\n${body}\n<script>\n${js}</script>\n`);
// Cloudflare 部署目錄：只放遊戲本體（index.html、dist/app.js、src/styles.css），repo 其他檔案（gas、tools…）不會被公開
const pub = path.join(root, 'public');
fs.rmSync(pub, { recursive: true, force: true });
for (const f of ['index.html', 'dist/app.js', 'src/styles.css']) {
  fs.mkdirSync(path.dirname(path.join(pub, f)), { recursive: true });
  fs.copyFileSync(path.join(root, f), path.join(pub, f));
}
fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'src/assets/icons'))) fs.copyFileSync(path.join(root, 'src/assets/icons', f), path.join(pub, 'icons', f));
fs.writeFileSync(path.join(pub, 'manifest.json'), JSON.stringify(MANIFEST, null, 2) + '\n');
console.log(`built index.html + dist/raid-leader.html + public/ (v${pkg.version})`);
