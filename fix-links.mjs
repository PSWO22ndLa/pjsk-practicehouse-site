/**
 * fix-links.mjs — 接通 index.html 到其他分頁
 *
 * 用法：
 *   node fix-links.mjs --dry     只檢查，不寫檔
 *   node fix-links.mjs           實際修改（會先備份）
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');

const read = f => readFileSync(join(ROOT, f), 'utf8');
const write = (f, t) => writeFileSync(join(ROOT, f), t, 'utf8');
const has = f => existsSync(join(ROOT, f));

const ok = m => console.log('  \x1b[32m[OK]\x1b[0m ' + m);
const warn = m => console.log('  \x1b[33m[!!]\x1b[0m ' + m);
const step = m => console.log('  \x1b[90m' + m + '\x1b[0m');

console.log('\n\x1b[36m=== 接通 index.html 的分頁連結 ===\x1b[0m\n');

for (const f of ['main.js', 'main.css', 'index.html']) {
  if (!has(f)) { console.error(`找不到 ${f}，請在專案根目錄執行`); process.exit(1); }
}

// ---------- 目標頁面偵測 ----------
const champ = has('2026springchampionshiprules.html') ? '2026springchampionshiprules.html'
  : has('2026springchampionshippt.html') ? '2026springchampionshippt.html' : null;
const hasRank = has('rank-challenge.html');

champ ? step(`Championship 入口 -> ${champ}`) : warn('找不到 championship 頁面，該卡片維持不可點');
hasRank ? step('段位挑戰入口 -> rank-challenge.html') : warn('找不到 rank-challenge.html');

// ---------- 圖片盤點 ----------
console.log('\n\x1b[36m--- 卡片圖片 ---\x1b[0m');
let missingImg = 0;
for (const img of ['themepicture.png', 'rank-stairs.png', 'event-comingsoon.png', 'group-icon.png']) {
  if (has(`public/images/${img}`)) ok(img);
  else { warn(`${img} 不存在`); missingImg++; }
}
if (missingImg) step('bg() 會加上漸層 fallback，破圖時至少不會空白');

if (DRY) { console.log('\n\x1b[33m[dry run] 未修改任何檔案\x1b[0m\n'); process.exit(0); }

// ---------- 備份 ----------
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backup = join(ROOT, '_backup', stamp);
mkdirSync(backup, { recursive: true });
for (const f of ['main.js', 'main.css', 'index.html']) copyFileSync(join(ROOT, f), join(backup, f));
console.log('\n\x1b[36m--- 備份 ---\x1b[0m');
ok(`_backup/${stamp}/`);

// ---------- main.js ----------
console.log('\n\x1b[36m--- main.js ---\x1b[0m');
let js = read('main.js');

// 1. ACTIVITIES 加 href
const hrefTargets = [
  [champ, "title:'2026 Spring Championship'"],
  [hasRank ? 'rank-challenge.html' : null, "title:'段位挑戰系統'"],
  ['https://discord.gg/wN3wx48nTB', "title:'社群交流'"]
];
let added = 0;
for (const [href, marker] of hrefTargets) {
  if (!href) continue;
  if (js.includes(`href:'${href}',${marker}`)) continue;   // 已加過
  if (!js.includes(marker)) { warn(`找不到 ${marker}`); continue; }
  js = js.replace(marker, `href:'${href}',${marker}`);
  added++;
}
ok(`ACTIVITIES 加入 ${added} 個 href`);

// 2. EXPLORE 的段位挑戰指向自家 anchor，改成真的頁面
if (hasRank) {
  const before = js;
  js = js.replace(/(title:'段位挑戰',text:'[^']*',href:)'#events'/, "$1'rank-challenge.html'");
  js !== before ? ok('EXPLORE 段位挑戰 -> rank-challenge.html') : step('EXPLORE 無需修改');
}

// 3. bg()：圖片疊在漸層上，載不到時露出漸層而非空白
{
  const before = js;
  js = js.replace(
    /const bg=\(o\)=>\s*o\.img\s*\?\s*`url\('\$\{o\.img\}'\)`\s*:\s*g\(o\.grad\);/,
    "const bg=(o)=> o.img ? `url('${o.img}'), ${g(o.grad)}` : g(o.grad);");
  js !== before ? ok('bg() 加上漸層 fallback') : step('bg() 無需修改');
}

// 4. 活動卡片渲染：有 href 就包成 <a>
{
  const marker = "document.getElementById('activityGrid').innerHTML=ACTIVITIES.map(a=>`";
  const i = js.indexOf(marker);
  if (i === -1) {
    warn('活動卡片渲染區塊未找到 — 需手動修改');
  } else if (js.includes('is-link')) {
    step('活動卡片已是 <a>，略過');
  } else {
    const end = js.indexOf(".join('');", i);
    const oldBlock = js.slice(i, end + ".join('');".length);
    const newBlock =
      "// 沒有 href 的活動保持非互動，避免連到尚未建立的頁面\n" +
      "  document.getElementById('activityGrid').innerHTML=ACTIVITIES.map(a=>{\n" +
      "    const inner=`\n" +
      '      <div class="ncard-img" style="background-image:${bg(a)}"><div class="veil"></div><span class="cat-badge">${a.cat}</span></div>\n' +
      '      <div class="ncard-body">\n' +
      '        <div class="ncard-date">${a.date}</div>\n' +
      '        <h3>${a.title}</h3>\n' +
      '        <p>${a.text}</p>\n' +
      '      </div>`;\n' +
      '    if(!a.href) return `<article class="ncard reveal">${inner}</article>`;\n' +
      "    const ext=a.href.startsWith('http')?' target=\"_blank\" rel=\"noopener\"':'';\n" +
      '    return `<a class="ncard reveal is-link" href="${a.href}"${ext}>${inner}</a>`;\n' +
      "  }).join('');";
    js = js.slice(0, i) + newBlock + js.slice(end + ".join('');".length);
    ok('活動卡片渲染改為 <a>');
  }
}

write('main.js', js);

// ---------- main.css ----------
console.log('\n\x1b[36m--- main.css ---\x1b[0m');
let css = read('main.css');
if (!css.includes('a.ncard{')) {
  css += `

/* 活動卡片改為 <a>，需要 block 才能維持原本排版 */
a.ncard{display:block;text-decoration:none;color:inherit}
a.ncard:focus-visible{outline:3px solid var(--ink);outline-offset:3px}
`;
  write('main.css', css);
  ok('加入 a.ncard 樣式');
} else step('a.ncard 樣式已存在');

// ---------- index.html ----------
console.log('\n\x1b[36m--- index.html ---\x1b[0m');
let html = read('index.html');
let n = 0;
const footerFixes = [
  [champ, '<a href="#">2026 Spring Championship</a>', t => `<a href="${t}">2026 Spring Championship</a>`],
  [hasRank ? 'rank-challenge.html' : null, '<a href="#">段位挑戰系統</a>', t => `<a href="${t}">段位挑戰系統</a>`],
  // 這兩頁還不存在，先指回 Activities 區塊而非留死連結
  ['#activities', '<a href="#">譜面創作工坊</a>', t => `<a href="${t}">譜面創作工坊</a>`],
  ['#activities', '<a href="#">每週挑戰賽</a>', t => `<a href="${t}">每週挑戰賽</a>`]
];
for (const [target, from, to] of footerFixes) {
  if (!target || !html.includes(from)) continue;
  html = html.replace(from, to(target));
  n++;
}
write('index.html', html);
ok(`footer 修正 ${n} 個連結`);

// ---------- 驗證 ----------
console.log('\n\x1b[36m--- 驗證 ---\x1b[0m');
const js2 = read('main.js');
const checks = [
  ['ACTIVITIES href', hasRank ? "href:'rank-challenge.html',title:'段位挑戰系統'" : null],
  ['<a> 渲染', 'class="ncard reveal is-link"'],
  ['bg() fallback', "${g(o.grad)}`"]
];
for (const [label, needle] of checks) {
  if (!needle) continue;
  js2.includes(needle) ? ok(label) : warn(`${label} 未生效`);
}

const dead = (read('index.html').match(/href="#"/g) || []).length;
dead === 0 ? ok('index.html 已無 href="#"')
  : warn(`index.html 仍有 ${dead} 個 href="#"（YouTube 社群圖示尚無連結屬正常）`);

console.log(`
\x1b[36m--- 下一步 ---\x1b[0m
  1. 開 index.html，點 Activities 的「段位挑戰系統」確認能跳轉
  2. 確認無誤後 commit：
       git add -A
       git commit -m "fix: connect index.html to rank and championship pages"
  3. 要還原：
       Copy-Item "_backup/${stamp}/*" . -Force
`);
