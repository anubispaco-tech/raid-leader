// 產生 src/ui/icon-data.js：從 @iconify-json/game-icons（game-icons.net，CC BY 3.0）只取遊戲用到的圖示
//   node tools/icons-build.js      （改了 src/ui/icons.js 的對照表後重跑）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const set = require('@iconify-json/game-icons/icons.json');
// v0.24 團長天賦樹與主動技能的圖示寫在 core 資料裡（icon: '…'），一起掃
const src = ['src/ui/icons.js', 'src/core/leader.js', 'src/core/actives.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const names = [...new Set([...src.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)*)'/g)].map(m => m[1]))].filter(n => set.icons[n]).sort();
const out = {};
for (const n of names) {
  const d = [...set.icons[n].body.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
  if (!d.length) throw new Error('沒有路徑：' + n);
  out[n] = d.join(' ');
}
fs.writeFileSync(path.join(root, 'src/ui/icon-data.js'),
  '// 由 tools/icons-build.js 產生，請勿手動修改。圖示來源：game-icons.net（CC BY 3.0，作者見 https://game-icons.net）\nexport default ' + JSON.stringify(out) + ';\n');
console.log(`icon-data.js：${names.length} 個圖示，${Math.round(JSON.stringify(out).length / 1024)} KB`);
