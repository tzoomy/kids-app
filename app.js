'use strict';
// ===== Data =====
const FOODS=[
 {e:'🍎',en:'apple',fr:'pomme',frG:'f',he:'תפוח',color:'red'},
 {e:'🍌',en:'banana',fr:'banane',frG:'f',he:'בננה',color:'yellow'},
 {e:'🥕',en:'carrot',fr:'carotte',frG:'f',he:'גזר',color:'orange'},
 {e:'🍇',en:'grapes',fr:'raisin',frG:'m',he:'ענבים',color:'purple'},
 {e:'🧀',en:'cheese',fr:'fromage',frG:'m',he:'גבינה',color:'yellow'},
 {e:'🍓',en:'strawberry',fr:'fraise',frG:'f',he:'תות',color:'red'},
 {e:'🥦',en:'broccoli',fr:'brocoli',frG:'m',he:'ברוקולי',color:'green'},
 {e:'🍪',en:'cookie',fr:'biscuit',frG:'m',he:'עוגייה',color:'brown'},
 {e:'🥚',en:'egg',fr:'œuf',frG:'m',he:'ביצה',color:'white'},
 {e:'🍐',en:'pear',fr:'poire',frG:'f',he:'אגס',color:'green'},
 {e:'🍊',en:'orange',fr:'orange',frG:'f',he:'תפוז',color:'orange'},
 {e:'🐟',en:'fish',fr:'poisson',frG:'m',he:'דג',color:'blue'}];
const ANIMALS=['🐻','🐰','🐵','🐶','🐱','🐼','🦁','🐸','🐷','🐨'];
const NUM_EN=['zero','one','two','three','four'],NUM_FR=['zéro','un','deux','trois','quatre'];
const PLURAL_EN={strawberry:'strawberries',cheese:'cheese',fish:'fish',grapes:'grapes',broccoli:'broccoli'};
const PLURAL_FR={œuf:'œufs',fromage:'fromages',raisin:'raisins',poisson:'poissons',brocoli:'brocolis'};
// ===== State =====
const DEF={settings:{learnMin:10,leisureMin:5,dailyEarnCapMin:30,idleSec:20,langs:'both'},
 profiles:[{id:'a',name:'הקטנה',avatar:'🦄',mode:'little'},{id:'b',name:'הגדולה',avatar:'🦋',mode:'big'}],data:{}};
let S=load();function load(){try{const s=JSON.parse(localStorage.getItem('ar_state'));if(s&&s.profiles)return Object.assign(structuredClone(DEF),s)}catch(e){}return structuredClone(DEF)}
function save(){localStorage.setItem('ar_state',JSON.stringify(S))}
const today=()=>new Date().toISOString().slice(0,10);
function pd(id){let d=S.data[id];if(!d)d=S.data[id]={activeSec:0,balanceSec:0,earnedTodaySec:0,day:today(),stars:0,carry:0};
 if(d.day!==today()){d.day=today();d.earnedTodaySec=0}return d}
let cur=null,lastInteract=0,tick=null;
const $=s=>document.querySelector(s),app=$('#app');
function h(html){app.innerHTML=html}
document.addEventListener('pointerdown',()=>{lastInteract=Date.now();audio()},true);
// ===== Audio =====
let AC;function audio(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume()}
function tone(f,t=0.15,type='sine',delay=0,vol=.25){if(!AC)return;const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;const s=AC.currentTime+delay;g.gain.setValueAtTime(vol,s);g.gain.exponentialRampToValueAtTime(.001,s+t);o.connect(g).connect(AC.destination);o.start(s);o.stop(s+t)}
const sfx={yay(){[523,659,784,1047].forEach((f,i)=>tone(f,.2,'triangle',i*.09))},oops(){tone(300,.15,'sine');tone(240,.2,'sine',.12)},pop(){tone(600+Math.random()*500,.08,'square',0,.12)},tap(){tone(440,.06,'triangle',0,.15)},end(){[784,659,523].forEach((f,i)=>tone(f,.35,'sine',i*.25))}};
// ===== TTS =====
let voices=[];function loadV(){voices=speechSynthesis.getVoices()}if('speechSynthesis'in window){loadV();speechSynthesis.onvoiceschanged=loadV}
function say(text,lang,rate=.85){if(!('speechSynthesis'in window))return false;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=rate;u.pitch=1.15;
 const v=voices.find(v=>v.lang.replace('_','-').toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2)));if(v)u.voice=v;speechSynthesis.speak(u);return true}
