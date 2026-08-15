#!/usr/bin/env node
/**
 * wire-reserve.mjs — 接上預約按鈕 + 清掉漏網的 emoji
 *
 * 兩件事：
 *   1. 「立即預約」按鈕加 data-reserve，rank-page.js 靠這個屬性接管點擊
 *   2. 清掉「血量扣法」標題前的 emoji —— 上一支 script 的比對範圍太窄，
 *      縮排較長的檔案沒對到，15 支殘留
 *
 * 只動這兩處已知位置。不做全域 emoji 掃描替換：
 * rank-challenge.html 的 🔓 和 main.js 的委員 emoji 是設計的一部分，
 * 要不要拿掉是另一個決定。
 *
 * 用法：
 *   node wire-reserve.mjs --dry
 *   node wire-reserve.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const EMOJI_RX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/gu;

const files = readdirSync('.')
  .filter((n) => /^rank-.*\.html$/i.test(n) && n !== 'rank-challenge.html')
  .sort();

const rows = [];
const changed = [];

for (const file of files) {
  let src = readFileSync(file, 'utf8');
  const orig = src;
  const steps = [];

  // ---- 1. 預約按鈕 ----
  // 按鈕是 <a href="booking.html" target="_blank" style="...多行...">，
  // 開標籤和文字隔了一大段 style，所以直接用 href 定位而不是從文字往前找。
  // booking.html 本來就不存在（斷鏈），改成 role="button" 由 JS 接管。
  if (/data-reserve/.test(src)) {
    steps.push('已有 data-reserve');
  } else {
    const rx = /<a\s+href="booking\.html"[^>]*?>/;
    const m = src.match(rx);
    if (!m) {
      steps.push('找不到預約按鈕');
    } else {
      const tag = m[0]
        .replace(/\s+href="booking\.html"/, ' href="#"')
        .replace(/\s+target="_blank"/, '')
        .replace(/>$/, ' data-reserve role="button">');
      src = src.replace(rx, tag);
      steps.push('data-reserve');
    }
  }

  // ---- 2. 血量扣法的 emoji ----
  // 「血量扣法」第一次出現是在 <!-- 血量扣法說明 --> 註解裡，
  // 帶 emoji 的是後面的 <h3>。所以直接對 h3 的內容做替換。
  const h3Rx = /(<h3\b[^>]*>)([\s\S]*?)(<\/h3>)/g;
  let cleanedAny = false;
  src = src.replace(h3Rx, (m, open, inner, close) => {
    if (!EMOJI_RX.test(inner)) return m;
    cleanedAny = true;
    return open + inner.replace(EMOJI_RX, '').replace(/^[ \t]+/gm, (w) => w) + close;
  });
  if (cleanedAny) steps.push('清 emoji');

  // ---- 3. 按鈕文字裡的 emoji ----
  const before3 = src;
  src = src.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]\s*(?=立即預約)/gu, '');
  if (src !== before3 && !steps.includes('清 emoji')) steps.push('清 emoji');

  const left = [...src.matchAll(EMOJI_RX)].map((m) => m[0]);
  rows.push([file, steps.join(', ') || '(無變更)', left]);
  if (src !== orig) changed.push([file, src]);
}

console.log('');
for (const [f, steps, left] of rows) {
  console.log(`  ${f.padEnd(28)} ${steps.padEnd(28)} ${left.length ? '殘留 ' + left.join(' ') : ''}`);
}
console.log('');
console.log(`${changed.length} 支有變更`);

if (DRY) { console.log('[dry run] 未寫檔'); process.exit(0); }
if (!changed.length) { console.log('沒有需要修改的檔案。'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bdir = join('_backup', stamp);
mkdirSync(bdir, { recursive: true });
for (const [f, src] of changed) {
  copyFileSync(f, join(bdir, f));
  writeFileSync(f, src, 'utf8');
}
console.log(`已寫入（備份於 _backup/${stamp}/）`);
