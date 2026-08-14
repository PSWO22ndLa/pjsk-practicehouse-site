const GUILD = "1361172587417305130";
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) { console.error("需要 DISCORD_BOT_TOKEN 環境變數"); process.exit(1); }

const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD}/roles`, {
  headers: { Authorization: `Bot ${token}` }
});
if (!res.ok) { console.error(res.status, await res.text()); process.exit(1); }

const roles = await res.json();
roles.sort((a, b) => b.position - a.position);
console.log("pos   ID                    名稱");
for (const r of roles) {
  console.log(String(r.position).padStart(3), r.id.padEnd(20), r.name);
}
