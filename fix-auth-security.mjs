/**
 * fix-auth-security.mjs — 修正前端認證與注入問題
 *
 *   1. 移除 URL 登入偽造：?login=success&userData={...} 不再被信任
 *   2. XSS 跳脫：achievements 進 innerHTML 前跳脫
 *   3. 頭像 URL 白名單：只接受 cdn.discordapp.com
 *   4. localStorage 加 TTL 與型別驗證
 *
 * 用法：
 *   node fix-auth-security.mjs --dry
 *   node fix-auth-security.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');

const read = f => readFileSync(join(ROOT, f), 'utf8');
const write = (f, t) => writeFileSync(join(ROOT, f), t, 'utf8');

const ok = m => console.log('  \x1b[32m[OK]\x1b[0m ' + m);
const warn = m => console.log('  \x1b[33m[!!]\x1b[0m ' + m);
const step = m => console.log('  \x1b[90m' + m + '\x1b[0m');

console.log('\n\x1b[36m=== 前端認證安全修正 ===\x1b[0m\n');

if (!existsSync(join(ROOT, 'main.js'))) {
  console.error('找不到 main.js，請在專案根目錄執行');
  process.exit(1);
}

let js = read('main.js');
const found = [];
const notFound = [];

// ---------- 掃描 ----------
console.log('\x1b[36m--- 掃描 ---\x1b[0m');

const AUTH_INIT_MARKER = "if(params.get('login')==='success'){";
const ACH_MARKER = 'currentUser.achievements.map(a=>`<div class="achievement-item">';
const NAV_AVATAR = "$('navAvatar').src=currentUser.avatar||'';";
const P_AVATAR = "$('pAvatar').src=currentUser.avatar||'';";
const ESC_MARKER = 'const esc=';

for (const [label, m] of [
  ['URL 登入偽造', AUTH_INIT_MARKER],
  ['achievements 未跳脫', ACH_MARKER],
  ['navAvatar 無白名單', NAV_AVATAR],
  ['pAvatar 無白名單', P_AVATAR]
]) {
  if (js.includes(m)) { warn(label); found.push(label); }
  else { step(`${label} — 未找到（可能已修過）`); notFound.push(label); }
}

if (js.includes(ESC_MARKER)) step('esc() 已存在');

if (!found.length) {
  console.log('\n\x1b[32m沒有找到需要修正的項目。\x1b[0m\n');
  process.exit(0);
}

if (DRY) {
  console.log(`\n\x1b[33m[dry run] 找到 ${found.length} 項待修正，未修改任何檔案\x1b[0m\n`);
  process.exit(0);
}

// ---------- 備份 ----------
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backup = join(ROOT, '_backup', stamp);
mkdirSync(backup, { recursive: true });
copyFileSync(join(ROOT, 'main.js'), join(backup, 'main.js'));
console.log('\n\x1b[36m--- 備份 ---\x1b[0m');
ok(`_backup/${stamp}/main.js`);

console.log('\n\x1b[36m--- 修正 ---\x1b[0m');

// ---------- 1. 插入工具函式 ----------
if (!js.includes(ESC_MARKER)) {
  const helpers = `/* ===== 安全工具 ===== */
// innerHTML 注入前一律跳脫。資料來自 API，不能假設乾淨。
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 頭像只接受 Discord CDN，避免任意 URL 造成資訊外洩或追蹤
const safeAvatar=(u)=>{
  try{
    const p=new URL(String(u));
    return (p.protocol==='https:'&&/^(cdn|media)\\.discordapp\\.(com|net)$/.test(p.hostname))?p.href:'';
  }catch{return '';}
};

// localStorage 快取加時效，避免無限期沿用舊資料
const SESSION_TTL=7*24*60*60*1000;
function saveUser(u){
  try{localStorage.setItem('discordUser',JSON.stringify({t:Date.now(),u}));}catch{}
}
function loadUser(){
  try{
    const raw=localStorage.getItem('discordUser'); if(!raw)return null;
    const box=JSON.parse(raw);
    // 舊格式（直接存 user 物件）一律作廢，強制重新登入
    if(!box||typeof box!=='object'||typeof box.t!=='number'||!box.u){localStorage.removeItem('discordUser');return null;}
    if(Date.now()-box.t>SESSION_TTL){localStorage.removeItem('discordUser');return null;}
    return (box.u&&typeof box.u.id==='string')?box.u:null;
  }catch{localStorage.removeItem('discordUser');return null;}
}

