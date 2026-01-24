module.exports = (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ 
      error: 'Missing environment variables',
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri
    });
  }
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
  
  res.redirect(discordAuthUrl);
};