/**
 * api/_content.js — 每週挑戰賽、譜面創作工坊的資料規格與驗證
 *
 * 公開頁、後台、API 三方都依賴同一份規格，所以集中在這裡。
 * 底線開頭，Vercel 不會把它當成 endpoint。
 *
 * 時區一律 Asia/Taipei（UTC+8）：「本週」的判定、投稿期限都以台灣日期為準，
 * 不能用 server 的 UTC 日期，否則每天 00:00–08:00 會算錯一天。
 */
const fs = require('node:fs');
const path = require('node:path');

const ID_RX = /^\d{5,25}$/;                  // Discord snowflake
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const KEY_RX = /^[a-z0-9][a-z0-9-]{0,39}$/;  // 週次 / 作品 id
const DIFFS = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
const JUDGES = ['great', 'good', 'bad', 'miss'];
const METRICS = ['penalty', 'score'];
const MAX_SCORE = 99999999;

const DOCS = {
  weekly: { file: 'data/weekly.json', empty: () => ({ version: 1, weeks: [] }) },
  workshop: { file: 'data/workshop.json', empty: () => ({ version: 1, entries: [] }) },
};

function todayTPE(now = Date.now()) {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function isHttpsUrl(s, max = 300) {
  if (typeof s !== 'string' || !s || s.length > max) return false;
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
}

// 扣血權重沿用段位挑戰的預設值，兩個系統的「失誤成本」才會一致
function defaultDamage() {
  try {
    const p = path.join(process.cwd(), 'data', 'rank-songs.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8')).defaults?.damage;
    if (d) return { great: d.great ?? 1, good: d.good ?? 2, bad: d.bad ?? 3, miss: d.miss ?? 5 };
  } catch { /* 讀不到就用寫死的預設 */ }
  return { great: 1, good: 2, bad: 3, miss: 5 };
}

function songIds() {
  try {
    const p = path.join(process.cwd(), 'data', 'songs.json');
    return new Set(JSON.parse(fs.readFileSync(p, 'utf8')).songs.map((s) => s.id));
  } catch {
    return null;
  }
}

const str = (v, max) => v == null || (typeof v === 'string' && v.length <= max);
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/** 單首成績：penalty 制填判定數，score 制填分數 */
function checkResult(r, metric, at, errs) {
  if (!r || typeof r !== 'object') { errs.push(`${at}: 不是物件`); return; }
  if (metric === 'score') {
    if (!int(r.score, 0, MAX_SCORE)) errs.push(`${at}: score 無效`);
  } else {
    for (const j of JUDGES) if (!int(r[j], 0, 99999)) errs.push(`${at}: ${j} 無效`);
  }
}

