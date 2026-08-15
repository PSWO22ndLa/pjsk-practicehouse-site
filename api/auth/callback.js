/**
 * GET /api/auth/callback — 交換 code、讀身分組、簽 JWT
 *
 * 流程：
 *   1. 比對 state（擋 CSRF）
 *   2. code -> access_token
 *   3. 用 access_token 讀「該 guild 內的 member」，拿 roles
 *   4. roles 命中委員身分組才給 admin: true
 *   5. 簽 JWT 寫進 HttpOnly cookie
 *
 * 身分組在簽發當下就固定寫進 token。委員被拔掉身分組後，
 * token 仍會有效直到過期，所以 TTL 只給 7 天而不是更長。
 */
const {
  env, parseCookies, serializeCookie, setCookies,
  signJWT, adminRoleIds, SESSION_COOKIE,
} = require('../_lib');

const API = 'https://discord.com/api/v10';

function fail(res, reason) {
  // 錯誤細節不放進 URL，避免外洩內部訊息
  res.writeHead(302, { Location: `/?login=failed&reason=${encodeURIComponent(reason)}` });
  res.end();
}

module.exports = async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const { code, state } = req.query;

    if (!code) return fail(res, 'no_code');
    if (!state || !cookies.oauth_state || state !== cookies.oauth_state) {
      return fail(res, 'bad_state');
    }

    // ---- 2. 換 token ----
    const tokenRes = await fetch(`${API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env('DISCORD_CLIENT_ID'),
        client_secret: env('DISCORD_CLIENT_SECRET'),
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: env('DISCORD_REDIRECT_URI'),
      }),
    });
    if (!tokenRes.ok) return fail(res, 'token_exchange');
    const token = await tokenRes.json();

    const auth = { Authorization: `Bearer ${token.access_token}` };

    // ---- 3. 讀 guild member（含 roles）----
    const guildId = env('DISCORD_GUILD_ID');
    const memberRes = await fetch(`${API}/users/@me/guilds/${guildId}/member`, { headers: auth });
    if (memberRes.status === 404) return fail(res, 'not_in_guild');
    if (!memberRes.ok) return fail(res, 'member_fetch');
    const member = await memberRes.json();

    const user = member.user ?? {};
    if (!user.id) return fail(res, 'no_user');

    // ---- 4. 權限判定 ----
    const roles = Array.isArray(member.roles) ? member.roles : [];
    const admins = adminRoleIds();
    const isAdmin = roles.some((r) => admins.includes(r));

    // ---- 5. 簽 token ----
    const jwt = signJWT(
      {
        sub: user.id,
        name: member.nick || user.global_name || user.username,
        avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
          : null,
        admin: isAdmin,
      },
      env('JWT_SECRET'),
      7 * 24 * 3600,
    );

    setCookies(res, [
      serializeCookie(SESSION_COOKIE, jwt, { maxAge: 7 * 24 * 3600 }),
      serializeCookie('oauth_state', '', { maxAge: 0 }),
      serializeCookie('oauth_next', '', { maxAge: 0 }),
    ]);

    const next = cookies.oauth_next && cookies.oauth_next.startsWith('/') ? cookies.oauth_next : '/admin.html';
    res.writeHead(302, { Location: isAdmin ? next : '/?login=ok&admin=0' });
    res.end();
  } catch (e) {
    console.error('[auth/callback]', e);
    return fail(res, 'server_error');
  }
};
