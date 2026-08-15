#!/usr/bin/env node
/**
 * extract-songs.mjs — 把 29 支 rank-*.html 裡的 songs 陣列抽成 rank-songs.json（唯讀，不改 HTML）
 *
 * 產出：
 *   rank-songs.json    段位配置，之後由管理端寫入
 *   extract-report.md  抽取結果與佔位資料清單
 *
 * 解析方式：正則定位 `const songs = [` 後做括號配對取出字面量，
 * 再用 Function 求值。物件字面量是 unquoted key + 單引號，JSON.parse 吃不下，
 * 而這是自己 repo 的程式碼，不是外部輸入，直接求值是安全的。
 *
 * 用法：node extract-songs.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const INDEX_PAGE = 'rank-challenge.html'; // 段位列表頁，不是段位本身

const files = readdirSync(ROOT)
  .filter((n) => /^rank-.*\.html$/i.test(n) && n !== INDEX_PAGE)
  .sort();

const rep = [];
const w = (s = '') => rep.push(s);

// 從 `const songs = [` 起做方括號配對，跳過字串與樣板字面量內的括號
function extractArrayLiteral(src, declRx) {
  const m = src.match(declRx);
  if (!m) return null;
  let i = src.indexOf('[', m.index);
  if (i === -1) return null;
  const start = i;
  let depth = 0;
  let quote = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    const prev = src[i - 1];
    if (quote) {
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

// rank-bronze.html -> bronze ; rank-peak-unlock.html -> peak-unlock
const tierId = (f) => f.replace(/^rank-/, '').replace(/\.html$/i, '');

const isPlaceholder = (s) =>
  /^曲目\s*\d*$/.test(String(s.name ?? '')) ||
  ['作曲者', '編曲者', '', null, undefined].includes(s.composer) ||
  ['作曲者', '編曲者', '', null, undefined].includes(s.arranger);

const tiers = {};
const problems = [];
let totalSongs = 0;
let placeholderSongs = 0;

for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8');
  const id = tierId(f);

  const label = (src.match(/<h1[^>]*class=["'][^"']*rank-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.trim() ?? null;
  const badge = (src.match(/<div class=["'][^"']*rank-badge[^"']*["'][^>]*>\s*<img[^>]+src=["']([^"']+)["']/i) || [])[1] ?? null;
  const grad = [...(src.match(/\.rank-detail-page\s*\{[\s\S]*?background:\s*linear-gradient\(([^;]+)\)/i)?.[1] ?? '')
    .matchAll(/#[0-9a-f]{3,8}\b/gi)].map((x) => x[0]);

  // 規則區塊：<div class="rule-label">X</div><div class="rule-value ...">Y</div>
  const rules = {};
  for (const m of src.matchAll(/<div class=["']rule-label["']>([\s\S]*?)<\/div>\s*<div class=["']rule-value[^"']*["']>([\s\S]*?)<\/div>/gi)) {
    rules[m[1].trim()] = m[2].trim();
  }

  let songs = [];
  const lit = extractArrayLiteral(src, /(?:const|let|var)\s+songs\s*=/);
  if (!lit) {
    problems.push(`${f} — 找不到 songs 陣列`);
  } else {
    try {
      songs = Function(`"use strict"; return (${lit});`)();
      if (!Array.isArray(songs)) { problems.push(`${f} — songs 不是陣列`); songs = []; }
    } catch (e) {
      problems.push(`${f} — 求值失敗：${e.message}`);
      songs = [];
    }
  }

  const norm = songs.map((s) => ({
    name: s.name ?? null,
    composer: s.composer ?? null,
    arranger: s.arranger ?? null,
    difficulty: s.difficulty ? String(s.difficulty).toLowerCase() : null,
    level: typeof s.level === 'number' ? s.level : (s.level ? Number(s.level) : null),
    jacket: s.jacket ?? null,
    musicId: null, // 之後與 bot 的 music.json 對照時填入
  }));

  totalSongs += norm.length;
  const ph = norm.filter(isPlaceholder).length;
  placeholderSongs += ph;

  tiers[id] = {
    page: f,
    label,
    badge,
    gradient: grad,
    rules,
    songs: norm,
    _placeholder: ph > 0 ? ph : undefined,
  };
}

const doc = {
  version: 1,
  updatedAt: new Date().toISOString(),
  updatedBy: 'extract-songs.mjs',
  note: 'musicId 尚未對照 bot 的 music.json，全部為 null',
  tiers,
};

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'rank-songs.json'), JSON.stringify(doc, null, 2), 'utf8');

// ---------- 報告 ----------
w('# extract-report');
w('');
w(`- 段位頁：${files.length} 支（已排除 ${INDEX_PAGE}）`);
w(`- 曲目總數：${totalSongs}`);
w(`- 佔位資料：${placeholderSongs} 首`);
w('');

if (problems.length) {
  w('## 解析問題');
  w('```');
  problems.forEach((p) => w(p));
  w('```');
  w('');
}

w('## 各段位');
w('');
w('| tier | label | 曲數 | 佔位 | 規則欄位 |');
w('|---|---|---|---|---|');
for (const [id, t] of Object.entries(tiers)) {
  w(`| ${id} | ${t.label ?? '(none)'} | ${t.songs.length} | ${t._placeholder ?? 0} | ${Object.keys(t.rules).join(', ') || '(none)'} |`);
}
w('');

w('## 佔位曲目明細');
w('```');
let any = false;
for (const [id, t] of Object.entries(tiers)) {
  t.songs.forEach((s, i) => {
    if (isPlaceholder(s)) { any = true; w(`${id}[${i}]  name=${s.name}  composer=${s.composer}  arranger=${s.arranger}  ${s.difficulty} ${s.level}`); }
  });
}
if (!any) w('(none)');
w('```');
w('');

w('## 難度值分佈');
const diffs = new Map();
for (const t of Object.values(tiers)) for (const s of t.songs) diffs.set(s.difficulty, (diffs.get(s.difficulty) || 0) + 1);
w('```');
for (const [d, n] of [...diffs].sort((a, b) => b[1] - a[1])) w(`${String(n).padStart(4)} x  ${d}`);
w('```');
w('');

w('## 曲繪 jacket 狀態');
let withJacket = 0, nullJacket = 0, missingFile = 0;
for (const t of Object.values(tiers)) {
  for (const s of t.songs) {
    if (!s.jacket) { nullJacket++; continue; }
    withJacket++;
    if (!/^https?:/i.test(s.jacket) && !existsSync(join(ROOT, s.jacket))) missingFile++;
  }
}
w('```');
w(`有路徑：${withJacket}  其中檔案不存在：${missingFile}`);
w(`null（顯示 emoji fallback）：${nullJacket}`);
w('```');
w('');

writeFileSync(join(ROOT, 'extract-report.md'), rep.join('\n'), 'utf8');
process.stdout.write(`done -> data/rank-songs.json + extract-report.md\n`);