// ===== Activity timer =====
function startTick(){stopTick();tick=setInterval(()=>{if(!cur)return;const d=pd(cur.id),st=S.settings;
 if(Date.now()-lastInteract<st.idleSec*1000&&!document.hidden){d.activeSec++;
  const capSec=st.dailyEarnCapMin*60;if(d.earnedTodaySec<capSec){const per=st.leisureMin/st.learnMin;d.carry+=per;const w=Math.floor(d.carry);if(w>0){const add=Math.min(w,capSec-d.earnedTodaySec);d.balanceSec+=add;d.earnedTodaySec+=add;d.carry-=w}}
  save();updHud()}},1000)}
function stopTick(){clearInterval(tick);tick=null}
const fmt=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function updHud(){const d=pd(cur.id),b=$('#bal'),p=$('#prog');if(b)b.textContent=fmt(d.balanceSec);if(p){const cap=S.settings.dailyEarnCapMin*60;p.style.width=Math.min(100,d.earnedTodaySec/cap*100)+'%'}const st=$('#stars');if(st)st.textContent=d.stars}
// ===== Screens =====
function home(){stopTick();cur=null;speechSynthesis&&speechSynthesis.cancel();
 h(`<div class="screen"><h1>🍽️ מסעדת החיות</h1><div style="font-size:clamp(20px,4.5vmin,36px)">מי משחקת?</div><div class="row">${S.profiles.map(p=>{const d=pd(p.id);return`<button class="btn profile" data-p="${p.id}">${p.avatar}<small>${p.name}</small><small>⏳ ${fmt(d.balanceSec)}</small></button>`}).join('')}</div>
 <button class="pill" id="parent" style="position:absolute;bottom:2vmin;left:2vmin">🔒 הורים</button></div>`);
 app.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{sfx.tap();cur=S.profiles.find(p=>p.id===b.dataset.p);menu()});$('#parent').onclick=gate}
function menu(){stopTick();const d=pd(cur.id);
 h(`<div class="screen"><div class="top"><button class="pill" id="back">🏠</button><span class="pill">${cur.avatar} ${cur.name}</span></div>
 <h1>שלום ${cur.name}!</h1>
 <div class="row"><button class="btn" id="play" style="font-size:clamp(28px,7vmin,60px)">🍽️ למסעדה</button>
 <button class="btn" id="fun" ${d.balanceSec<1?'disabled style="opacity:.5"':''}>🎨 זמן פנאי<br><span style="font-size:.7em">⏳ ${fmt(d.balanceSec)}</span></button></div>
 <div class="note">⭐ ${d.stars} כוכבים &nbsp;|&nbsp; צבירה היום: ${fmt(d.earnedTodaySec)} מתוך ${S.settings.dailyEarnCapMin}:00</div></div>`);
 $('#back').onclick=home;$('#play').onclick=()=>{lastInteract=Date.now();game()};$('#fun').onclick=()=>pd(cur.id).balanceSec>=1&&leisurePick()}
// ===== Game =====
let round=null;
function pickLang(){const l=S.settings.langs;return l==='both'?(Math.random()<.5?'en':'fr'):l}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function makeRound(){const little=cur.mode==='little',lang=pickLang(),animal=ANIMALS[Math.random()*ANIMALS.length|0];
 const n=little?2:(pd(cur.id).stars>8?4:3);const items=shuffle(FOODS.slice()).slice(0,n);const target=items[0];
 if(little)return{lang,animal,choices:shuffle(items.map(f=>({food:f,count:1}))),target:{food:target,count:1},text:phrase(lang,target,1)};
 // big: count variation — same food, different counts, or different foods
 const useCount=Math.random()<.5;
 if(useCount){const cnts=shuffle([1,2,3,4]).slice(0,n);const ch=cnts.map(c=>({food:target,count:c}));const t=ch[0];return{lang,animal,choices:shuffle(ch),target:t,text:phrase(lang,target,t.count)}}
 return{lang,animal,choices:shuffle(items.map(f=>({food:f,count:1}))),target:{food:target,count:1},text:phrase(lang,target,1)}}
