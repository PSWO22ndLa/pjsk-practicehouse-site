#!/usr/bin/env node
/**
 * restyle-rank-bg.mjs — 段位頁背景改成「深底 + 段位色光暈」
 *
 * 問題：現在整頁鋪滿段位色（黃金 #f6ff43、鑽石 #44ffcd 這類高飽和高亮度），
 * 再蓋一層 rgba(0,0,0,.4) 遮罩。飽和色鋪滿全視窗很刺眼，
 * 而且深色卡片壓在亮底上對比過強。
 *
 * 做法：底色改成近黑，段位色改用頂部的柔和光暈呈現。
 * 識別色保留（每個段位還是不一樣），但不再攻擊眼睛。
 *
 * 同時處理：
 *   - body 背景（先前補 margin 時填的是段位色，會在捲動邊緣露出來）
 *   - ::before 遮罩改成暗角，不再是整片黑
 *   - 巔峰系列的佔位紅 #ff0000（兩端同色）換成正式配色
 *
 * 顏色來源是 data/rank-songs.json 的 gradient，跟管理端、排行榜同一份，
 * 不在頁面裡各寫各的。
 *
 * 用法：
 *   node restyle-rank-bg.mjs --dry
 *   node restyle-rank-bg.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const CONFIG = 'data/rank-songs.json';

// 巔峰系列原本是 #ff0000 兩端同色的佔位值
const PEAK_FIX = ['#c9302c', '#e8543f'];

const BASE_TOP = '#16161f';
const BASE_BOTTOM = '#0e0e14';

if (!existsSync(CONFIG)) { console.error(`找不到 ${CONFIG}`); process.exit(1); }
const doc = JSON.parse(readFileSync(CONFIG, 'utf8'));

// #rgb / #rrggbb -> rgba(r,g,b,a)
function rgba(hex, a) {
  let h = String(hex).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return `rgba(120,120,140,${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * 光暈疊在深底之上：
 *   第一層 頂部中央的主色暈，範圍大、透明度低
 *   第二層 右上的次色暈，讓漸層有方向性而不是對稱的一坨
 *   第三層 底色
 * 透明度刻意壓低 —— 目的是「看得出是哪個段位」，不是「把顏色秀出來」。
 */
function buildBackground([c1, c2]) {
  return [
    `radial-gradient(120% 85% at 50% -15%, ${rgba(c1, 0.30)} 0%, ${rgba(c1, 0.10)} 42%, transparent 70%)`,
    `radial-gradient(85% 60% at 88% 2%, ${rgba(c2, 0.20)} 0%, transparent 58%)`,
    `linear-gradient(180deg, ${BASE_TOP} 0%, ${BASE_BOTTOM} 100%)`,
  ].join(',\n      ');
}

const files = readdirSync('.')
  .filter((n) => /^rank-.*\.html$/i.test(n) && n !== 'rank-challenge.html')
  .sort();

const pageToTier = new Map();
for (const [id, t] of Object.entries(doc.tiers)) if (t.page) pageToTier.set(t.page, id);

const rows = [];
const changed = [];
let peakFixed = 0;

for (const file of files) {
  const tierId = pageToTier.get(file);
  if (!tierId) { rows.push([file, '不在 rank-songs.json']); continue; }

  const tier = doc.tiers[tierId];
  let grad = Array.isArray(tier.gradient) && tier.gradient.length
    ? [...tier.gradient]
    : ['#6b6b7a', '#8b8b9c'];

  // 兩端同色代表是沒填完的佔位值
  const placeholder = grad.length >= 2 && new Set(grad.map((g) => g.toLowerCase())).size === 1;
  if (placeholder) {
    grad = [...PEAK_FIX];
    tier.gradient = [...PEAK_FIX];
    peakFixed++;
  }
  if (grad.length === 1) grad = [grad[0], grad[0]];

  let src = readFileSync(file, 'utf8');
  const orig = src;
  const steps = [];

  // ---- body 背景：先前補 margin 時填的是段位色，會在捲動邊緣露出 ----
  const bodyRx = /(body\s*\{[^}]*background:\s*)(#[0-9a-fA-F]{3,8}|[^;}]+)(\s*[;}])/;
  if (bodyRx.test(src)) {
    src = src.replace(bodyRx, `$1${BASE_BOTTOM}$3`);
    steps.push('body');
  }

  // ---- 主背景 ----
  const pageRx = /(\.rank-detail-page\s*\{[\s\S]*?background:\s*)(linear-gradient\([^;]*\)|[^;]+)(;)/;
  if (!pageRx.test(src)) { rows.push([file, '找不到 .rank-detail-page 背景']); continue; }
  src = src.replace(pageRx, `$1${buildBackground(grad)}$3`);
  steps.push('背景');

  // ---- 遮罩：底已經是深色，整片黑改成暗角 ----
  const beforeRx = /(\.rank-detail-page::before\s*\{[\s\S]*?background:\s*)(rgba\([^)]*\)|[^;]+)(;)/;
  if (beforeRx.test(src)) {
    src = src.replace(beforeRx,
      `$1radial-gradient(115% 80% at 50% 0%, transparent 45%, rgba(0, 0, 0, 0.38) 100%)$3`);
    steps.push('暗角');
  }

  rows.push([file, `${steps.join(', ')}${placeholder ? '  [佔位色已替換]' : ''}  ${grad.join(' -> ')}`]);
  if (src !== orig) changed.push([file, src]);
}

console.log('');
for (const [f, note] of rows) console.log(`  ${f.padEnd(28)} ${note}`);
console.log('');
console.log(`${changed.length} 支有變更${peakFixed ? `，其中 ${peakFixed} 支的佔位色已替換為 ${PEAK_FIX.join(' -> ')}` : ''}`);

if (DRY) { console.log(''); console.log('[dry run] 未寫檔'); process.exit(0); }
if (!changed.length) { console.log('沒有需要修改的檔案。'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bdir = join('_backup', stamp);
mkdirSync(bdir, { recursive: true });
for (const [f, src] of changed) {
  copyFileSync(f, join(bdir, f));
  writeFileSync(f, src, 'utf8');
}

// gradient 是共用資料，佔位色換掉後也要寫回設定檔
if (peakFixed) {
  copyFileSync(CONFIG, join(bdir, 'rank-songs.json'));
  doc.updatedAt = new Date().toISOString();
  doc.updatedBy = 'restyle-rank-bg.mjs';
  writeFileSync(CONFIG, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`已更新 ${CONFIG} 的 gradient`);
}

console.log(`已寫入 ${changed.length} 支（備份於 _backup/${stamp}/）`);
