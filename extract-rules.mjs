#!/usr/bin/env node
/**
 * extract-rules.mjs — 把段位規則從 HTML 抽進 data/rank-songs.json
 *
 * 抽三類：
 *   曲目數量 / 血量   .rule-label + .rule-value 配對
 *   扣血值            <!-- PERFECT --> 區塊裡最右邊的 -N
 *
 * 進度條的 width:N% 不抽 —— 它跟扣血值不同步（BAD 和 MISS 都是 30% 但值是 3 和 3），
 * 純視覺呈現，之後改由扣血值自動算，不再當成資料維護。
 *
 * 唯讀掃描 HTML，只寫 data/rank-songs.json 的 rules 欄位，不動其他部分。
 *
 * 用法：
 *   node extract-rules.mjs --dry
 *   node extract-rules.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FILE = 'data/rank-songs.json';
const DRY = process.argv.includes('--dry');
const JUDGES = ['PERFECT', 'GREAT', 'GOOD', 'BAD', 'MISS'];

if (!existsSync(FILE)) {
  console.error(`找不到 ${FILE}，請先跑 extract-songs.mjs`);
  process.exit(1);
}

const doc = JSON.parse(readFileSync(FILE, 'utf8'));

/** 從 <!-- JUDGE --> 之後的區塊取最右邊那格的 -N */
function damageFor(src, judge) {
  const marker = new RegExp(`<!--\\s*${judge}\\s*-->`, 'i');
  const m = src.match(marker);
  if (!m) return null;
  // 區塊長度有限，往後看 1200 字元足夠涵蓋一組
  const chunk = src.slice(m.index, m.index + 1200);
  // 該格特徵：text-align: right 的 div，內容是 -數字
  const hit = chunk.match(/text-align:\s*right[^>]*>\s*-?(\d+)\s*</i);
  if (hit) return Number(hit[1]);
  // 退路：區塊內最後一個 >-N<
  const all = [...chunk.matchAll(/>\s*-(\d+)\s*</g)];
  return all.length ? Number(all[all.length - 1][1]) : null;
}

/** .rule-label / .rule-value 配對，回傳 { 標籤: 值字串 } */
function rulePairs(src) {
  const out = {};
  const rx = /<div class=["']rule-label["']>([\s\S]*?)<\/div>\s*<div class=["']rule-value[^"']*["']>([\s\S]*?)<\/div>/gi;
  for (const m of src.matchAll(rx)) out[m[1].trim()] = m[2].trim();
  return out;
}

const num = (s) => {
  if (s == null) return null;
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : null;
};

const report = [];
let missing = 0;

for (const [id, tier] of Object.entries(doc.tiers)) {
  const page = tier.page;
  if (!page || !existsSync(page)) { report.push([id, '(頁面不存在)', '', '']); missing++; continue; }
  const src = readFileSync(page, 'utf8');

  const pairs = rulePairs(src);
  const hp = num(pairs['血量']);
  const declared = num(pairs['曲目數量']);

  const damage = {};
  const lost = [];
  for (const j of JUDGES) {
    const v = damageFor(src, j);
    if (v == null) lost.push(j);
    damage[j.toLowerCase()] = v;
  }
  if (lost.length) missing++;

  // songCount 不存 —— 它等於 songs.length，存兩份必然會不一致
  tier.rules = {
    hp,
    damage,
    special: tier.rules?.special ?? '',
  };

  const actual = (tier.songs || []).length;
  const mismatch = declared != null && declared !== actual ? `⚠️ 頁面寫 ${declared} 首、實際 ${actual} 首` : '';
  report.push([
    id,
    hp == null ? '⚠️ 無' : String(hp),
    JUDGES.map((j) => damage[j.toLowerCase()] ?? '?').join('/'),
    [mismatch, lost.length ? `缺 ${lost.join(',')}` : ''].filter(Boolean).join(' '),
  ]);
}

console.log('');
console.log('tier                   血量  P/G/GD/B/M   備註');
console.log('---------------------- ----  -----------  ----');
for (const [id, hp, dmg, note] of report) {
  console.log(`${id.padEnd(22)} ${String(hp).padStart(4)}  ${dmg.padEnd(11)}  ${note}`);
}

// 扣血組合分佈：判斷是不是真的各段位不同
const combos = new Map();
for (const t of Object.values(doc.tiers)) {
  const k = JUDGES.map((j) => t.rules?.damage?.[j.toLowerCase()] ?? '?').join('/');
  combos.set(k, (combos.get(k) || 0) + 1);
}
console.log('');
console.log('扣血組合分佈：');
for (const [k, n] of [...combos].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)} 個段位  ${k}`);

const hps = new Map();
for (const t of Object.values(doc.tiers)) {
  const k = String(t.rules?.hp ?? '?');
  hps.set(k, (hps.get(k) || 0) + 1);
}
console.log('');
console.log('血量分佈：');
for (const [k, n] of [...hps].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)} 個段位  ${k}`);

console.log('');
if (DRY) {
  console.log('[dry run] 未寫檔');
} else {
  doc.updatedAt = new Date().toISOString();
  doc.updatedBy = 'extract-rules.mjs';
  writeFileSync(FILE, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`已寫入 ${FILE}`);
}
if (missing) console.log(`⚠️ ${missing} 個段位有欄位抽不到，見上表備註`);
