// v0.21.1 測試：來源追蹤（?src ?ref first-touch）、分享連結、內建瀏覽器提示、主畫面模式、開始畫面登入、綁定提示、manifest、事件排隊
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { playthrough } from './sim-lib.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
const fails = [], check = (ok, msg) => { console.log((ok ? '✅ ' : '❌ ') + msg); if (!ok) fails.push(msg); };
const KEY = 'raid-leader-save-v1';
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  igIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; zh_TW)',
  igAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0.0 Android',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.0.0',
};
// 已有存檔（通關到第 3 層、沒有來源欄位）
const { s: base } = playthrough({ talents: true, stopAt: 3 });
base.lastSeen = Date.now(); base.idle = null; base.player = { pid: 'oldplayer001', name: '老玩家', asked: true, playSec: 600 };
base.story = base.story || { seen: [] }; for (let i = 0; i < 14; i++) base.story.seen.push('pre' + i, 'post' + i);

const browser = await chromium.launch();
async function open({ url = '/', ua = UA.iphone, seed = null, standalone = false, noShare = true }) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const posts = [];
  await page.addInitScript(([v, sa, ns]) => {
    if (v && !sessionStorage.getItem('seeded')) { localStorage.setItem('raid-leader-save-v1', v); sessionStorage.setItem('seeded', '1'); }
    if (sa) { const mm = window.matchMedia.bind(window); window.matchMedia = q => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); }
    if (ns) { try { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }); } catch (e) { /* ignore */ } }
  }, [seed ? JSON.stringify(seed) : null, standalone, noShare]);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.host === 'script.google.com') {
      if (r.request().method() === 'POST') { try { posts.push({ t: Date.now(), ...JSON.parse(r.request().postData()) }); } catch (e) { /* ignore */ } }
      return r.fulfill({ body: JSON.stringify({ ok: true, list: [], items: [] }), contentType: 'application/json' });
    }
    if (u.host !== 'app.test') return r.abort();
    const f = path.join(root, 'public', u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] || 'application/octet-stream' });
  });
  await page.goto('https://app.test' + url); await page.waitForTimeout(1500);
  const save = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  return { ctx, page, posts, errs, save };
}
const skipIntro = async page => {
  for (let i = 0; i < 40 && await page.locator('[data-act="dlgskip"]').count(); i++) { await page.click('[data-act="dlgskip"]'); await page.waitForTimeout(300); }
  if (await page.locator('[data-act="skipnick"]').count()) { await page.click('[data-act="skipnick"]'); await page.waitForTimeout(300); }
};

