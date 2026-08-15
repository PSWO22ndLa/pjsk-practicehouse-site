#!/usr/bin/env node
/**
 * rewire-rank-pages.mjs v2 — 把 29 支段位頁改成讀 data/rank-songs.json
 *
 * v1 的兩個 bug：
 *   - 替換 rule-value 時漏掉閉合的 '>'，產生壞掉的 HTML
 *   - 血量扣法區塊用 /<\/div>\s*<\/div>\s*<\/div>/ 抓結尾，巢狀對不上
 * v2 改用括號配對找對應的 </div>，不依賴閉合標籤剛好連續出現。
 *
 * 每支頁面做四件事：
 *   1. <body> 加 data-tier="<段位id>"
 *   2. 曲目數量 / 血量 的 .rule-value 加 data-rule 掛載點
 *   3. 血量扣法的 grid 內容清空，改標記 data-rule="damage"
 *      並在其外層容器後插入 data-rule="special" 容器
 *   4. inline <script> 換成 <script src="rank-page.js" defer>
 *
 * 任何一步比對不到就整支跳過並記錄 —— 半套的頁面比沒改更難除錯。
 * 已經改過的檔案會被偵測並跳過，重複執行不會出事。
 *
 * 用法：
 *   node rewire-rank-pages.mjs --dry
 *   node rewire-rank-pages.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const CONFIG = 'data/rank-songs.json';

if (!existsSync(CONFIG)) { console.error(`找不到 ${CONFIG}`); process.exit(1); }
if (!existsSync('rank-page.js')) { console.error('找不到 rank-page.js'); process.exit(1); }

const doc = JSON.parse(readFileSync(CONFIG, 'utf8'));
const pageToTier = new Map();
for (const [id, t] of Object.entries(doc.tiers)) if (t.page) pageToTier.set(t.page, id);

/**
 * 從 openIdx（一個 <div 的位置）往後找對應的 </div>。
 * 回傳 { inner: [起, 迄], outer: [起, 迄] }，迄為 exclusive。
 * 這裡不需要完整 HTML parser —— 只要正確配對 div 的開閉即可，
 * 而段位頁的這幾個區塊裡沒有自閉合 div 或註解幹擾。
 */
function matchDiv(src, openIdx) {
  const gt = src.indexOf('>', openIdx);
  if (gt === -1) return null;
  const innerStart = gt + 1;
  const rx = /<div\b|<\/div>/gi;
  rx.lastIndex = innerStart;
  let depth = 1;
  let m;
  while ((m = rx.exec(src))) {
    if (m[0].toLowerCase() === '</div>') {
      depth--;
      if (depth === 0) return { inner: [innerStart, m.index], outer: [openIdx, m.index + 6] };
    } else depth++;
  }
  return null;
}

const files = readdirSync('.')
  .filter((n) => /^rank-.*\.html$/i.test(n) && n !== 'rank-challenge.html')
  .sort();

const ok = [];
const skipped = [];

for (const file of files) {
  const tierId = pageToTier.get(file);
  if (!tierId) { skipped.push([file, '不在 rank-songs.json 的 tiers 裡']); continue; }

  let src = readFileSync(file, 'utf8');
  const orig = src;

  if (src.includes('data-rule=') || src.includes('rank-page.js')) {
    skipped.push([file, '已經改過，跳過']); continue;
  }

  const steps = [];

  // ---- 1. body data-tier ----
  if (!/<body(\s[^>]*)?>/i.test(src)) { skipped.push([file, '找不到 <body>']); continue; }
  src = src.replace(/<body(\s[^>]*)?>/i, (m, attrs) => `<body${attrs || ''} data-tier="${tierId}">`);
  steps.push('data-tier');

  // ---- 2. 曲目數量 / 血量 掛載點 ----
  // 注意保留原本的 '>'，v1 就是漏了它
  const countRx = /(<div class="rule-label">曲目數量<\/div>\s*<div class="rule-value)(">)/;
  if (!countRx.test(src)) { skipped.push([file, '找不到「曲目數量」']); continue; }
  src = src.replace(countRx, '$1" data-rule="songCount">');
  steps.push('songCount');

  const hpRx = /(<div class="rule-label">血量<\/div>\s*<div class="rule-value limit)(">)/;
  if (!hpRx.test(src)) { skipped.push([file, '找不到「血量」']); continue; }
  src = src.replace(hpRx, '$1" data-rule="hp">');
  steps.push('hp');

  // ---- 3. 血量扣法 ----
  const gridOpen = src.indexOf('<div style="display: grid; gap: 12px;">');
  if (gridOpen === -1) { skipped.push([file, '找不到扣血 grid']); continue; }
  const grid = matchDiv(src, gridOpen);
  if (!grid) { skipped.push([file, '扣血 grid 沒有對應的 </div>']); continue; }
  if (!/<!--\s*PERFECT\s*-->/.test(src.slice(grid.inner[0], grid.inner[1]))) {
    skipped.push([file, '扣血 grid 內容不符預期']); continue;
  }
  // 只清空內容、保留 grid 本身，外層巢狀完全不動
  src = src.slice(0, gridOpen)
    + '<div style="display: grid; gap: 12px;" data-rule="damage"></div>'
    + src.slice(grid.outer[1]);
  steps.push('damage');

  // ---- 3b. 特殊規則容器：插在「血量扣法」外層容器之後 ----
  const wrapOpen = src.indexOf('<div style="margin-top: 30px;">');
  if (wrapOpen !== -1) {
    const wrap = matchDiv(src, wrapOpen);
    if (wrap) {
      src = src.slice(0, wrap.outer[1])
        + '\n          <div class="rule-item" data-rule="special" style="display:none"></div>'
        + src.slice(wrap.outer[1]);
      steps.push('special');
    }
  }

  // ---- 4. inline script ----
  const scriptRx = /<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/i;
  const sm = src.match(scriptRx);
  if (!sm || !/const\s+songs\s*=/.test(sm[0])) {
    skipped.push([file, '找不到含 songs 的 inline script']); continue;
  }
  src = src.replace(scriptRx, '<script src="rank-page.js" defer></script>');
  steps.push('script');

  // ---- 健全性檢查：div 開閉數量應該相等 ----
  const opens = (src.match(/<div\b/gi) || []).length;
  const closes = (src.match(/<\/div>/gi) || []).length;
  if (opens !== closes) {
    skipped.push([file, `div 不平衡（${opens} 開 / ${closes} 閉），未修改`]); continue;
  }

  if (src === orig) { skipped.push([file, '沒有變更']); continue; }
  ok.push([file, tierId, steps.join(', '), src]);
}

console.log('');
console.log(`掃描 ${files.length} 支，可處理 ${ok.length} 支，略過 ${skipped.length} 支`);
console.log('');
for (const [f, tier, steps] of ok) console.log(`  [OK] ${f.padEnd(28)} ${tier.padEnd(20)} ${steps}`);
if (skipped.length) {
  console.log('');
  for (const [f, why] of skipped) console.log(`  [--] ${f.padEnd(28)} ${why}`);
}

console.log('');
if (DRY) { console.log('[dry run] 未寫檔'); process.exit(0); }
if (!ok.length) { console.log('沒有可處理的檔案。'); process.exit(1); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bdir = join('_backup', stamp);
mkdirSync(bdir, { recursive: true });
for (const [f, , , src] of ok) {
  copyFileSync(f, join(bdir, f));
  writeFileSync(f, src, 'utf8');
}
console.log(`已寫入 ${ok.length} 支（備份於 _backup/${stamp}/）`);
