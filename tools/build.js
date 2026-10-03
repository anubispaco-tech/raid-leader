// 產生兩個版本：
//   index.html             → GitHub Pages 用，直接載入 src/ 的模組（不需建置）
//   dist/raid-leader.html  → 單檔版（JS、CSS 全部內嵌），給 Claude 預覽頁或離線分享
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const head = read('src/head.html').trim(), body = read('src/body.html').trim();
const pkg = JSON.parse(read('package.json'));

const pages = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
${head}
<link rel="stylesheet" href="src/styles.css">
</head>
<body>
${body}
<script type="module" src="src/ui/main.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), pages);

const js = (await esbuild.build({ entryPoints: [path.join(root, 'src/ui/main.js')], bundle: true, format: 'iife', write: false,
  target: 'es2020', banner: { js: `/* 副本團長 v${pkg.version} */` } })).outputFiles[0].text;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/raid-leader.html'),
  `${head}\n<style>\n${read('src/styles.css')}</style>\n${body}\n<script>\n${js}</script>\n`);
console.log(`built index.html + dist/raid-leader.html (v${pkg.version})`);
