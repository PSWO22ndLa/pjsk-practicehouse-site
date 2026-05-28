/* ===== 資料（改文字 / 加 img 都在這裡） ===== */
  const ACTIVITIES=[
    {cat:'賽事',date:'Spring 2026',grad:['#2b3a4a','#6b8190'],title:'2026 Spring Championship',text:'最激烈的賽事，挑戰你的實力，爭奪冠軍榮耀，展現你的音遊技術。'},
    {cat:'挑戰',date:'New Release',grad:['#15151c','#3a4a5c'],title:'段位挑戰系統',text:'全新的段位挑戰系統上線，一起練習，感受音樂的樂趣與成長的快樂。'},
    {cat:'創作',date:'Workshop',grad:['#1a2230','#244a6b'],title:'譜面創作工坊',text:'學習譜面製作技巧，分享你的創意，與社群一同成長茁壯。'},
    {cat:'每週',date:'Weekly',grad:['#1a2a33','#3a6675'],title:'每週挑戰賽',text:'每週更新的挑戰曲目，測試你的極限，攀登排行榜頂端。'},
    {cat:'預告',date:'Coming Soon',grad:['#20002c','#3a3897'],title:'特別活動',text:'即將推出全新合作活動，敬請期待，更多驚喜等你來發現。'},
    {cat:'社群',date:'Discord',grad:['#1a2a6c','#2a5298'],title:'社群交流',text:'加入我們的 Discord，與志同道合的玩家一起討論、練習、進步。'}
  ];
  const EVENTS=[
    {grad:['#3f5a6b','#8aa6b5'],cap:'2026 Spring Championship — 爭奪冠軍榮耀的季度賽事'},
    {grad:['#2a2438','#3a4a5c'],cap:'段位挑戰 — 從初心者一路挑戰到頂峰'},
    {grad:['#244a6b','#3a6675'],cap:'每週挑戰賽 — 每週更新的極限曲目'}
  ];
  const EXPLORE=[
    {grad:['#3a6675','#6b8190'],title:'加入 Discord',text:'與其他玩家即時交流，尋求支援與討論。',href:'https://discord.gg/wN3wx48nTB'},
    {grad:['#2a4a55','#3f5a6b'],title:'段位挑戰',text:'測試你的實力，攀上練習屋的段位階梯。',href:'#events'},
    {grad:['#2e2a55','#244a6b'],title:'譜面創作',text:'學習製作譜面，發表你自己的作品。',href:'#activities'},
    {grad:['#1a2a33','#2a5298'],title:'社群交流',text:'認識同好，一起練習、一起進步。',href:'#about'}
  ];
  const STAFF2025=[
    {emoji:'👑',grad:['#2b3a4a','#6b8190'],name:'La.',role:'群主 / 創辦人',desc:'創辦人，負責活動策劃、伺服器管理與網頁設計，確保大家能安心使用群內資源。'},
    {emoji:'❄️',grad:['#15151c','#3a4a5c'],name:'雪白',role:'管理員',desc:'專精譜面節奏與難度設計，致力創造流暢且富挑戰性的遊戲體驗。'},
    {emoji:'🌸',grad:['#1a2230','#244a6b'],name:'萌忻',role:'手續委員',desc:'開服玩家，已遊玩 1500+ 天，負責初始段位確認與課題曲挑戰區裁判。'},
    {emoji:'🍋',grad:['#1a2a33','#3a6675'],name:'檸檬貓',role:'活動與功能委員',desc:'打了音遊二年，最高 FC Apd33 Mas35，負責活動策劃與功能管理。'},
    {emoji:'💙',grad:['#20002c','#3a3897'],name:'小藍',role:'秩序委員長',desc:'設計比賽 Banner 與 Logo，用視覺設計為活動增添專業質感。'},
    {emoji:'🎮',grad:['#1a2a6c','#2a5298'],name:'小祥',role:'秩序委員',desc:'音遊愛好者，常玩プロセカ・ユメステ，也是個愛閒聊的人。'}
  ];
  const STAFF2026=Array.from({length:8},(_,i)=>({
    emoji:['🎀','🎧','🎹','🥁','🎸','🎤','🎺','🎻'][i],
    grad:[['#2b3a4a','#6b8190'],['#15151c','#3a4a5c'],['#1a2230','#244a6b'],['#1a2a33','#3a6675']][i%4],
    name:'成員 '+(i+1),role:'職位',desc:'簡介文字'
  }));

  const g=(a)=>`linear-gradient(135deg,${a[0]} 0%,${a[1]} 100%)`;
  // 有填 img 就用圖片，否則用漸層。img 可放網址或本機路徑，例如 'public/images/xxx.jpg'
  const bg=(o)=> o.img ? `url('${o.img}')` : g(o.grad);

  /* 活動卡片 */
  document.getElementById('activityGrid').innerHTML=ACTIVITIES.map(a=>`
    <article class="ncard reveal">
      <div class="ncard-img" style="background-image:${bg(a)}"><div class="veil"></div><span class="cat-badge">${a.cat}</span></div>
      <div class="ncard-body">
        <div class="ncard-date">${a.date}</div>
        <h3>${a.title}</h3>
        <p>${a.text}</p>
      </div>
    </article>`).join('');

  /* Explore further */
  document.getElementById('efGrid').innerHTML=EXPLORE.map(e=>{
    const ext=e.href.startsWith('http')?'target="_blank" rel="noopener"':'';
    return `<div class="ef reveal">
      <a href="${e.href}" ${ext}><div class="ef-img" style="background-image:${bg(e)}"><div class="veil"></div></div></a>
      <h3><a href="${e.href}" ${ext}>${e.title}</a></h3>
      <p>${e.text}</p>
    </div>`;
  }).join('');

  /* 團隊 */
  const memberHTML=m=>`
    <div class="member reveal">
      <div class="member-bg" style="background-image:${bg(m)}">${m.img?'':m.emoji}</div>
      <div class="member-cap">
        <span class="role-badge">${m.role}</span>
        <h3>${m.name}</h3>
        <p>${m.desc}</p>
      </div>
    </div>`;
  document.getElementById('team2025').innerHTML=STAFF2025.map(memberHTML).join('');
  document.getElementById('team2026').innerHTML=STAFF2026.map(memberHTML).join('');

  /* Top Events 舞台輪播 */
  const stage=document.getElementById('eventStage');
  stage.innerHTML=EVENTS.map((e,i)=>`
    <div class="estage ${i===0?'active':''}" style="background-image:${bg(e)}">
      <div class="cap">${e.cap}</div>
    </div>`).join('');
  const eSlides=stage.querySelectorAll('.estage');
  const eDotsWrap=document.getElementById('eventDots');
  let eCur=0;
  EVENTS.forEach((_,i)=>{const b=document.createElement('button');if(i===0)b.classList.add('active');b.onclick=()=>eGo(i);eDotsWrap.appendChild(b);});
  const eDots=eDotsWrap.querySelectorAll('button');
  function eGo(i){eSlides[eCur].classList.remove('active');eDots[eCur].classList.remove('active');eCur=i;eSlides[eCur].classList.add('active');eDots[eCur].classList.add('active');}
  setInterval(()=>eGo((eCur+1)%eSlides.length),5500);

  /* Hero 輪播 */
  const slides=document.querySelectorAll('.slide');
  const hDotsWrap=document.getElementById('heroDots');
  let cur=0;
  slides.forEach((_,i)=>{const b=document.createElement('button');if(i===0)b.classList.add('active');b.onclick=()=>go(i);hDotsWrap.appendChild(b);});
  const hDots=hDotsWrap.querySelectorAll('button');
  function go(i){slides[cur].classList.remove('active');hDots[cur].classList.remove('active');cur=(i+slides.length)%slides.length;slides[cur].classList.add('active');hDots[cur].classList.add('active');}
  let heroTimer=setInterval(()=>go(cur+1),6000);
  function reset(){clearInterval(heroTimer);heroTimer=setInterval(()=>go(cur+1),6000);}
  document.getElementById('heroNext').onclick=()=>{go(cur+1);reset();};
  document.getElementById('heroPrev').onclick=()=>{go(cur-1);reset();};

  /* Nav scroll + 漢堡 */
  const nav=document.getElementById('nav');
  addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>60));
  const burger=document.getElementById('burger'),drawer=document.getElementById('drawer');
  burger.onclick=()=>{burger.classList.toggle('open');drawer.classList.toggle('open');};
  drawer.querySelectorAll('a').forEach(a=>a.onclick=()=>{burger.classList.remove('open');drawer.classList.remove('open');});

  /* Reveal */
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* ===================================================================
   登入 / 等級 / 稱號（沿用原本的 Discord OAuth + Railway API）
   =================================================================== */