`;
  js = helpers + js;
  ok('加入 esc() / safeAvatar() / TTL 快取');
}

// ---------- 2. 移除 URL 登入偽造 ----------
{
  const i = js.indexOf('(async function authInit(){');
  if (i === -1) {
    warn('authInit 未找到 — 需手動修改');
  } else if (js.includes('// URL 不再作為登入憑據')) {
    step('authInit 已修過');
  } else {
    const end = js.indexOf('updateAuthUI();', i);
    if (end === -1) {
      warn('authInit 結尾未找到 — 需手動修改');
    } else {
      const newInit = `(async function authInit(){
  // URL 不再作為登入憑據：?userData= 任何人都能偽造，且會進入瀏覽器歷史與伺服器 log。
  // 後端改用 HttpOnly cookie 後，這裡應改成 fetch('/api/auth/status') 取得登入狀態。
  const params=new URLSearchParams(location.search);
  if(params.get('login')){
    if(params.get('login')==='failed')alert('登入失敗，請重試');
    history.replaceState({},document.title,location.pathname);
  }
  currentUser=loadUser();
  if(currentUser)await loadUserTitles(currentUser.id);
  `;
      js = js.slice(0, i) + newInit + js.slice(end);
      ok('authInit 不再從 URL 讀取身分');
    }
  }
}

// ---------- 3. achievements 跳脫 ----------
{
  const before = js;
  js = js.replace(
    /currentUser\.achievements\.map\(a=>`<div class="achievement-item"><div class="achievement-name">\$\{a\.name\} \(\+\$\{a\.points\}pt\)<\/div><div class="achievement-desc">\$\{a\.description\|\|''\}<\/div><\/div>`\)/,
    'currentUser.achievements.map(a=>`<div class="achievement-item"><div class="achievement-name">${esc(a.name)} (+${Number(a.points)||0}pt)</div><div class="achievement-desc">${esc(a.description)}</div></div>`)'
  );
  js !== before ? ok('achievements 加上跳脫') : step('achievements 無需修改');
}

// ---------- 4. 頭像白名單 ----------
{
  let n = 0;
  for (const id of ['navAvatar', 'pAvatar']) {
    const from = `$('${id}').src=currentUser.avatar||'';`;
    const to = `$('${id}').src=safeAvatar(currentUser.avatar);`;
    if (js.includes(from)) { js = js.replace(from, to); n++; }
  }
  n ? ok(`頭像 URL 白名單 (${n} 處)`) : step('頭像無需修改');
}

// ---------- 5. 其餘 setItem 改用 saveUser ----------
{
  const before = js;
  js = js.replace(/localStorage\.setItem\('discordUser',JSON\.stringify\(currentUser\)\);/g,
                  'saveUser(currentUser);');
  const n = (before.match(/localStorage\.setItem\('discordUser'/g) || []).length
          - (js.match(/localStorage\.setItem\('discordUser'/g) || []).length;
  n ? ok(`${n} 處 setItem 改用 saveUser()`) : step('setItem 無需修改');
}

write('main.js', js);

// ---------- 驗證 ----------
console.log('\n\x1b[36m--- 驗證 ---\x1b[0m');
const js2 = read('main.js');
const checks = [
  ['esc() 存在', 'const esc='],
  ['safeAvatar() 存在', 'const safeAvatar='],
  ['URL 登入已移除', '// URL 不再作為登入憑據'],
  ['achievements 已跳脫', '${esc(a.name)}'],
  ['頭像白名單', "safeAvatar(currentUser.avatar)"]
];
for (const [label, needle] of checks) {
  js2.includes(needle) ? ok(label) : warn(`${label} — 未生效`);
}
if (js2.includes("JSON.parse(decodeURIComponent(ud))")) warn('URL userData 解析殘留 — 請手動檢查');

console.log(`
\x1b[36m--- 重要 ---\x1b[0m
  這支腳本移除了「用網址偽造登入」的漏洞，副作用是登入功能會暫時失效
  ——因為後端 callback.js 從來沒有 Set-Cookie，前端已無合法的身分來源。

  舊的 localStorage 格式會被視為無效並清除，所有人都需要重新登入。

  要恢復登入，後端需要：
    1. callback.js 產生 session id，Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax
    2. 前端 authInit 改成 fetch('/api/auth/status', {credentials:'same-origin'})
       （api/auth/status.js 已經寫好了，只差 callback 沒設 cookie）

\x1b[36m--- 下一步 ---\x1b[0m
  1. 開 index.html 確認頁面正常（登入鈕會顯示未登入狀態）
  2. git add -A && git commit -m "fix: remove URL-based auth forgery and escape user content"
  3. 還原：Copy-Item "_backup/${stamp}/main.js" . -Force
`);