function phrase(lang,f,c){if(lang==='en'){const w=c===1?(/^[aeio]/.test(f.en)?'an ':'a ')+f.en:NUM_EN[c]+' '+(PLURAL_EN[f.en]||f.en+'s');return`I want ${w}, please!`}
 const w=c===1?(f.frG==='f'?'une ':'un ')+f.fr:NUM_FR[c]+' '+(PLURAL_FR[f.fr]||f.fr+'s');return`Je voudrais ${w}, s'il te plaît !`}
function speakRound(){say(round.text,round.lang==='en'?'en-US':'fr-FR')}
function game(){round=makeRound();round.tries=0;const little=cur.mode==='little';
 h(`<div class="screen"><div class="top"><button class="pill" id="back">⬅️</button><div class="prog"><div id="prog"></div></div><span class="pill">⭐ <span id="stars"></span></span><span class="pill">⏳ <span id="bal"></span></span></div>
 <div class="animal" id="an">${round.animal}</div>
 <div class="bubble" id="bub">${round.lang==='en'?'🇬🇧':'🇫🇷'} ${round.text} 🔊</div>
 <div class="choices">${round.choices.map((c,i)=>`<button class="choice ${little?'big':'small'}" data-i="${i}">${c.food.e.repeat(c.count)}</button>`).join('')}</div></div>`);
 startTick();updHud();$('#back').onclick=menu;$('#an').onclick=$('#bub').onclick=speakRound;
 setTimeout(speakRound,300);
 if(little)round.hintT=setTimeout(hint,6000);
 app.querySelectorAll('.choice').forEach(b=>b.onclick=()=>choose(b,round.choices[b.dataset.i]))}
function hint(){const i=round.choices.indexOf(round.choices.find(c=>c.food===round.target.food&&c.count===round.target.count));const b=app.querySelector(`.choice[data-i="${i}"]`);b&&b.classList.add('hint');speakRound()}
function choose(b,c){if(round.done)return;const ok=c.food===round.target.food&&c.count===round.target.count;
 if(ok){round.done=true;clearTimeout(round.hintT);b.classList.add('ok');sfx.yay();burst(b);const d=pd(cur.id);d.stars++;save();updHud();
  setTimeout(()=>say(round.lang==='en'?(['Yummy! Thank you!','Great job!','Delicious!'][Math.random()*3|0]):(['Miam ! Merci !','Bravo !','Délicieux !'][Math.random()*3|0]),round.lang==='en'?'en-US':'fr-FR'),250);
  setTimeout(()=>{cur&&app.querySelector('.choice')&&game()},2200)}
 else{round.tries++;b.classList.remove('no');void b.offsetWidth;b.classList.add('no');
  if(cur.mode==='little'){sfx.tap();hint()}else{sfx.oops();if(round.tries>=2)hint();else speakRound()}}}
function burst(el){const r=el.getBoundingClientRect();for(let i=0;i<8;i++){const s=document.createElement('div');s.className='star';s.textContent=['⭐','✨','💖'][i%3];s.style.left=r.left+r.width/2-25+'px';s.style.top=r.top+r.height/2-25+'px';const a=i/8*Math.PI*2;s.style.setProperty('--dx',Math.cos(a)*160+'px');s.style.setProperty('--dy',Math.sin(a)*160+'px');document.body.appendChild(s);setTimeout(()=>s.remove(),1000)}}
// ===== Leisure =====
let lt=null;
function leisurePick(){stopTick();h(`<div class="screen"><div class="top"><button class="pill" id="back">⬅️</button><span class="pill">⏳ ${fmt(pd(cur.id).balanceSec)}</span></div><h1>מה נשחק?</h1>
 <div class="row"><button class="btn profile" id="draw">🎨<small>ציור</small></button><button class="btn profile" id="bub">🫧<small>בועות</small></button></div></div>`);
 $('#back').onclick=menu;$('#draw').onclick=()=>leisure('draw');$('#bub').onclick=()=>leisure('bubbles')}
