#!/usr/bin/env node
/**
 * wire-challenge.mjs — rank-challenge.html 的三處改動
 *
 *   1. 單一「查看排行榜」按鈕 -> 左右兩個按鈕（排行榜 / 挑戰動態）
 *   2. .leaderboard-button::before 的 emoji 拿掉
 *   3. 掛上 challenge-status.js（把寫死的「初心者」換成實際最高段位）
 *
 * 兩個按鈕用 flex 並排，沿用原本的金色外框樣式；
 * 「挑戰動態」用較低調的白色系，讓排行榜維持主要動作的地位。
 *
 * 用法：
 *   node wire-challenge.mjs --dry
 *   node wire-challenge.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'rank-challenge.html';
const DRY = process.argv.includes('--dry');

if (!existsSync(FILE)) { console.error(`找不到 ${FILE}`); process.exit(1); }

let src = readFileSync(FILE, 'utf8');
const orig = src;
const done = [];
const failed = [];

// ---- 1. 按鈕列 ----
const btnRx = /<a href="leaderboard\.html" class="leaderboard-button">[\s\S]*?<\/a>/;
if (/challenge-actions/.test(src)) {
  done.push('按鈕列（已存在）');
} else if (btnRx.test(src)) {
  src = src.replace(btnRx,
    '<div class="challenge-actions">\n' +
    '          <a href="leaderboard.html" class="leaderboard-button">排行榜</a>\n' +
    '          <a href="activity.html" class="leaderboard-button secondary">挑戰動態</a>\n' +
    '        </div>');
  done.push('按鈕列');
} else {
  failed.push('找不到排行榜按鈕');
}

// ---- 2. 樣式：並排 + 次要按鈕 + 移除 emoji ----
if (/\.challenge-actions\s*\{/.test(src)) {
  done.push('樣式（已存在）');
} else {
  // 原本的 ::before 只放了一個 emoji，整條規則移除
  const beforeRx = /\s*\.leaderboard-button::before\s*\{[\s\S]*?\}/;
  if (beforeRx.test(src)) {
    src = src.replace(beforeRx, '');
    done.push('移除 emoji 規則');
  }

  const extra = `
  .challenge-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  /* 兩個按鈕並排後單顆變窄，padding 跟著收斂 */
  .challenge-actions .leaderboard-button {
    padding: 14px 28px;
    font-size: 16px;
  }

  /* 次要動作：同樣的形狀，低一階的視覺重量 */
  .leaderboard-button.secondary {
    background: rgba(255, 255, 255, 0.06);
    color: #e9e9f0;
    border-color: rgba(255, 255, 255, 0.35);
  }

  .leaderboard-button.secondary:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #ffffff;
    box-shadow: 0 0 24px rgba(255, 255, 255, 0.18);
  }
`;

  const anchor = /(\.leaderboard-button:hover\s*\{[\s\S]*?\})/;
  if (anchor.test(src)) {
    src = src.replace(anchor, `$1\n${extra}`);
    done.push('樣式');
  } else {
    failed.push('找不到 .leaderboard-button:hover 作為插入點');
  }
}

// ---- 3. 掛 challenge-status.js ----
if (/challenge-status\.js/.test(src)) {
  done.push('challenge-status.js（已掛載）');
} else if (/<\/body>/i.test(src)) {
  src = src.replace(/<\/body>/i, '  <script src="challenge-status.js" defer></script>\n</body>');
  done.push('challenge-status.js');
} else {
  failed.push('找不到 </body>');
}

// ---- 報告 ----
console.log('');
done.forEach((d) => console.log(`  [OK] ${d}`));
failed.forEach((f) => console.log(`  [!!] ${f}`));

const EMOJI_RX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/gu;
const left = [...src.matchAll(EMOJI_RX)].map((m) => m[0]);
console.log('');
console.log(left.length ? `殘留 emoji：${[...new Set(left)].join(' ')}（其他位置，本次未處理）` : '無殘留 emoji');

if (src === orig) { console.log(''); console.log('沒有變更。'); process.exit(failed.length ? 1 : 0); }

console.log('');
if (DRY) { console.log(`[dry run] 未寫檔（${orig.length} -> ${src.length} 字元）`); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bdir = join('_backup', stamp);
mkdirSync(bdir, { recursive: true });
copyFileSync(FILE, join(bdir, FILE));
writeFileSync(FILE, src, 'utf8');
console.log(`已寫入 ${FILE}（備份於 _backup/${stamp}/）`);
