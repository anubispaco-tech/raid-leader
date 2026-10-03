// 數值模擬：node tools/sim.js [次數] [--no-talents] [--horn]
// 平衡基準 = 套用推薦天賦、不使用英勇號角（號角是額外優勢）
import { average, fmtAvg } from './sim-lib.js';
const n = +(process.argv.slice(2).find(a => /^\d+$/.test(a))) || 5;
const r = average(n, { talents: !process.argv.includes('--no-talents'), horn: process.argv.includes('--horn') });
console.log(r.sample.log.join('\n'));
console.log(fmtAvg(r));
