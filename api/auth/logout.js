/**
 * GET|POST /api/auth/logout — 清除 session cookie
 *
 * JWT 是 stateless，沒有伺服器端 session 可以撤銷，
 * 所以「登出」就是把 cookie 蓋掉。
 */
const { serializeCookie, setCookies, SESSION_COOKIE } = require('../_lib');

module.exports = async (req, res) => {
  setCookies(res, [serializeCookie(SESSION_COOKIE, '', { maxAge: 0 })]);
  if (req.method === 'GET') {
    res.writeHead(302, { Location: '/' });
    return res.end();
  }
  res.status(200).json({ ok: true });
};
