#!/usr/bin/env node
/**
 * strip-emoji.mjs — 清掉段位頁的 emoji
 *
 * 三處：
 *   1. rank-badge 的 onerror fallback（'🥈'）—— 徽章圖都存在，這個永遠不會觸發，
 *      但留著等於埋一個會突然冒出 emoji 的地雷。改成空字串。
 *   2. 「血量扣法」標題前的 📊
 *   3. 「立即預約」按鈕的 📅
 *
 * 只動這三個已知位置，不做全域 emoji 掃描替換 ——
 * 盲目地把所有 emoji 抽掉可能誤傷曲名或委員暱稱裡的字元。
 *
 * 用法：
 *   node strip-emoji.mjs --dry
 *   node strip-emoji.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const EMOJI_RX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

const files = readdirSync('.').filter((n) => /^rank-.*\.html$/i.test(n)).sort();

const results = [];
let totalHits = 0;

for (const file of files) {
  let src = readFileSync(file, 'utf8');
  const orig = src;
  const hits = [];

  // 1. onerror fallback：整個屬性拿掉，圖載不出來就顯示 alt
  const onerrRx = /\s*onerror="this\.parentElement\.innerHTML='[^']*'"/g;
  if (onerrRx.test(src)) {
    src = src.replace(onerrRx, '');
    hits.push('badge onerror');
  }

  // 2 & 3. 標題與按鈕文字前的 emoji
  src = src.replace(/(<h3[^>]*>)([\s\S]{0,40}?)血量扣法/, (m, tag, mid) => {
    if (EMOJI_RX.test(mid)) { hits.push('血量扣法'); return `${tag}\n              血量扣法`; }
    return m;
  });

  src = src.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]\s*(立即預約)/gu, (m, txt) => {
    hits.push('立即預約'); return txt;
  });

  const left = [...src.matchAll(EMOJI_RX)].map((m) => m[0]);
  results.push([file, hits, left, src]);
  totalHits += hits.length;
  if (src === orig) results[results.length - 1][1] = [];
}

console.log('');
console.log('| 檔案 | 處理 | 殘留 |');
for (const [f, hits, left] of results) {
  console.log(`  ${f.padEnd(28)} ${(hits.join(', ') || '(無)').padEnd(34)} ${left.length ? left.join(' ') : '-'}`);
}

const stillLeft = results.filter(([, , left]) => left.length);
console.log('');
console.log(`共處理 ${totalHits} 處；${stillLeft.length} 支仍有殘留`);

if (DRY) { console.log(''); console.log('[dry run] 未寫檔'); process.exit(0); }

const changed = results.filter(([, hits]) => hits.length);
if (!changed.length) { console.log('沒有需要修改的檔案。'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bdir = join('_backup', stamp);
mkdirSync(bdir, { recursive: true });
for (const [f, , , src] of changed) {
  copyFileSync(f, join(bdir, f));
  writeFileSync(f, src, 'utf8');
}
console.log('');
console.log(`已寫入 ${changed.length} 支（備份於 _backup/${stamp}/）`);