function leisure(kind){h(`<div class="screen" style="padding:0"><div class="leisure-wrap" id="lw"></div><div class="top" style="z-index:5"><button class="pill" id="back">⬅️</button><span class="countdown">⏳ <span id="cd"></span></span></div></div>`);
 $('#back').onclick=()=>{endLeisure();menu()};const lw=$('#lw');kind==='draw'?drawToy(lw):bubbleToy(lw);
 const d=pd(cur.id);$('#cd').textContent=fmt(d.balanceSec);
 lt=setInterval(()=>{if(document.hidden)return;d.balanceSec--;save();const c=$('#cd');if(c){c.textContent=fmt(d.balanceSec);if(d.balanceSec<=30)c.style.color='#e2554f'}if(d.balanceSec<=0){d.balanceSec=0;save();endLeisure();endScreen()}},1000)}
function endLeisure(){clearInterval(lt);lt=null;clearInterval(bubT)}
function endScreen(){sfx.end();h(`<div class="screen"><div class="animal">🌙</div><h1>זמן הפנאי נגמר</h1><div style="font-size:clamp(20px,4.5vmin,36px);text-align:center">כל הכבוד! 💛<br>רוצה לבקר שוב את החיות במסעדה?</div>
 <div class="row"><button class="btn" id="play">🍽️ למסעדה</button><button class="btn" id="home">🏠 בית</button></div></div>`);$('#play').onclick=game;$('#home').onclick=home}
function drawToy(lw){const cv=document.createElement('canvas');lw.appendChild(cv);lw.style.background='#fff';const dpr=devicePixelRatio||1;cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;const x=cv.getContext('2d');x.scale(dpr,dpr);x.lineCap=x.lineJoin='round';x.lineWidth=18;
 const cols=['#e2554f','#ff9f43','#ffd93d','#6bcb77','#4d96ff','#9b5de5','#ff6fb5','#333'];let col=cols[0];const pts={};
 const pal=document.createElement('div');pal.className='palette';pal.innerHTML=cols.map((c,i)=>`<div class="sw ${i?'':'sel'}" style="background:${c}" data-c="${c}"></div>`).join('')+'<div class="sw" data-c="clear" style="background:#fff;display:flex;align-items:center;justify-content:center;font-size:28px">🗑️</div>';lw.appendChild(pal);
 pal.onclick=e=>{const c=e.target.dataset.c;if(!c)return;sfx.tap();if(c==='clear'){x.clearRect(0,0,cv.width,cv.height);return}col=c;pal.querySelectorAll('.sw').forEach(s=>s.classList.toggle('sel',s===e.target))};
 cv.onpointerdown=e=>{pts[e.pointerId]=[e.clientX,e.clientY];x.fillStyle=col;x.beginPath();x.arc(e.clientX,e.clientY,9,0,7);x.fill()};
 cv.onpointermove=e=>{const p=pts[e.pointerId];if(!p)return;x.strokeStyle=col;x.beginPath();x.moveTo(p[0],p[1]);x.lineTo(e.clientX,e.clientY);x.stroke();pts[e.pointerId]=[e.clientX,e.clientY]};
 cv.onpointerup=cv.onpointercancel=e=>delete pts[e.pointerId]}
