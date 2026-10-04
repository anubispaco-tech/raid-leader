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
const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com", "img-src 'self' data:", "connect-src https://script.google.com https://script.googleusercontent.com",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');
fs.writeFileSync(path.join(root, 'src/core/version.js'), `// 由 tools/build.js 依 package.json 產生，請勿手動修改\nexport const VERSION = '${v}';\n`);
const script = dev ? '<script type="module" src="src/ui/main.js"></script>' : `<script src="dist/app.js?v=${v}"></script>`;
const pages = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
${dev ? '' : `<meta http-equiv="Content-Security-Policy" content="${CSP}">`}
<meta name="referrer" content="no-referrer">
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
console.log(`built index.html + dist/raid-leader.html (v${pkg.version})`);