function validateWeekly(doc) {
  const errs = [];
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.weeks)) return ['缺少 weeks 陣列'];
  if (doc.weeks.length > 520) errs.push('週次超過 520 筆');
  const ids = songIds();
  const seenWeek = new Set();

  doc.weeks.forEach((w, i) => {
    const at = `weeks[${i}]`;
    if (!w || typeof w !== 'object') { errs.push(`${at}: 不是物件`); return; }
    if (typeof w.id !== 'string' || !KEY_RX.test(w.id)) errs.push(`${at}: id 只能用小寫英數與 -`);
    else if (seenWeek.has(w.id)) errs.push(`${at}: id 重複（${w.id}）`);
    else seenWeek.add(w.id);

    if (!str(w.title, 60)) errs.push(`${at}: title 過長`);
    if (!DATE_RX.test(String(w.start)) || !DATE_RX.test(String(w.end))) errs.push(`${at}: start / end 格式須為 YYYY-MM-DD`);
    else if (w.start > w.end) errs.push(`${at}: start 晚於 end`);
    if (!METRICS.includes(w.metric)) errs.push(`${at}: metric 須為 penalty 或 score`);
    if (!str(w.note, 500)) errs.push(`${at}: note 過長`);

    if (!Array.isArray(w.songs) || w.songs.length < 1 || w.songs.length > 5) {
      errs.push(`${at}: songs 須為 1–5 首`);
      return;
    }
    w.songs.forEach((s, k) => {
      const sat = `${at}.songs[${k}]`;
      if (!s || typeof s !== 'object') { errs.push(`${sat}: 不是物件`); return; }
      if (!Number.isInteger(s.id)) errs.push(`${sat}: id 無效`);
      else if (ids && !ids.has(s.id)) errs.push(`${sat}: 曲庫沒有 id ${s.id}`);
      if (!DIFFS.includes(s.difficulty)) errs.push(`${sat}: difficulty 無效`);
      if (typeof s.title !== 'string' || !s.title || s.title.length > 200) errs.push(`${sat}: title 無效`);
      if (s.level != null && !int(s.level, 1, 40)) errs.push(`${sat}: level 無效`);
      if (!str(s.jacket, 200)) errs.push(`${sat}: jacket 過長`);
    });

    if (!Array.isArray(w.entries)) { errs.push(`${at}: 缺少 entries 陣列`); return; }
    if (w.entries.length > 500) errs.push(`${at}: entries 超過 500 筆`);
    const seenUser = new Set();
    w.entries.forEach((e, k) => {
      const eat = `${at}.entries[${k}]`;
      if (!e || typeof e !== 'object') { errs.push(`${eat}: 不是物件`); return; }
      if (typeof e.userId !== 'string' || !ID_RX.test(e.userId)) errs.push(`${eat}: userId 不是有效的 Discord ID`);
      // 一人一週一筆：玩家重新投稿時，委員是「更新」而不是「新增」
      else if (seenUser.has(e.userId)) errs.push(`${eat}: 同一位玩家重複（${e.userId}）`);
      else seenUser.add(e.userId);
      if (typeof e.name !== 'string' || !e.name || e.name.length > 60) errs.push(`${eat}: name 無效`);
      if (e.proof != null && !isHttpsUrl(e.proof)) errs.push(`${eat}: proof 須為 https 連結`);
      if (e.date != null && !DATE_RX.test(String(e.date))) errs.push(`${eat}: date 格式須為 YYYY-MM-DD`);
      if (!Array.isArray(e.results) || e.results.length !== w.songs.length) {
        errs.push(`${eat}: results 數量須等於曲目數（${w.songs.length}）`);
        return;
      }
      e.results.forEach((r, n) => checkResult(r, w.metric, `${eat}.results[${n}]`, errs));
    });
  });

  return errs.slice(0, 20);
}

function validateWorkshop(doc) {
  const errs = [];
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.entries)) return ['缺少 entries 陣列'];
  if (doc.entries.length > 2000) errs.push('作品超過 2000 筆');
  const ids = songIds();
  const seen = new Set();

  doc.entries.forEach((e, i) => {
    const at = `entries[${i}]`;
    if (!e || typeof e !== 'object') { errs.push(`${at}: 不是物件`); return; }
    if (typeof e.id !== 'string' || !KEY_RX.test(e.id)) errs.push(`${at}: id 無效`);
    else if (seen.has(e.id)) errs.push(`${at}: id 重複（${e.id}）`);
    else seen.add(e.id);
    if (typeof e.title !== 'string' || !e.title || e.title.length > 80) errs.push(`${at}: title 無效`);
    if (e.songId != null && (!Number.isInteger(e.songId) || (ids && !ids.has(e.songId)))) errs.push(`${at}: songId 無效`);
    if (!str(e.songTitle, 200)) errs.push(`${at}: songTitle 過長`);
    if (typeof e.authorName !== 'string' || !e.authorName || e.authorName.length > 60) errs.push(`${at}: authorName 無效`);
    if (e.authorId != null && !ID_RX.test(String(e.authorId))) errs.push(`${at}: authorId 不是有效的 Discord ID`);
    if (e.level != null && !int(e.level, 1, 45)) errs.push(`${at}: level 須為 1–45`);
    if (!isHttpsUrl(e.url)) errs.push(`${at}: url 須為 https 連結`);
    if (!str(e.description, 500)) errs.push(`${at}: description 過長`);
    if (e.date != null && !DATE_RX.test(String(e.date))) errs.push(`${at}: date 格式須為 YYYY-MM-DD`);
    if (e.tags != null && (!Array.isArray(e.tags) || e.tags.length > 6 || e.tags.some((t) => typeof t !== 'string' || !t || t.length > 16))) {
      errs.push(`${at}: tags 最多 6 個、每個 16 字內`);
    }
  });

  return errs.slice(0, 20);
}

module.exports = {
  DOCS, DIFFS, JUDGES, METRICS, MAX_SCORE, ID_RX, DATE_RX,
  todayTPE, isHttpsUrl, defaultDamage, checkResult,
  validate: { weekly: validateWeekly, workshop: validateWorkshop },
};
