const axios = require('axios');

module.exports = async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('https://pjsk-practicehouse-site.vercel.app/?login=failed');
  }

  try {
    // 1. 交換 access token
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

    // 2. 獲取 Discord 使用者資訊
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const discordUser = userResponse.data;

    // ✨ 3. 獲取使用者的 Discord 身分組 (需要 guilds.members.read scope)
    let detectedRank = 'プロセカ初心者';
    
    try {
      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      
      // 找到你的伺服器 (需要你的 Guild ID)
      const YOUR_GUILD_ID = '1361172587417305130';  // ← 填入你的伺服器 ID
      
      if (guildsResponse.data && guildsResponse.data.some(g => g.id === YOUR_GUILD_ID)) {
        const memberResponse = await axios.get(
          `https://discord.com/api/users/@me/guilds/${YOUR_GUILD_ID}/member`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`
            }
          }
        );
        
        const roles = memberResponse.data.roles || [];
        
        // ✨ 根據身分組名稱自動判斷段位 (優先度從高到低)
        const roleRankMap = {
          'プロセカ ∞': 'プロセカ ∞',
          'プロセカ 創神者': 'プロセカ 創神者',
          'プロセカ 天啓': 'プロセカ 天啓',
          'プロセカ 神': 'プロセカ 神',
          'プロセカ 亞神': 'プロセカ 亞神',
          'プロセカ巔峰者': 'プロセカ巔峰者',
          'プロセカ大師': 'プロセカ大師',
          'プロセカ鑽石者': 'プロセカ鑽石者',
          'プロセカ白金者': 'プロセカ白金者',
          'プロセカ黃金者': 'プロセカ黃金者',
          'プロセカ白銀者': 'プロセカ白銀者',
          'プロセカ青銅者': 'プロセカ青銅者',
          'プロセカ初心者': 'プロセカ初心者'
        };
        
        // 取得所有身分組資訊
        const guildResponse = await axios.get(
          `https://discord.com/api/guilds/${YOUR_GUILD_ID}/roles`,
          {
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`  // ← 需要 Bot Token
            }
          }
        );
        
        const guildRoles = guildResponse.data;
        
        // 找出使用者的最高段位身分組
        for (const [roleName, rank] of Object.entries(roleRankMap)) {
          const role = guildRoles.find(r => r.name === roleName);
          if (role && roles.includes(role.id)) {
            detectedRank = rank;
            break;  // 找到第一個就停止 (最高段位)
          }
        }
      }
    } catch (roleError) {
      console.log('無法讀取身分組,使用預設段位:', roleError.message);
    }

    // 4. 從 Railway API 獲取其他遊戲資料
    let gameData = {
      rank: detectedRank,  // ← 使用自動偵測的段位
      totalPoints: 0,
      achievements: [],
      pb: [],
      messageCount: 0
    };

    try {
      const railwayResponse = await axios.get(
        `https://labotcode-production.up.railway.app/api/user/${discordUser.id}/titles`
      );
      
      if (railwayResponse.data) {
        gameData = {
          rank: detectedRank,  // ← 優先使用自動偵測的段位
          totalPoints: railwayResponse.data.totalPoints || 0,
          achievements: railwayResponse.data.achievements || [],
          pb: railwayResponse.data.pb || [],
          messageCount: railwayResponse.data.messageCount || 0,
          specialTitles: railwayResponse.data.specialTitles || [],
          equippedTitles: railwayResponse.data.equippedTitles || [null, null, null]
        };
      }
    } catch (railwayError) {
      console.log('Railway API 呼叫失敗,使用預設值:', railwayError.message);
    }

    // 5. 組合完整使用者資料
    const userData = {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator) % 5}.png`,
      ...gameData
    };

    // 6. 傳回前端
    const userDataEncoded = encodeURIComponent(JSON.stringify(userData));
    res.redirect(`https://pjsk-practicehouse-site.vercel.app/?login=success&userData=${userDataEncoded}`);
    
  } catch (error) {
    console.error('Discord OAuth Error:', error.response?.data || error.message);
    res.redirect(`https://pjsk-practicehouse-site.vercel.app/?login=failed&error=${encodeURIComponent(error.message)}`);
  }
};