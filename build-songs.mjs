#!/usr/bin/env node
/**
 * build-songs.mjs — 產生 data/songs.json（網站自足的曲庫）
 *
 * 資料來源全部確認過欄位：
 *   musics.json            id, title, composer, arranger, lyricist, assetbundleName
 *   musicDifficulties.json musicId, musicDifficulty, playLevel, totalNoteCount
 *   zhNames.json           日文原名 -> 中文譯名（可選，來自 La bot）
 *
 * 用法：
 *   node build-songs.mjs
 *   node build-songs.mjs --zh "C:/Users/ao130/Desktop/LaBotCode/zhNames.json"
 *
 * 這支是本機一次性工具，不會在 Vercel 上執行。
 * 遊戲出新歌時重跑一次、commit 產物即可。
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/Sekai-World/sekai-master-db-diff/main';

const argv = process.argv.slice(2);
const zhArg = argv[argv.indexOf('--zh') + 1];
const ZH_PATH = argv.includes('--zh') && zhArg ? zhArg : null;

const OUT = join(process.cwd(), 'data', 'songs.json');

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} @ ${url}`);
  return r.json();
}

console.log('抓取上游資料...');
const [musics, diffs] = await Promise.all([
  getJSON(`${BASE}/musics.json`),
  getJSON(`${BASE}/musicDifficulties.json`),
]);
console.log(`  musics: ${musics.length}  difficulties: ${diffs.length}`);

// 中文譯名：key 是日文原名，與 musics.title 對得起來
let zh = {};
if (ZH_PATH) {
  if (existsSync(ZH_PATH)) {
    zh = JSON.parse(readFileSync(ZH_PATH, 'utf8'));
    console.log(`  zhNames: ${Object.keys(zh).length}`);
  } else {
    console.warn(`  ⚠️ 找不到 ${ZH_PATH}，中文譯名留空`);
  }
}

// musicId -> { levels, notes }
const byMusic = new Map();
for (const d of diffs) {
  if (!byMusic.has(d.musicId)) byMusic.set(d.musicId, { levels: {}, notes: {} });
  const e = byMusic.get(d.musicId);
  e.levels[d.musicDifficulty] = d.playLevel;
  e.notes[d.musicDifficulty] = d.totalNoteCount;
}

const songs = musics
  .map((m) => {
    const d = byMusic.get(m.id) ?? { levels: {}, notes: {} };
    return {
      id: m.id,
      title: m.title,
      titleZh: zh[m.title] ?? null,
      composer: m.composer ?? null,
      arranger: m.arranger ?? null,
      lyricist: m.lyricist ?? null,
      // 上游 CDN 有 hotlink 防護，瀏覽器直連一律 403，所以走本站代理
      jacket: `/api/jacket?n=${encodeURIComponent(m.assetbundleName)}`,
      levels: d.levels,
      notes: d.notes,
    };
  })
  .sort((a, b) => a.id - b.id);

const doc = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: BASE,
  count: songs.length,
  songs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc), 'utf8'); // 不縮排，這是給瀏覽器 fetch 的

// ---------- 統計 ----------
const withZh = songs.filter((s) => s.titleZh).length;
const withAppend = songs.filter((s) => s.levels.append != null).length;
const noComposer = songs.filter((s) => !s.composer).length;
const sizeKB = (JSON.stringify(doc).length / 1024).toFixed(0);

console.log('');
console.log(`寫入 data/songs.json  (${sizeKB} KB)`);
console.log(`  曲目            ${songs.length}`);
console.log(`  有中文譯名      ${withZh}`);
console.log(`  有 append 譜面  ${withAppend}`);
console.log(`  缺 composer     ${noComposer}`);
console.log('');
console.log('範例：');
console.log(JSON.stringify(songs[0], null, 2));