const API_URL='https://labotcode-production.up.railway.app';
let currentUser=null, userTitles=[], equippedTitles=[null,null,null], editingSlot=null;

const TITLE_DATABASE={
  beginner:{name:'プロセカ初心者'},bronze:{name:'プロセカ青銅者'},silver:{name:'プロセカ白銀者'},
  gold:{name:'プロセカ黃金者'},platinum:{name:'プロセカ白金者'},diamond:{name:'プロセカ鑽石者'},
  master:{name:'プロセカ大師'},peak:{name:'プロセカ巔峰者'},
  demigod:{name:'プロセカ 亞神'},god:{name:'プロセカ 神'},revelation:{name:'プロセカ 天啓'},
  creator:{name:'プロセカ 創神者'},infinity:{name:'プロセカ ∞'},
  admin_2025:{name:'2025 管管'},staff_2025:{name:'2025 幹部'},contributor:{name:'特殊貢獻者'}
};

/* 等級 */
const LEVELS=(()=>{const a=[0];let s=5;for(let i=1;i<100;i++){a.push(a[i-1]+s);s+=2;}return a;})();
function calcLevel(m){if(!m)return 1;for(let i=LEVELS.length-1;i>=0;i--){if(m>=LEVELS[i])return i+1;}return 1;}
function nextLvInfo(m){m=m||0;const lv=calcLevel(m);if(lv>=LEVELS.length)return '已達最高等級';return `再發 ${LEVELS[lv]-m} 次言即可升到 Lv.${lv+1}`;}
function lvColor(lv){
  if(lv<30)return '#1c1c1e';
  if(lv<50)return '#3a6fb0';
  if(lv<70)return '#7a4fae';
  if(lv<90)return 'linear-gradient(135deg,#caa14a,#e0b24a)';
  if(lv<100)return 'linear-gradient(135deg,#d98032,#c0402e)';
  return 'linear-gradient(135deg,#d9c067,#cf7fa8,#5fb5bd)';
}
function rankTier(rank){
  if(rank==='プロセカ ∞')return 'infinity';
  if(['プロセカ 創神者','プロセカ 天啓','プロセカ 神','プロセカ 亞神'].includes(rank))return 'god';
  return '';
}

