#!/usr/bin/env node
/**
 * order-tiers.mjs — 給段位配置加上正確的排序
 *
 * 順序基準取自 La bot 的 rankRoles 常數（index.js），
 * 那是這個社群實際在用的段位晉級順序：
 *   青銅 白銀 黃金 白金 鑽石 大師 巔峰 亞神 神 天啟 創神 無限
 *
 * 同一階段內：解鎖任務排最前，接著 I / II / III。
 *
 * order 寫進 JSON 而不是只在前端排序，是為了讓順序成為資料的一部分 ——
 * API 讀寫、之後產生頁面、bot 端要用，看到的都是同一個順序。
 *
 * 用法：
 *   node order-tiers.mjs --dry
 *   node order-tiers.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FILE = 'data/rank-songs.json';
const DRY = process.argv.includes('--dry');

// 檔名前綴 -> 階段序。tierId 形如 bronze / peak-unlock / demigod2
const FAMILY = [
  'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master',
  'peak', 'demigod', 'god', 'revelation', 'godmaker', 'infinity',
];

function parseTier(id) {
  // 先比對較長的名稱，避免 god 吃掉 godmaker
  const fam = [...FAMILY].sort((a, b) => b.length - a.length)
    .find((f) => id === f || id.startsWith(f + '-') || new RegExp(`^${f}\\d+$`).test(id));
  if (!fam) return null;

  const rest = id.slice(fam.length);
  // 解鎖任務排在該階段最前面，所以給 0
  if (/^-unlock$/.test(rest)) return { fam, sub: 0 };
  if (rest === '') return { fam, sub: 1 };
  const n = /^\d+$/.test(rest) ? Number(rest) : null;
  if (n != null) return { fam, sub: n };
  return { fam, sub: 99 };
}

if (!existsSync(FILE)) {
  console.error(`找不到 ${FILE}，請先跑 extract-songs.mjs`);
  process.exit(1);
}

const doc = JSON.parse(readFileSync(FILE, 'utf8'));
const ids = Object.keys(doc.tiers ?? {});
if (!ids.length) {
  console.error('tiers 是空的');
  process.exit(1);
}

const ranked = [];
const unknown = [];

for (const id of ids) {
  const p = parseTier(id);
  if (!p) { unknown.push(id); continue; }
  ranked.push({ id, famIdx: FAMILY.indexOf(p.fam), sub: p.sub, fam: p.fam });
}

ranked.sort((a, b) => (a.famIdx - b.famIdx) || (a.sub - b.sub) || a.id.localeCompare(b.id));

// 物件的字串 key 保留插入順序，所以重建順序後 JSON 本身也是對的
const tiers = {};
ranked.forEach((r, i) => {
  tiers[r.id] = { ...doc.tiers[r.id], order: i + 1 };
});
// 認不出來的排最後，order 從 900 起跳，一眼看得出是待處理的
unknown.forEach((id, i) => {
  tiers[id] = { ...doc.tiers[id], order: 900 + i };
});

const out = { ...doc, tiers, updatedAt: new Date().toISOString(), updatedBy: 'order-tiers.mjs' };

console.log('排序結果：');
console.log('');
let lastFam = null;
for (const r of ranked) {
  if (r.fam !== lastFam) { console.log(`  --- ${r.fam} ---`); lastFam = r.fam; }
  const t = doc.tiers[r.id];
  console.log(`  ${String(tiers[r.id].order).padStart(3)}  ${r.id.padEnd(22)} ${t.label ?? ''}`);
}
if (unknown.length) {
  console.log('');
  console.log('  無法歸類（排在最後）：');
  unknown.forEach((id) => console.log(`       ${id}`));
}

console.log('');
if (DRY) {
  console.log('[dry run] 未寫檔');
} else {
  writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
  console.log(`已寫入 ${FILE}，${ranked.length + unknown.length} 個段位`);
}
