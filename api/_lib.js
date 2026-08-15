/**
 * api/_lib.js — 共用工具：JWT、Cookie、權限檢查
 *
 * 底線開頭的檔案 Vercel 不會當成 endpoint，只能被其他函式 require。
 *
 * JWT 自己實作而不裝套件的原因：HS256 用 node:crypto 只需要幾十行，
 * 沒有依賴就沒有 ESM/CJS 相容問題（package.json 是 commonjs），
 * 也不用擔心套件版本在 Vercel 上跟本機不同。
 */
const crypto = require('node:crypto');

// ---------- base64url ----------
const b64u = {
  enc: (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
};

// ---------- JWT (HS256) ----------
function signJWT(payload, secret, ttlSec = 7 * 24 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSec };
  const head = b64u.enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${head}.${b64u.enc(JSON.stringify(body))}`;
  const sig = b64u.enc(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verifyJWT(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', secret).update(data).digest();
  const got = b64u.dec(parts[2]);
  // 長度不同時 timingSafeEqual 會丟例外，先擋掉
  if (got.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(got, expected)) return null;
  let payload;
  try { payload = JSON.parse(b64u.dec(parts[1]).toString('utf8')); } catch { return null; }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ---------- Cookie ----------
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function serializeCookie(name, value, opts = {}) {
  const p = [`${name}=${encodeURIComponent(value)}`];
  p.push(`Path=${opts.path ?? '/'}`);
  if (opts.maxAge != null) p.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) p.push('HttpOnly');
  if (opts.secure !== false) p.push('Secure');
  p.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  return p.join('; ');
}

function setCookies(res, cookies) {
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('Set-Cookie', [...list, ...cookies]);
}

// ---------- 環境變數 ----------
function env(name, required = true) {
  const v = process.env[name];
  if (required && !v) throw new Error(`缺少環境變數 ${name}`);
  return v;
}

const SESSION_COOKIE = 'ph_session';

// 委員身分組。用環境變數覆寫，避免改 code 才能加人。
function adminRoleIds() {
  const raw = process.env.ADMIN_ROLE_IDS;
  if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return [
    '1537505706964418681',
    '1537505925852692570',
    '1537506099966513202',
  ];
}

/**
 * 從 Cookie 取出並驗證 session。
 * 回傳 payload 或 null —— 呼叫端負責回 401，這裡不直接寫 response，
 * 因為有些端點對未登入要回 JSON、有些要 redirect。
 */
function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  try {
    return verifyJWT(token, env('JWT_SECRET'));
  } catch {
    return null;
  }
}

// 只有帶 admin: true 的 session 能寫入
function requireAdmin(req, res) {
  const s = getSession(req);
  if (!s) {
    res.status(401).json({ error: 'not_authenticated' });
    return null;
  }
  if (!s.admin) {
    res.status(403).json({ error: 'not_authorized' });
    return null;
  }
  return s;
}

module.exports = {
  b64u,
  signJWT,
  verifyJWT,
  parseCookies,
  serializeCookie,
  setCookies,
  env,
  adminRoleIds,
  getSession,
  requireAdmin,
  SESSION_COOKIE,
};
