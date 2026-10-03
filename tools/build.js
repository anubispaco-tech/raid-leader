// 把 src/core.js 內嵌進 src/template.html，產生單檔 index.html
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const t = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/core.js'), 'utf8');
fs.writeFileSync(path.join(root, 'index.html'), t.replace('/*CORE*/', core));
console.log('built index.html');
