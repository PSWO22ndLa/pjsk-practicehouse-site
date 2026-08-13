/**
 * write-staff2026.mjs — 寫入 2026 委員資料
 *
 * 自介原文取自 Discord，僅做最小限度整理：
 *   - 移除寫作過程的自語（「還要寫什麼」「想不到寫什麼了」）
 *   - lee 的「不怎麽樣」簡體字改為「麼」
 *   - 其餘標點、未閉合括號、語氣詞照原文
 *
 * La.、afedrk、雪白 尚未提供自介，先留空；
 * memberHTML 會跳過空的簡介段落，之後補資料即可。
 *
 * 用法：
 *   node write-staff2026.mjs --dry
 *   node write-staff2026.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');

const ok = m => console.log('  \x1b[32m[OK]\x1b[0m ' + m);
const warn = m => console.log('  \x1b[33m[!!]\x1b[0m ' + m);
const step = m => console.log('  \x1b[90m' + m + '\x1b[0m');

console.log('\n\x1b[36m=== 寫入 2026 委員 ===\x1b[0m\n');

if (!existsSync(join(ROOT, 'main.js'))) {
  console.error('找不到 main.js，請在專案根目錄執行');
  process.exit(1);
}

// 沒有 img 時，emoji 疊在漸層上（沿用 2025 的配色循環）
const GRADS = [
  ['#2b3a4a', '#6b8190'], ['#15151c', '#3a4a5c'],
  ['#1a2230', '#244a6b'], ['#1a2a33', '#3a6675'],
  ['#20002c', '#3a3897'], ['#1a2a6c', '#2a5298']
];

const STAFF = [
  { name: 'La.', role: '群主', emoji: '🎀', img: '', desc: '' },
  { name: 'afedrk', role: '代理群主', emoji: '🎧', img: '', desc: '' },
  {
    name: '檸檬貓', role: '管理員', emoji: '🎤', img: 'guardian1.gif',
    desc: '非常不顯眼的管管(不敢說話TT 有空就幫助其他委員做事，大家多多指教。'
  },
  {
    name: '萌忻', role: '手續委員', emoji: '🎸', img: 'formalities1.jpg',
    desc: '選課選太多的大一學生，1700+天的開服玩家，主要負責初始段位確認、課題曲挑戰區裁判。世畫成績：綠~紫31,彩30以下全AP、34除ÅMARA全FC。同時也是衝榜玩家，總之就是什麼都會(？)對於任何遊戲機制問題幾乎都能回答。只生活在DC的人，可以來DC找我。DC名稱：sekai_newcomer。'
  },
  {
    name: 'karl_hsiao', role: '手續委員', emoji: '🎺', img: 'formalities2.png',
    desc: '音遊只玩世畫的怪人 ( ? 請大家多多指教。'
  },
  {
    name: '雪貓', role: '功能委員', emoji: '🥁', img: 'function1.jpg',
    desc: '平常不會特別出現在這，主要負責更換群頭貼、新增表符之類的。多多加成伺服器，La 會感謝你的。'
  },
  { name: '雪白', role: '秩序委員長', emoji: '🎹', img: 'white.jpg', desc: '' },
  {
    name: 'lee', role: '活動委員', emoji: '🎻', img: 'event1.png',
    // 原文為簡體「麽」
    desc: '嗨嗨我是lee，是個pjsk萌新（入坑剛一年），基本上平時除了pjsk有在玩的音遊是舞萌和中二，雖然實力不怎麼樣但是非常歡迎來交流哦~'
  }
];

// ---------- 檢查 ----------
console.log('\x1b[36m--- 名單 ---\x1b[0m');
let missingImg = 0;
STAFF.forEach((s, i) => {
  const descTag = s.desc ? `\x1b[32m${String(s.desc.length).padStart(3)} 字\x1b[0m` : '\x1b[33m 待補 \x1b[0m';
  let imgTag;
  if (!s.img) imgTag = `\x1b[90memoji ${s.emoji}\x1b[0m`;
  else if (existsSync(join(ROOT, 'public/images', s.img))) imgTag = s.img;
  else { imgTag = `\x1b[33m${s.img} (找不到)\x1b[0m`; missingImg++; }
  console.log(`  ${String(i + 1).padStart(2)}. ${s.name.padEnd(11)} ${s.role.padEnd(6)} ${descTag}  ${imgTag}`);
});

if (missingImg) {
  console.log(`\n  \x1b[33m${missingImg} 個頭像檔案不存在，請先複製到 public/images/\x1b[0m`);
}

let js = readFileSync(join(ROOT, 'main.js'), 'utf8');
if (!/const STAFF2026\s*=/.test(js)) { console.error('\n找不到 STAFF2026 區塊'); process.exit(1); }

const hasDescGuard = js.includes('${m.desc?');
if (!hasDescGuard) step('\nmemberHTML 需加上空簡介判斷');

if (DRY) { console.log('\n\x1b[33m[dry run] 未修改任何檔案\x1b[0m\n'); process.exit(0); }

// ---------- 備份 ----------
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backup = join(ROOT, '_backup', stamp);
mkdirSync(backup, { recursive: true });
copyFileSync(join(ROOT, 'main.js'), join(backup, 'main.js'));
console.log('\n\x1b[36m--- 備份 ---\x1b[0m');
ok(`_backup/${stamp}/main.js`);

// ---------- 寫入 ----------
console.log('\n\x1b[36m--- 修改 ---\x1b[0m');
const q = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

const block = 'const STAFF2026=[\n' + STAFF.map((s, i) => {
  const g = GRADS[i % GRADS.length];
  const img = s.img ? `img:'public/images/${s.img}',` : '';
  return `    {${img}emoji:'${s.emoji}',grad:['${g[0]}','${g[1]}'],` +
         `name:'${q(s.name)}',role:'${q(s.role)}',desc:'${q(s.desc)}'}`;
}).join(',\n') + '\n  ];';

const before = js;
// 舊版是 Array.from({length:8},...) 的 placeholder
js = js.replace(/const STAFF2026=Array\.from\(\{length:\d+\}[\s\S]*?\}\)\);/, block);
if (js === before) js = js.replace(/const STAFF2026=\[[\s\S]*?\n\s*\];/, block);
if (js === before) { console.error('替換失敗'); process.exit(1); }
ok(`STAFF2026 寫入 ${STAFF.length} 位`);

// 空簡介不渲染空段落
if (!hasDescGuard) {
  const from = '        <p>${m.desc}</p>';
  const to = "        ${m.desc?`<p>${m.desc}</p>`:''}";
  if (js.includes(from)) { js = js.replace(from, to); ok('memberHTML 跳過空簡介'); }
  else warn('memberHTML 未匹配 — 空簡介會留下空段落');
}

writeFileSync(join(ROOT, 'main.js'), js, 'utf8');

// ---------- 驗證 ----------
console.log('\n\x1b[36m--- 驗證 ---\x1b[0m');
const out = readFileSync(join(ROOT, 'main.js'), 'utf8');
for (const s of STAFF) out.includes(`name:'${s.name}'`) ? ok(`${s.name} (${s.role})`) : warn(`${s.name} 未寫入`);
out.includes("name:'成員 ") ? warn('placeholder 殘留') : ok('placeholder 已清除');
out.includes('sekai_newcomer') ? ok('萌忻的完整自介') : warn('萌忻自介不完整');
out.includes('guardian1.gif') ? ok('檸檬貓的動態頭像') : warn('檸檬貓頭像未設定');

const pending = STAFF.filter(s => !s.desc).map(s => s.name);
console.log(`
\x1b[36m--- 待補 ---\x1b[0m
  自介：${pending.join('、')}
  頭像：La.、afedrk（目前為 emoji + 漸層）

  補資料時直接編輯 main.js 的 STAFF2026 陣列，
  加頭像則在該筆最前面加上 img:'public/images/檔名'

\x1b[36m--- 下一步 ---\x1b[0m
  1. node --check main.js
  2. 開 index.html 看 Staff 2026 區塊，確認檸檬貓的 GIF 會動
  3. git add -A && git commit -m "feat: add 2026 staff roster"
  4. 還原：Copy-Item "_backup/${stamp}/main.js" . -Force
`);
