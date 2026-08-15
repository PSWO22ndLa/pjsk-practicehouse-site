/**
 * GET /api/auth/login — 導向 Discord 授權頁
 *
 * state 同時放進 HttpOnly cookie 與 query，callback 兩邊比對，
 * 這是擋 CSRF 的標準做法（先前的「URL 登入偽造」就是少了這層）。
 */
const crypto = require('node:crypto');
const { env, serializeCookie, setCookies } = require('../_lib');

module.exports = async (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');

    // 登入完要回哪一頁，限制成站內相對路徑，避免變成 open redirect
    const raw = typeof req.query.next === 'string' ? req.query.next : '/admin.html';
    const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/admin.html';

    setCookies(res, [
      serializeCookie('oauth_state', state, { maxAge: 600 }),
      serializeCookie('oauth_next', next, { maxAge: 600 }),
    ]);

    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', env('DISCORD_CLIENT_ID'));
    url.searchParams.set('redirect_uri', env('DISCORD_REDIRECT_URI'));
    url.searchParams.set('response_type', 'code');
    // guilds.members.read 才能讀到使用者在該 guild 的 roles
    url.searchParams.set('scope', 'identify guilds.members.read');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'none');

    res.writeHead(302, { Location: url.toString() });
    res.end();
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: e.message });
  }
};
