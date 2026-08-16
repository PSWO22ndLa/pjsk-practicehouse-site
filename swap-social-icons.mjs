#!/usr/bin/env node
/**
 * swap-social-icons.mjs — 社群圖示換成圖片檔
 *
 * 現況：導覽列與頁尾用 ✦ 和 ▶ 兩個字元充當 Discord / YouTube 圖示，
 * 而且 YouTube 的 href 是 '#'（點了沒反應）。
 *
 * 改動：
 *   1. 四處字元換成 <img>
 *   2. YouTube 補上實際頻道網址
 *   3. main.css 加圖片尺寸規則（.soc 既有的 opacity 與 hover 對圖片一樣有效）
 *
 * 用法：
 *   node swap-social-icons.mjs --dry
 *   node swap-social-icons.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const YT = 'https://www.youtube.com/channel/UCa6CA1dYly-RzRITBZzTJqw';

const ICONS = ['public/images/discord.png', 'public/images/youtube.png'];
const missing = ICONS.filter((p) => !existsSync(p));
if (missing.length) {
  console.error('缺少圖示檔案：\n  ' + missing.join('\n  '));
  process.exit(1);
}

const done = [];
const failed = [];

// ---------- index.html ----------
let html = readFileSync('index.html', 'utf8');
const htmlOrig = html;

function replaceOnce(label, from, to) {
  if (html.includes(to)) { done.push(`${label}（已是新版）`); return; }
  if (!html.includes(from)) { failed.push(label); return; }
  html = html.replace(from, to);
  done.push(label);
}

// 導覽列
replaceOnce(
  'nav Discord',
  '<a class="soc" href="https://discord.gg/wN3wx48nTB" target="_blank" rel="noopener" title="Discord">\u2726</a>',
  '<a class="soc" href="https://discord.gg/wN3wx48nTB" target="_blank" rel="noopener" title="Discord"><img src="public/images/discord.png" alt="Discord"></a>'
);
replaceOnce(
  'nav YouTube',
  '<a class="soc" href="#" title="YouTube">\u25b6</a>',
  `<a class="soc" href="${YT}" target="_blank" rel="noopener" title="YouTube"><img src="public/images/youtube.png" alt="YouTube"></a>`
);

// 頁尾
replaceOnce(
  'footer Discord',
  '<a href="https://discord.gg/wN3wx48nTB" target="_blank" rel="noopener"><span class="ic">\u2726</span>DISCORD</a>',
  '<a href="https://discord.gg/wN3wx48nTB" target="_blank" rel="noopener"><span class="ic"><img src="public/images/discord.png" alt=""></span>DISCORD</a>'
);
replaceOnce(
  'footer YouTube',
  '<a href="#"><span class="ic">\u25b6</span>YOUTUBE</a>',
  `<a href="${YT}" target="_blank" rel="noopener"><span class="ic"><img src="public/images/youtube.png" alt=""></span>YOUTUBE</a>`
);

// ---------- main.css ----------
let css = readFileSync('main.css', 'utf8');
const cssOrig = css;

if (css.includes('.soc img')) {
  done.push('CSS（已存在）');
} else {
  const anchor = '.soc:hover{opacity:1;transform:translateY(-2px)}';
  if (css.includes(anchor)) {
    // 圖示是白色去背 PNG，尺寸靠 CSS 控制，opacity 與 hover 沿用既有規則
    css = css.replace(anchor, anchor +
      '\n.soc img{width:18px;height:18px;display:block}' +
      '\n.ic img{width:15px;height:15px;vertical-align:-2px}');
    done.push('CSS');
  } else {
    failed.push('CSS 插入點');
  }
}

// ---------- 報告 ----------
console.log('');
done.forEach((d) => console.log(`  [OK] ${d}`));
failed.forEach((f) => console.log(`  [!!] ${f}`));

const changed = (html !== htmlOrig) || (css !== cssOrig);
console.log('');
if (!changed) { console.log('沒有變更。'); process.exit(failed.length ? 1 : 0); }
if (DRY) { console.log('[dry run] 未寫檔'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bdir = join('_backup', stamp);
mkdirSync(bdir, { recursive: true });
if (html !== htmlOrig) { copyFileSync('index.html', join(bdir, 'index.html')); writeFileSync('index.html', html, 'utf8'); }
if (css !== cssOrig) { copyFileSync('main.css', join(bdir, 'main.css')); writeFileSync('main.css', css, 'utf8'); }
console.log(`已寫入（備份於 _backup/${stamp}/）`);
