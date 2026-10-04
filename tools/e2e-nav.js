// e2e 共用：副本頁切到指定分類（v0.9.0 起副本頁分成 主線／秘境／寶庫／活動，主線再分章節）
// k：'story0' = 主線第一章、'story1' = 主線第二章、'mythic'、'vault'
export async function nav(page, k) {
  const mode = k.startsWith('story') ? 'story' : k;
  await page.click(`[data-act="mode"][data-v="${mode}"]`, { timeout: 2000 }).catch(() => {});
  if (k.startsWith('story')) await page.click(`[data-act="chapter"][data-v="${k.slice(5)}"]`, { timeout: 1000 }).catch(() => {});
}
