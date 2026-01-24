module.exports = (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const userCookie = cookies.user;
  
  if (!userCookie) {
    return res.json({ loggedIn: false });
  }

  try {
    const user = JSON.parse(decodeURIComponent(userCookie));
    res.json({
      loggedIn: true,
      user: user
    });
  } catch (error) {
    res.json({ loggedIn: false });
  }
};

function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name && value) {
      cookies[name] = value;
    }
  });
  
  return cookies;
}