/* 元素 */
const $=(id)=>document.getElementById(id);
const mainContent=$('mainContent'), profilePage=$('profilePage');

/* 介面更新（導覽列） */
function updateAuthUI(){
  const loginBtn=$('loginBtn'), chip=$('userChip'), dAuth=$('drawerAuth');
  if(currentUser){
    loginBtn.style.display='none';
    chip.style.display='flex';
    $('navAvatar').src=currentUser.avatar||'';
    $('navName').textContent=currentUser.username||'';
    dAuth.textContent='登出';
  }else{
    loginBtn.style.display='';
    chip.style.display='none';
    dAuth.textContent='登入';
  }
}

/* 導航 */
function navigateTo(page){
  if(page==='profile'){
    if(!currentUser){alert('請先登入！');return;}
    showProfile();
  }else{
    profilePage.classList.remove('active');
    mainContent.style.display='';
    window.scrollTo({top:0,behavior:'smooth'});
  }
}

/* 個人頁 */
function showProfile(){
  if(!currentUser)return;
  profilePage.className='profile-page active'+(rankTier(currentUser.rank)?' tier-'+rankTier(currentUser.rank):'');
  mainContent.style.display='none';
  $('pAvatar').src=currentUser.avatar||'';
  $('pName').textContent=currentUser.username||'使用者';
  updateProfileUI();
  window.scrollTo({top:0,behavior:'instant'in window?'instant':'auto'});
  refreshProfileData();
}
function updateProfileUI(){
  if(!currentUser)return;
  const m=currentUser.messageCount||0, lv=calcLevel(m), col=lvColor(lv);
  $('statAch').textContent=(currentUser.achievements||[]).length;
  $('statPts').textContent=currentUser.totalPoints||0;
  $('statLv').textContent=lv;
  const dl=$('displayLevel'); dl.textContent=lv;
  if(col.startsWith('linear-gradient')){dl.style.background=col;dl.style.webkitBackgroundClip='text';dl.style.backgroundClip='text';dl.style.webkitTextFillColor='transparent';}
  else{dl.style.background='none';dl.style.webkitTextFillColor='';dl.style.color=col;}
  $('messageCount').textContent=m;
  $('nextLevelInfo').textContent=nextLvInfo(m);
  const al=$('achievementsList');
  al.innerHTML=(currentUser.achievements&&currentUser.achievements.length)
    ? currentUser.achievements.map(a=>`<div class="achievement-item"><div class="achievement-name">${a.name} (+${a.points}pt)</div><div class="achievement-desc">${a.description||''}</div></div>`).join('')
    : '<p class="empty">尚無成就記錄</p>';
  renderEquipped();
}

