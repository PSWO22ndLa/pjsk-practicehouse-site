const axios = require('axios');

module.exports = async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('https://pjsk-practicehouse-site.vercel.app/?login=failed');
  }

  try {
    // 交換 access token
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token } = tokenResponse.data;

    // 獲取使用者資訊
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const discordUser = userResponse.data;

    // 建立使用者資料
    const userData = {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator) % 5}.png`,
      rank: 'プロセカ初心者',
      totalPoints: 0,
      achievements: [],
      pb: []
    };

    // ✅ 用 URL 傳遞資料,由前端存入 localStorage
    const userDataEncoded = encodeURIComponent(JSON.stringify(userData));
    res.redirect(`https://pjsk-practicehouse-site.vercel.app/?login=success&userData=${userDataEncoded}`);
    
  } catch (error) {
    console.error('Discord OAuth Error:', error.response?.data || error.message);
    res.redirect(`https://pjsk-practicehouse-site.vercel.app/?login=failed&error=${encodeURIComponent(error.message)}`);
  }
};