let bubT;function bubbleToy(lw){lw.style.background='linear-gradient(#a1c4fd,#c2e9fb)';
 const spawn=()=>{const b=document.createElement('div');b.className='bubbleToy';const s=60+Math.random()*90;Object.assign(b.style,{width:s+'px',height:s+'px',left:Math.random()*(innerWidth-s)+'px',top:innerHeight+'px'});lw.appendChild(b);
  const dur=5000+Math.random()*4000,t0=performance.now(),x0=parseFloat(b.style.left);(function f(t){if(!b.isConnected)return;const k=(t-t0)/dur;b.style.top=innerHeight-(innerHeight+s)*k+'px';b.style.left=x0+Math.sin(k*8)*30+'px';k<1?requestAnimationFrame(f):b.remove()})(t0);
  b.onpointerdown=()=>{sfx.pop();b.style.transition='transform .15s,opacity .15s';b.style.transform='scale(1.5)';b.style.opacity=0;setTimeout(()=>b.remove(),150)}};
 bubT=setInterval(spawn,600)}
// ===== Parent =====
function gate(){const a=3+Math.random()*7|0,b=3+Math.random()*7|0;h(`<div class="screen"><div class="card"><h2>אזור הורים</h2><p>כמה זה ${a} × ${b}?</p><input id="ans" type="number" inputmode="numeric" style="width:140px"> <button class="btn" id="go" style="min-height:50px;padding:10px 20px">כניסה</button> <button class="btn" id="cancel" style="min-height:50px;padding:10px 20px">ביטול</button></div></div>`);
 $('#cancel').onclick=home;$('#go').onclick=()=>{+$('#ans').value===a*b?parent():home()}}
function parent(){const st=S.settings;h(`<div class="screen"><div class="card"><h2>⚙️ הגדרות הורים</h2>
 <label>דקות למידה פעילה <input id="lm" type="number" min="1" value="${st.learnMin}"></label>
 <label>מרוויחות דקות פנאי <input id="fm" type="number" min="0" value="${st.leisureMin}"></label>
 <label>תקרת צבירה יומית (דקות פנאי) <input id="cap" type="number" min="0" value="${st.dailyEarnCapMin}"></label>
 <label>שניות ללא מגע = לא נספר <input id="idle" type="number" min="5" value="${st.idleSec}"></label>
 <label>שפות <select id="langs" style="font-size:20px"><option value="both">אנגלית + צרפתית</option><option value="en">אנגלית</option><option value="fr">צרפתית</option></select></label>
 <hr>${S.profiles.map((p,i)=>{const d=pd(p.id);return`<label>${p.avatar} שם <input data-n="${i}" value="${p.name}" style="width:140px"><select data-m="${i}" style="font-size:18px"><option value="little">קטנה (2)</option><option value="big">גדולה (5)</option></select></label>
 <div class="note">למידה פעילה סה״כ ${fmt(d.activeSec)} · יתרת פנאי ${fmt(d.balanceSec)} · נצבר היום ${fmt(d.earnedTodaySec)} · ⭐${d.stars} <button data-r="${p.id}">איפוס יתרה</button> <button data-plus="${p.id}">+5 דק׳</button></div>`}).join('')}
 <p class="note">ברירות המחדל (10→5, תקרה 30) הן זמניות עד החלטה.</p>
 <button class="btn" id="sv" style="min-height:50px;padding:10px 20px">שמירה</button> <button class="btn" id="cx" style="min-height:50px;padding:10px 20px">יציאה</button></div></div>`);
 $('#langs').value=st.langs;S.profiles.forEach((p,i)=>app.querySelector(`[data-m="${i}"]`).value=p.mode);
 app.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const d=pd(b.dataset.r);d.balanceSec=0;d.earnedTodaySec=0;d.carry=0;save();parent()});
 app.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{pd(b.dataset.plus).balanceSec+=300;save();parent()});
 $('#cx').onclick=home;$('#sv').onclick=()=>{const n=(id,m)=>Math.max(m,+$(id).value||m);st.learnMin=n('#lm',1);st.leisureMin=n('#fm',0);st.dailyEarnCapMin=n('#cap',0);st.idleSec=n('#idle',5);st.langs=$('#langs').value;
  S.profiles.forEach((p,i)=>{p.name=app.querySelector(`[data-n="${i}"]`).value||p.name;p.mode=app.querySelector(`[data-m="${i}"]`).value});save();home()}}
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
home();