// 1. 新玩家從 IG 限動連結進來（含推薦人）：網址參數被拿掉、存檔記下來源
{
  const { ctx, page, posts, errs, save } = await open({ url: '/?src=ig_story&ref=abcdefgh9999' });
  check(!(await page.evaluate(() => location.search)), '網址上的 ?src ?ref 讀完就拿掉');
  check(await page.locator('[data-act="titlelogin"]').count() === 1, '開始畫面有「已有進度？用 Google 登入接續」');
  await page.click('[data-act="titlego"]'); await page.waitForTimeout(600); await skipIntro(page);
  const s = await save();
  check(s.player.src === 'ig_story' && s.player.ref === 'abcdefgh9999', `存檔記下來源與推薦人（${s.player.src} / ${s.player.ref}）`);
  await page.waitForTimeout(3000);
  const ev = posts.filter(p => p.type === 'event' && p.kind === '來源');
  check(ev.length === 1 && ev[0].detail === 'ig_story ref:abcdefgh9999', '送出一次「來源」事件');
  const snap = posts.find(p => p.type === 'snapshot');
  check(snap && snap.src === 'ig_story' && snap.ref === 'abcdefgh9999' && snap.pwa === 0, 'snapshot 帶 src／ref／pwa');
  const evs = posts.filter(p => p.type === 'event').map(p => p.t);
  check(evs.every((t, i) => i === 0 || t - evs[i - 1] >= 2000), `事件間隔 ≥ 2 秒（${evs.length} 筆）`);
  // 再開一次帶別的來源：不覆蓋（first-touch）
  await page.goto('https://app.test/?src=threads'); await page.waitForTimeout(1500);
  check((await save()).player.src === 'ig_story', '已有存檔再點別的連結不覆蓋來源');
  check(!errs.length, '沒有錯誤' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}
// 2. 開始畫面登入：登入視窗有 Google 按鈕位置，「先不用」後照常播序章
{
  const { ctx, page } = await open({ url: '/?src=line' });
  await page.click('[data-act="titlelogin"]'); await page.waitForTimeout(600);
  check(await page.locator('#gsiBtn').count() === 1 && await page.locator('[data-act="loginskip"]').count() === 1, '開始畫面登入 → 登入視窗');
  await page.click('[data-act="loginskip"]'); await page.waitForTimeout(500);
  check(await page.locator('[data-act="dlgnext"]').count() >= 1, '先不用 → 照常播放序章');
  await ctx.close();
}
// 3. 舊存檔：來源記 old；設定頁有邀請朋友與加到主畫面；分享連結帶自己的玩家 ID
{
  const { ctx, page, save } = await open({ seed: base });
  if (await page.locator('[data-act="titlego"]').count()) { await page.click('[data-act="titlego"]'); await page.waitForTimeout(800); }
  check((await save()).player.src === 'old', 'v0.21.1 以前的存檔來源記為 old');
  // 綁定提示：已通關第 2 層、沒登入 → 5 秒內跳一次
  await page.waitForTimeout(6500);
  const bind = await page.locator('.sheet h3').first().textContent().catch(() => '');
  check(/綁定 Google/.test(bind || ''), '已通關第 2 層的未登入玩家跳出綁定提示');
  await page.click('[data-act="loginskip"]'); await page.waitForTimeout(300);
  check((await save()).player.bindAsked === 1, '綁定提示只問一次（記在存檔）');
  await page.click('.brand'); await page.waitForTimeout(500);
  check(await page.locator('.a2hs .a2hs-s').count() === 3, '設定頁「加到主畫面」顯示 iPhone 3 步');
  await page.click('.sheet [data-act="share"]'); await page.waitForTimeout(500);
  const txt = await page.locator('#shareTxt').inputValue();
  check(txt.includes('https://raid-leader.anubispaco.workers.dev/?src=share&ref=oldplayer001'), '分享連結帶 src=share 與自己的玩家 ID');
  await page.click('[data-act="closebtn"]'); await page.waitForTimeout(300);
  check(await page.locator('.invite [data-act="share"]').count() === 1, '天梯下方有邀請朋友按鈕');
  await page.reload(); await page.waitForTimeout(8000);
  check(!(await page.locator('.sheet h3').count()) || !/綁定 Google/.test(await page.locator('.sheet h3').first().textContent()), '重新整理後不再跳綁定提示');
  await page.screenshot({ path: '/tmp/v0211-home.png' });
  await ctx.close();
}
// 4. IG 內建瀏覽器（iPhone）：提示條、教學、沒有登入入口
{
  const { ctx, page, posts } = await open({ url: '/?src=ig_story', ua: UA.igIos });
  check(await page.locator('[data-act="titlelogin"]').count() === 0, '內建瀏覽器不顯示登入入口（Google 會擋）');
  await page.click('[data-act="titlego"]'); await page.waitForTimeout(600); await skipIntro(page);
  check(await page.locator('#inappBar:not([hidden])').count() === 1, 'IG 內建瀏覽器顯示提示條');
  check(/⋯/.test(await page.locator('#inappBar').textContent()), 'iPhone 版提示「右上角 ⋯ → 在外部瀏覽器開啟」');
  await page.screenshot({ path: '/tmp/v0211-inapp.png' });
  await page.waitForTimeout(2500);
  check(posts.some(p => p.kind === '內建瀏覽器' && p.detail === 'Instagram:ios'), '送出「內建瀏覽器」事件');
  await page.click('[data-act="inappclose"]'); await page.waitForTimeout(200);
  check(await page.locator('#inappBar[hidden]').count() === 1, '提示條可關閉');
  await ctx.close();
}
// 5. Android IG：用 Chrome 開啟（intent，保留來源）；LINE：openExternalBrowser=1
{
  const { ctx, page } = await open({ url: '/?src=ig_bio', ua: UA.igAndroid });
  await page.click('[data-act="titlego"]'); await page.waitForTimeout(600); await skipIntro(page);
  const href = await page.locator('#inappBar a').getAttribute('href');
  check(/^intent:\/\/raid-leader\.anubispaco\.workers\.dev\/\?src=ig_bio#Intent;scheme=https;package=com\.android\.chrome;end$/.test(href || ''), 'Android IG：用 Chrome 開啟並帶上來源');
  await ctx.close();
  const l = await open({ url: '/?src=line', ua: UA.line });
  await l.page.click('[data-act="titlego"]'); await l.page.waitForTimeout(600); await skipIntro(l.page);
  check((await l.page.locator('#inappBar a').getAttribute('href') || '').endsWith('?src=line&openExternalBrowser=1'), 'LINE：openExternalBrowser=1');
  await l.ctx.close();
}
// 6. iPhone 從主畫面第一次開（新存檔）：先問要不要登入；設定頁顯示已從主畫面開啟
{
  const { ctx, page, save } = await open({ standalone: true });
  await page.click('[data-act="titlego"]'); await page.waitForTimeout(600);
  check(/從主畫面開啟/.test(await page.locator('.sheet h3').first().textContent()), '主畫面新存檔 → 先問 Google 登入');
  await page.click('[data-act="loginskip"]'); await page.waitForTimeout(400); await skipIntro(page);
  const s = await save();
  check(s.player.pwa === 1 && s.player.src === 'direct', `記下主畫面模式、來源 direct（${s.player.src}）`);
  await page.click('.brand'); await page.waitForTimeout(500);
  check(/已從主畫面開啟/.test(await page.locator('.sheet').textContent()), '設定頁顯示「已從主畫面開啟」');
  await ctx.close();
}
// 7. 部署檔案：manifest 與圖示
{
  const pub = f => path.join(root, 'public', f);
  const m = JSON.parse(fs.readFileSync(pub('manifest.json'), 'utf8'));
  check(m.display === 'standalone' && m.icons.every(i => fs.existsSync(pub(i.src))), 'manifest.json 與圖示都在 public/');
  const html = fs.readFileSync(pub('index.html'), 'utf8');
  check(html.includes('rel="manifest"') && html.includes('apple-touch-icon') && fs.existsSync(pub('icons/apple-touch-icon.png')), 'index.html 有 manifest 與 apple-touch-icon');
  check(!fs.readFileSync(path.join(root, 'dist/raid-leader.html'), 'utf8').includes('rel="manifest"'), '單檔預覽不帶 manifest');
}
await browser.close();
console.log(fails.length ? `\n❌ ${fails.length} 項失敗` : '\n全部通過');
process.exit(fails.length ? 1 : 0);