/* 稱號 */
function renderEquipped(){
  const c=$('equippedTitles'); c.innerHTML='';
  for(let i=0;i<3;i++){
    const id=equippedTitles[i], slot=document.createElement('div');
    slot.className='title-slot';
    if(id&&TITLE_DATABASE[id]){slot.textContent=TITLE_DATABASE[id].name;slot.onclick=()=>unequipTitle(i);}
    else{slot.classList.add('empty');slot.textContent='＋ 裝備稱號';slot.onclick=()=>openTitleModal(i);}
    c.appendChild(slot);
  }
}
function openTitleModal(slot){
  if(!currentUser){alert('請先登入');return;}
  editingSlot=slot;
  const list=$('titleList'); list.innerHTML='';
  if(!userTitles.length){list.innerHTML='<p class="empty">你還沒有解鎖任何稱號</p>';}
  else userTitles.forEach(id=>{
    const t=TITLE_DATABASE[id]; if(!t)return;
    const item=document.createElement('div'); item.className='title-item'; item.textContent=t.name;
    if(equippedTitles.includes(id)){item.classList.add('equipped');item.textContent+='（已裝備）';}
    item.onclick=()=>equipTitle(id,slot);
    list.appendChild(item);
  });
  $('titleModal').classList.add('active');
}
function closeTitleModal(){$('titleModal').classList.remove('active');editingSlot=null;}
async function equipTitle(id,slot){
  try{
    const r=await fetch(`${API_URL}/api/titles?userId=${currentUser.id}&action=equip`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({titleId:id,slot})});
    const d=await r.json();
    if(d.success){equippedTitles=d.equippedTitles;renderEquipped();closeTitleModal();}
    else alert(d.message||'裝備失敗');
  }catch(e){
    // API 不可用時的本機回退，讓 UI 仍可操作
    const ex=equippedTitles.indexOf(id); if(ex!==-1)equippedTitles[ex]=null;
    equippedTitles[slot]=id; renderEquipped(); closeTitleModal();
  }
}
async function unequipTitle(slot){
  if(!confirm('確定要卸下這個稱號嗎？'))return;
  try{
    const r=await fetch(`${API_URL}/api/titles?userId=${currentUser.id}&action=unequip`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({slot})});
    const d=await r.json();
    if(d.success){equippedTitles=d.equippedTitles;renderEquipped();}
  }catch(e){equippedTitles[slot]=null;renderEquipped();}
}

/* 讀取稱號 / 發言數 */
async function loadUserTitles(userId){
  if(!userId)return;
  try{
    const r=await fetch(`${API_URL}/api/user/${userId}/titles`,{credentials:'include'});
    const d=await r.json();
    if(d){
      userTitles=d.specialTitles||userTitles||[];
      equippedTitles=d.equippedTitles||equippedTitles;
      if(d.messageCount!==undefined)currentUser.messageCount=d.messageCount;
      localStorage.setItem('discordUser',JSON.stringify(currentUser));
    }
  }catch(e){console.warn('載入稱號資料失敗（API 可能未啟動）',e);}
}
async function refreshProfileData(){
  if(!currentUser)return;
  const btn=$('refreshBtn'); if(btn){btn.disabled=true;btn.textContent='更新中…';}
  try{
    const r=await fetch(`${API_URL}/api/user/${currentUser.id}/titles`);
    const d=await r.json();
    if(d){
      currentUser.messageCount=d.messageCount??currentUser.messageCount??0;
      currentUser.achievements=d.achievements||currentUser.achievements||[];
      currentUser.totalPoints=d.totalPoints??currentUser.totalPoints??0;
      if(d.specialTitles)userTitles=d.specialTitles;
      if(d.equippedTitles)equippedTitles=d.equippedTitles;
      localStorage.setItem('discordUser',JSON.stringify(currentUser));
      updateProfileUI();
    }
  }catch(e){console.warn('更新失敗（API 可能未啟動）',e);}
  finally{if(btn){btn.disabled=false;btn.textContent='更新';}}
}

/* 登入 / 登出 */
function loginWithDiscord(){
  const clientId='1407405904000979045';
  const redirectUri='https://pjsk-practicehouse-site.vercel.app/api/auth/callback';
  const scope='identify guilds.members.read';
  location.href=`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
}
function logout(){
  if(!confirm('確定要登出嗎？'))return;
  localStorage.removeItem('discordUser');
  currentUser=null;userTitles=[];equippedTitles=[null,null,null];
  updateAuthUI();navigateTo('home');
}

/* 事件接線 */
$('loginBtn').onclick=loginWithDiscord;
$('userChip').onclick=()=>navigateTo('profile');
$('profileBack').onclick=()=>navigateTo('home');
$('logoutBtn').onclick=logout;
$('refreshBtn').onclick=refreshProfileData;
$('tmodalClose').onclick=closeTitleModal;
$('titleModal').addEventListener('click',e=>{if(e.target.id==='titleModal')closeTitleModal();});
$('drawerProfile').onclick=(e)=>{e.preventDefault();navigateTo('profile');};
$('drawerAuth').onclick=(e)=>{e.preventDefault();currentUser?logout():loginWithDiscord();};

/* 初始化：解析 OAuth 回傳 / 還原登入狀態 */
(async function authInit(){
  const params=new URLSearchParams(location.search);
  if(params.get('login')==='success'){
    const ud=params.get('userData');
    if(ud){
      try{
        currentUser=JSON.parse(decodeURIComponent(ud));
        localStorage.setItem('discordUser',JSON.stringify(currentUser));
        await loadUserTitles(currentUser.id);
      }catch(e){alert('登入資料處理失敗，請重試');}
    }
    history.replaceState({},document.title,location.pathname);
  }else if(params.get('login')==='failed'){
    alert('登入失敗，請重試');
    history.replaceState({},document.title,location.pathname);
  }else{
    const saved=localStorage.getItem('discordUser');
    if(saved){try{currentUser=JSON.parse(saved);await loadUserTitles(currentUser.id);}catch(e){localStorage.removeItem('discordUser');}}
  }
  updateAuthUI();
})();