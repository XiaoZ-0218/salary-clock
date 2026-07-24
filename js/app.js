// ==================== 节假日数据 ====================
const HOLIDAYS_2024 = {
'2024-01-01':{name:'元旦'},'2024-02-09':{name:'除夕'},'2024-02-10':{name:'春节'},'2024-02-11':{name:'春节'},'2024-02-12':{name:'春节'},'2024-02-13':{name:'春节'},'2024-02-14':{name:'春节'},'2024-02-15':{name:'春节'},'2024-02-16':{name:'春节'},'2024-02-17':{name:'春节'},'2024-04-04':{name:'清明'},'2024-04-05':{name:'清明'},'2024-04-06':{name:'清明'},'2024-05-01':{name:'劳动节'},'2024-05-02':{name:'劳动节'},'2024-05-03':{name:'劳动节'},'2024-05-04':{name:'劳动节'},'2024-05-05':{name:'劳动节'},'2024-06-10':{name:'端午'},'2024-09-15':{name:'中秋'},'2024-09-16':{name:'中秋'},'2024-09-17':{name:'中秋'},'2024-10-01':{name:'国庆'},'2024-10-02':{name:'国庆'},'2024-10-03':{name:'国庆'},'2024-10-04':{name:'国庆'},'2024-10-05':{name:'国庆'},'2024-10-06':{name:'国庆'},'2024-10-07':{name:'国庆'},
};
const WORKDAYS_2024 = {'2024-02-04':{name:'春节调休'},'2024-02-18':{name:'春节调休'},'2024-04-07':{name:'清明调休'},'2024-04-28':{name:'劳动节调休'},'2024-05-11':{name:'劳动节调休'},'2024-09-14':{name:'中秋调休'},'2024-09-29':{name:'国庆调休'},'2024-10-12':{name:'国庆调休'}};
const HOLIDAYS_2025 = {'2025-01-01':{name:'元旦'},'2025-01-28':{name:'除夕'},'2025-01-29':{name:'春节'},'2025-01-30':{name:'春节'},'2025-01-31':{name:'春节'},'2025-02-01':{name:'春节'},'2025-02-02':{name:'春节'},'2025-02-03':{name:'春节'},'2025-02-04':{name:'春节'},'2025-04-04':{name:'清明'},'2025-04-05':{name:'清明'},'2025-04-06':{name:'清明'},'2025-05-01':{name:'劳动节'},'2025-05-02':{name:'劳动节'},'2025-05-03':{name:'劳动节'},'2025-05-04':{name:'劳动节'},'2025-05-05':{name:'劳动节'},'2025-05-31':{name:'端午'},'2025-06-01':{name:'端午'},'2025-06-02':{name:'端午'},'2025-10-01':{name:'国庆'},'2025-10-02':{name:'国庆'},'2025-10-03':{name:'国庆'},'2025-10-04':{name:'国庆'},'2025-10-05':{name:'国庆'},'2025-10-06':{name:'国庆'},'2025-10-07':{name:'国庆'},'2025-10-08':{name:'国庆'}};
const WORKDAYS_2025 = {'2025-01-26':{name:'春节调休'},'2025-02-08':{name:'春节调休'},'2025-04-27':{name:'劳动节调休'},'2025-09-28':{name:'国庆调休'},'2025-10-11':{name:'国庆调休'}};
const HOLIDAYS_2026 = {'2026-01-01':{name:'元旦'},'2026-01-02':{name:'元旦'},'2026-01-03':{name:'元旦'},'2026-02-15':{name:'春节'},'2026-02-16':{name:'除夕'},'2026-02-17':{name:'春节'},'2026-02-18':{name:'春节'},'2026-02-19':{name:'春节'},'2026-02-20':{name:'春节'},'2026-02-21':{name:'春节'},'2026-02-22':{name:'春节'},'2026-02-23':{name:'春节'},'2026-04-04':{name:'清明'},'2026-04-05':{name:'清明'},'2026-04-06':{name:'清明'},'2026-05-01':{name:'劳动节'},'2026-05-02':{name:'劳动节'},'2026-05-03':{name:'劳动节'},'2026-05-04':{name:'劳动节'},'2026-05-05':{name:'劳动节'},'2026-06-19':{name:'端午'},'2026-06-20':{name:'端午'},'2026-06-21':{name:'端午'},'2026-09-25':{name:'中秋'},'2026-09-26':{name:'中秋'},'2026-09-27':{name:'中秋'},'2026-10-01':{name:'国庆'},'2026-10-02':{name:'国庆'},'2026-10-03':{name:'国庆'},'2026-10-04':{name:'国庆'},'2026-10-05':{name:'国庆'},'2026-10-06':{name:'国庆'},'2026-10-07':{name:'国庆'}};
const WORKDAYS_2026 = {'2026-01-04':{name:'元旦调休'},'2026-02-14':{name:'春节调休'},'2026-02-28':{name:'春节调休'},'2026-05-09':{name:'劳动节调休'},'2026-09-20':{name:'国庆调休'},'2026-10-10':{name:'国庆调休'}};
function getHolidayInfo(d){return HOLIDAYS_2024[d]||HOLIDAYS_2025[d]||HOLIDAYS_2026[d]||null;}
function getWorkdayInfo(d){return WORKDAYS_2024[d]||WORKDAYS_2025[d]||WORKDAYS_2026[d]||null;}

// ==================== 状态管理 ====================
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = null;
let customStatus = JSON.parse(localStorage.getItem('salaryCustomStatus')||'{}');
function saveCustomStatus(){localStorage.setItem('salaryCustomStatus',JSON.stringify(customStatus));}

function getStatus(dateStr){
if(customStatus[dateStr])return customStatus[dateStr];
if(getHolidayInfo(dateStr))return{type:'holiday'};
return null;
}

// 判断某日工作比例：0=全休，0.5=半天，1=全天
function getWorkRatio(date){
const ds = formatDate(date);
const st = getStatus(ds);
if(st){
if(st.type === 'work') return 1;
if(st.type === 'holiday') return 0;
if(st.type === 'company-full') return 0;
if(st.type === 'personal-full') return 0;
if(st.type === 'personal-am' || st.type === 'personal-pm') return 0.5;
}
if(getWorkdayInfo(ds)) return 1;
if(getHolidayInfo(ds)) return 0;
const day = date.getDay();
if(day === 0 || day === 6) return 0;
return 1;
}

function isRestDay(date){ return getWorkRatio(date) === 0; }

function isWorkDay(date){
const ratio = getWorkRatio(date);
if(ratio === 1) return true;
if(ratio === 0.5) return 'half';
return false;
}

// ==================== 工具 ====================
function formatDate(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${day}`;}
function formatMoney(n){return'¥'+n.toLocaleString('zh-CN',{minimumFractionDigits:4,maximumFractionDigits:4});}
function formatMoneyShort(n){return'¥'+n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
function parseTime(ts){const[h,m]=ts.split(':').map(Number);return h*60+m;}
function addMinutes(ts,min){const total=parseTime(ts)+min;const h=Math.floor(total/60),m=total%60;return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}

// ==================== 时间选项 ====================
const START_OPTIONS=['09:00','09:30','10:00','10:30','11:00'];
const END_OPTIONS=['17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];
const LUNCH_DURATIONS=[{label:'0.5小时',min:30},{label:'1小时',min:60},{label:'1.5小时',min:90},{label:'2小时',min:120},{label:'2.5小时',min:150},{label:'无',min:0}];
const LUNCH_START_OPTIONS=['11:00','11:30','12:00','12:30','13:00'];

// ==================== 主题配置 ====================
const THEME_OPTIONS=[
{key:'aurora',name:'极光舞台',swatch:'linear-gradient(135deg,#101422,#3b1e77 42%,#0f766e)',dot:'#75f0cf',dotShadow:'0 0 10px rgba(117,240,207,0.9)',nameColor:'#ffffff'},
{key:'cyber',name:'霓虹终端',swatch:'linear-gradient(135deg,#030507,#08110f 55%,#2a0634)',dot:'#00ff9d',dotShadow:'0 0 12px rgba(0,255,157,0.95)',nameColor:'#eafff6'},
{key:'warm',name:'樱桃汽水',swatch:'linear-gradient(135deg,#fff7fb,#ffe4ef 48%,#d8fff3)',dot:'#e11d48',dotShadow:'0 0 0 4px rgba(20,184,166,0.20)',nameColor:'#2a1719'},
{key:'ocean',name:'深海声呐',swatch:'linear-gradient(135deg,#061923,#083344 58%,#36e2ff)',dot:'#36e2ff',dotShadow:'0 0 12px rgba(54,226,255,0.85)',nameColor:'#ecfeff'},
{key:'mono',name:'黑白杂志',swatch:'linear-gradient(135deg,#f7f7f2 0 46%,#111 46% 54%,#f7f7f2 54%)',dot:'#111111',dotShadow:'none',nameColor:'#111111'},
{key:'forest',name:'松林晨雾',swatch:'linear-gradient(135deg,#eafff6,#8ee9c2 48%,#173f35)',dot:'#0f766e',dotShadow:'0 0 0 4px rgba(245,158,11,0.20)',nameColor:'#0f2f28'},
{key:'ledger',name:'黑金账本',swatch:'linear-gradient(135deg,#080a0d,#15181e 54%,#facc15)',dot:'#facc15',dotShadow:'0 0 10px rgba(250,204,21,0.65)',nameColor:'#f8fafc'},
{key:'arcade',name:'像素街机',swatch:'linear-gradient(135deg,#121019,#30115e 44%,#042f2e)',dot:'#f59e0b',dotShadow:'4px 4px 0 rgba(34,211,238,0.75)',nameColor:'#fff7ed'}
];
const DEFAULT_THEME='aurora';
function normalizeTheme(theme){return THEME_OPTIONS.some(t=>t.key===theme)?theme:DEFAULT_THEME;}

let state=JSON.parse(localStorage.getItem('salaryClockState')||'{}');
// 版本迁移：新默认值 10:00/18:30/2h/12:00
if(!state.version||state.version<2){
state.startTime='10:00';
state.endTime='18:30';
state.lunchDurationMin=120;
state.lunchStart='12:00';
state.version=2;
localStorage.setItem('salaryClockState',JSON.stringify(state));
}
state.theme=normalizeTheme(state.theme||DEFAULT_THEME);
if(!state.mode)state.mode='work';

function saveState(){
state.monthlySalary=document.getElementById('monthlySalary').value;
localStorage.setItem('salaryClockState',JSON.stringify(state));
}

// ==================== 主题 ====================
function renderThemeGrid(){
const grid=document.getElementById('themeGrid');
grid.innerHTML=THEME_OPTIONS.map(theme=>{
const active=state.theme===theme.key?' active':'';
const style=[
`--theme-swatch:${theme.swatch}`,
`--theme-dot:${theme.dot}`,
`--theme-dot-shadow:${theme.dotShadow}`,
`--theme-name-color:${theme.nameColor}`
].join(';');
return `<button type="button" class="theme-card${active}" data-theme="${theme.key}" style="${style}" onclick="selectTheme('${theme.key}')" aria-label="切换到${theme.name}主题"><div class="theme-dot"></div><div class="theme-name">${theme.name}</div></button>`;
}).join('');
}
function selectTheme(theme){
state.theme=normalizeTheme(theme);
applyTheme();
saveState();
}
function applyTheme(){
state.theme=normalizeTheme(state.theme);
const themeClass='theme-'+state.theme;
document.documentElement.className=themeClass;
document.body.className=themeClass;
const bg=getComputedStyle(document.body).getPropertyValue('--bg').trim()||'#101422';
document.documentElement.style.backgroundColor=bg;
const themeColor=document.querySelector('meta[name="theme-color"]');
if(themeColor)themeColor.setAttribute('content',bg);
renderThemeGrid();
}

// ==================== 渲染控件 ====================
const MODES=[{key:'work',label:'上班才赚钱'},{key:'always',label:'随时都赚钱'}];
function renderModeGrid(){const grid=document.getElementById('modeGrid');grid.innerHTML=MODES.map(m=>`<button class="time-btn${state.mode===m.key?' active':''}" onclick="selectMode('${m.key}')">${m.label}</button>`).join('');}
function selectMode(key){state.mode=key;saveState();renderModeGrid();updateAll();}

function renderStartTimeGrid(){const grid=document.getElementById('startTimeGrid');grid.innerHTML=START_OPTIONS.map(t=>`<button class="time-btn${state.startTime===t?' active':''}" onclick="selectStartTime('${t}')">${t}</button>`).join('');}
function renderEndTimeGrid(){const grid=document.getElementById('endTimeGrid');grid.innerHTML=END_OPTIONS.map(t=>`<button class="time-btn${state.endTime===t?' active':''}" onclick="selectEndTime('${t}')">${t}</button>`).join('');}
function renderLunchDuration(){const row=document.getElementById('lunchDurationRow');row.innerHTML=LUNCH_DURATIONS.map(opt=>`<button class="lunch-chip${state.lunchDurationMin===opt.min?' active':''}" onclick="selectLunchDuration(${opt.min})">${opt.label}</button>`).join('');}
function renderLunchStart(){const row=document.getElementById('lunchStartRow');const endTimeMin=parseTime(state.endTime);row.innerHTML=LUNCH_START_OPTIONS.map(t=>{const startMin=parseTime(t);const lunchEndMin=startMin+state.lunchDurationMin;const disabled=state.lunchDurationMin===0||lunchEndMin>endTimeMin;const isActive=state.lunchStart===t&&!disabled;return`<button class="lunch-chip${isActive?' active':''}" ${disabled?'disabled':''} onclick="selectLunchStart('${t}')">${t}</button>`;}).join('');}

function selectStartTime(t){state.startTime=t;if(getWorkHours()<=0){state.lunchDurationMin=0;state.lunchStart='12:00';}saveState();renderStartTimeGrid();renderLunchStart();updateAll();}
function selectEndTime(t){state.endTime=t;if(getWorkHours()<=0){state.lunchDurationMin=0;state.lunchStart='12:00';}saveState();renderEndTimeGrid();renderLunchStart();updateAll();}
function selectLunchDuration(min){state.lunchDurationMin=min;if(min===0){state.lunchStart='12:00';}const endMin=parseTime(state.endTime);const startMin=parseTime(state.lunchStart);if(min>0&&startMin+min>endMin){for(let i=LUNCH_START_OPTIONS.length-1;i>=0;i--){const t=LUNCH_START_OPTIONS[i];if(parseTime(t)+min<=endMin){state.lunchStart=t;break;}}}saveState();renderLunchDuration();renderLunchStart();updateAll();}
function selectLunchStart(t){state.lunchStart=t;saveState();renderLunchStart();updateAll();}

function getWorkHours(){const start=parseTime(state.startTime),end=parseTime(state.endTime);let lunch=state.lunchDurationMin;return(end-start-lunch)/60;}

// ==================== 核心计算 ====================
function calculateMonthWorkDays(year,month){
const dim=new Date(year,month+1,0).getDate();
// 天天都赚钱：工资平摊到整月每一天（不扣周末节假日）
if(state.mode==='always'){
return{days:dim,hours:dim*getWorkHours()};
}
// 上班才赚钱：只算工作日
let totalDays=0,totalHours=0;
for(let d=1;d<=dim;d++){const date=new Date(year,month,d);const wd=isWorkDay(date);if(wd===true){totalDays++;totalHours+=getWorkHours();}else if(wd==='half'){totalDays+=0.5;totalHours+=getWorkHours()*0.5;}}
return{days:totalDays,hours:totalHours};
}

function getEarnedAtTime(checkTime){
const monthlySalary=parseFloat(document.getElementById('monthlySalary').value||0);
if(!monthlySalary)return 0;
const workHours=getWorkHours();if(workHours<=0)return 0;
const{hours:totalWorkHours}=calculateMonthWorkDays(checkTime.getFullYear(),checkTime.getMonth());if(totalWorkHours<=0)return 0;
const hourlyRate=monthlySalary/totalWorkHours;

// 随时都赚钱：月薪平摊到整月每一秒（24h×天数），睡觉也在赚
if(state.mode==='always'){
const dim=new Date(checkTime.getFullYear(),checkTime.getMonth()+1,0).getDate();
const totalSeconds=dim*24*3600;
const perSecond=monthlySalary/totalSeconds;
const elapsed=(checkTime-new Date(checkTime.getFullYear(),checkTime.getMonth(),1))/1000;
return perSecond*elapsed;
}

// 上班才赚钱模式：只在工作时段计算
const workStart=parseTime(state.startTime),workEnd=parseTime(state.endTime);
let lunchStartMin=0,lunchEndMin=0;if(state.lunchDurationMin>0){lunchStartMin=parseTime(state.lunchStart);lunchEndMin=lunchStartMin+state.lunchDurationMin;}
const year=checkTime.getFullYear(),month=checkTime.getMonth(),today=checkTime.getDate();
const currentTime=checkTime.getHours()*60+checkTime.getMinutes();const currentSec=checkTime.getSeconds()+checkTime.getMilliseconds()/1000;const currentTotalMin=currentTime+currentSec/60;
let earned=0;
for(let d=1;d<today;d++){const date=new Date(year,month,d);const wd=isWorkDay(date);if(wd===true)earned+=hourlyRate*workHours;else if(wd==='half')earned+=hourlyRate*workHours*0.5;}
const todayDate=new Date(year,month,today);const todayWd=isWorkDay(todayDate);
if(todayWd===true){if(currentTotalMin<workStart){}else if(currentTotalMin>=workEnd){earned+=hourlyRate*workHours;}else{let workedMin=(currentTotalMin-workStart);if(lunchEndMin>lunchStartMin){if(currentTotalMin>lunchEndMin)workedMin-=(lunchEndMin-lunchStartMin);else if(currentTotalMin>lunchStartMin)workedMin-=(currentTotalMin-lunchStartMin);}earned+=hourlyRate*(workedMin/60);}}
else if(todayWd==='half'){if(currentTotalMin>=workStart&&currentTotalMin<workEnd){let workedMin=(currentTotalMin-workStart);if(lunchEndMin>lunchStartMin){if(currentTotalMin>lunchEndMin)workedMin-=(lunchEndMin-lunchStartMin);else if(currentTotalMin>lunchStartMin)workedMin-=(currentTotalMin-lunchStartMin);}earned+=hourlyRate*(workedMin/60)*0.5;}else if(currentTotalMin>=workEnd){earned+=hourlyRate*workHours*0.5;}}
return earned;
}

// ==================== 倒计时 + 激励语 ====================
const QUOTES=[
"再睡一夏，上班在望 🛋️",
"你的床在挽留你，但工资在呼唤你 💰",
"距离财富自由还有...无数个工作日",
"休息是为了更好地摸鱼 🐟",
"每一秒的等待，都是为下一秒的工资做铺垫",
"倒计时结束之时，就是你变富之日",
"周末是上帝的，工资是你的 ⏰",
"躺平是为了更好地站起",
"今天休息得越好，明天赚钱越快",
"你的时间很值钱，每一秒都在靠近下一个工作日",
"不经历休息的无聊，怎体会赚钱的充实",
"坚持住，下一个工作日正在赶来",
"睡觉也是为上班充电 🔋",
"醒来后，工资在向你招手 👋",
"忍一时躺平，赚一世富贵",
"休息时间越短，上班时间越美",
"还在睡？你的同事已经开始卷了 👀",
"假期是最好的投资，因为它会带来更多工资",
"当前状态：等待上班，期待发财",
"休息是假象，赚钱是真理",
];

function isInWorkTime(now){
if(state.mode!=='work')return true;
const wd=isWorkDay(now);
if(wd===false)return false;
const workStart=parseTime(state.startTime),workEnd=parseTime(state.endTime);
const currentMin=now.getHours()*60+now.getMinutes();
if(wd==='half'){
// 半天假简化判断：只要在上班和下班之间就算在工作
return currentMin>=workStart&&currentMin<workEnd;
}
return currentMin>=workStart&&currentMin<workEnd;
}

function getNextWorkStart(fromDate){
const d=new Date(fromDate);
const ds=formatDate(d);
const todayWd=isWorkDay(d);
const workStartMin=parseTime(state.startTime);
const currentMin=d.getHours()*60+d.getMinutes();

// 今天是工作日且还没到上班时间
if((todayWd===true||todayWd==='half')&&currentMin<workStartMin){
return new Date(d.getFullYear(),d.getMonth(),d.getDate(),Math.floor(workStartMin/60),workStartMin%60,0);
}

// 往后找下一个工作日
let next=new Date(d);next.setDate(next.getDate()+1);next.setHours(0,0,0,0);
for(let i=0;i<60;i++){ // 最多找60天防止死循环
const wd=isWorkDay(next);
if(wd===true||wd==='half'){
return new Date(next.getFullYear(),next.getMonth(),next.getDate(),Math.floor(workStartMin/60),workStartMin%60,0);
}
next.setDate(next.getDate()+1);
}
return null;
}

function formatCountdown(ms){
if(ms<=0)return"已经上班啦！🎉";
const days=Math.floor(ms/86400000);
const hours=Math.floor((ms%86400000)/3600000);
const mins=Math.floor((ms%3600000)/60000);
const secs=Math.floor((ms%60000)/1000);
if(days>0)return`${days}天 ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
return`${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

function getQuote(now){
// 每30秒切换一句
const idx=Math.floor(now.getTime()/30000)%QUOTES.length;
return QUOTES[idx];
}
let clockRunning=false;
let lastClockValue=0;
function animateClock(){
if(!clockRunning)return;
const now=new Date();
const inWork=isInWorkTime(now);
const clockDisplay=document.querySelector('.clock-display');
const countdownBox=document.getElementById('countdownBox');

if(!inWork&&state.mode==='work'){
// 非工作时段：显示倒计时 + 激励语
clockDisplay.style.display='none';
countdownBox.classList.remove('hidden');
const nextStart=getNextWorkStart(now);
if(nextStart){
const ms=nextStart-now;
document.getElementById('countdownTime').textContent=formatCountdown(ms);
}else{
document.getElementById('countdownTime').textContent="找不到下一个工作日 😅";
}
document.getElementById('countdownQuote').textContent=getQuote(now);
}else{
// 工作时段：正常显示薪水
clockDisplay.style.display='';
countdownBox.classList.add('hidden');
const earned=getEarnedAtTime(now);
const el=document.getElementById('clockAmount');
el.textContent=formatMoney(earned);
if(earned>lastClockValue){el.style.opacity=1;}else{el.style.opacity=0.95;}
lastClockValue=earned;
}
requestAnimationFrame(animateClock);
}
function updateClockSub(){
const monthlySalary=parseFloat(document.getElementById('monthlySalary').value||0);
const workHours=getWorkHours();const now=new Date();
const{days:workDays,hours:totalWorkHours}=calculateMonthWorkDays(now.getFullYear(),now.getMonth());
if(monthlySalary&&totalWorkHours>0){
const hourlyRate=monthlySalary/totalWorkHours;
document.getElementById('clockDaily').textContent=formatMoneyShort(hourlyRate*workHours);
document.getElementById('clockHourly').textContent=formatMoneyShort(hourlyRate);
const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
if(state.mode==='always'){
// 随时都赚钱：显示本月剩余天数
document.getElementById('clockLeftLabel').textContent='本月剩余天数';
document.getElementById('clockLeft').textContent=dim-now.getDate()+1;
}else{
// 上班才赚钱：显示剩余工作日
let remaining=0;
for(let d=now.getDate();d<=dim;d++){const date=new Date(now.getFullYear(),now.getMonth(),d);const wd=isWorkDay(date);if(wd===true)remaining++;else if(wd==='half')remaining+=0.5;}
document.getElementById('clockLeftLabel').textContent='剩余工作日';
document.getElementById('clockLeft').textContent=remaining;
}
}else{document.getElementById('clockDaily').textContent='-';document.getElementById('clockHourly').textContent='-';document.getElementById('clockLeft').textContent='-';}
}
function enterClock(){saveState();document.getElementById('setupView').classList.add('hidden');document.getElementById('clockView').classList.remove('hidden');clockRunning=true;updateClockSub();animateClock();}
function backToSetup(){clockRunning=false;document.getElementById('clockView').classList.add('hidden');document.getElementById('setupView').classList.remove('hidden');}

// ==================== 日历 ====================
function renderCalendar(){
const grid=document.getElementById('calendarGrid');
document.getElementById('calendarMonth').textContent=`${currentYear}年${currentMonth+1}月`;
const weekdays=['日','一','二','三','四','五','六'];let html=weekdays.map(w=>`<div class="weekday">${w}</div>`).join('');
const firstDay=new Date(currentYear,currentMonth,1);const dim=new Date(currentYear,currentMonth+1,0).getDate();const startWd=firstDay.getDay();
const today=new Date();const isCurMonth=today.getFullYear()===currentYear&&today.getMonth()===currentMonth;
for(let i=0;i<startWd;i++)html+='<div class="day empty"></div>';
for(let d=1;d<=dim;d++){
const date=new Date(currentYear,currentMonth,d);const ds=formatDate(date);const dow=date.getDay();const isToday=isCurMonth&&d===today.getDate();
const st=getStatus(ds);const hol=getHolidayInfo(ds);const wk=getWorkdayInfo(ds);
let classes=['day'];if(isToday)classes.push('today');
let typeLabel='';

// 判断显示状态（优先级：自定义 > 法定 > 调休 > 周末 > 工作日）
if(st){
if(st.type==='holiday'){classes.push('holiday');typeLabel=hol?.name?.substring(0,2)||'休';}
else if(st.type==='company-full'){classes.push('company-full');typeLabel='公休';}
else if(st.type==='personal-full'){classes.push('personal-full');typeLabel='个休';}
else if(st.type==='personal-am'){classes.push('personal-am');typeLabel='个休';}
else if(st.type==='personal-pm'){classes.push('personal-pm');typeLabel='个休';}
else if(st.type==='work'){classes.push('workday-custom');typeLabel='班';}
}else if(hol){classes.push('holiday');typeLabel=hol.name.substring(0,2);}
else if(wk){classes.push('workday-official');typeLabel='班';}
else if(dow===0||dow===6){classes.push('weekend');}
else { classes.push('workday'); }
html+=`<div class="${classes.join(' ')}" onclick="openDayModal(${d})" data-date="${ds}"><span class="day-text">${d}</span>${typeLabel?`<span class="day-type">${typeLabel}</span>`:''}</div>`;
}
grid.innerHTML=html;updateAll();updateRestDays();}
function updateRestDays(){
const dim=new Date(currentYear,currentMonth+1,0).getDate();let restCount=0;
for(let d=1;d<=dim;d++){
const date=new Date(currentYear,currentMonth,d);
const ds=formatDate(date);
const st=getStatus(ds);
if(st&&(st.type==='personal-am'||st.type==='personal-pm')){
restCount+=0.5;
}else if(isRestDay(date)){
restCount+=1;
}
}
// 有半天假时显示小数，否则整数
const hasHalf=restCount%1!==0;
document.getElementById('restDaysCount').textContent=hasHalf?restCount.toFixed(1):Math.round(restCount);
}
function changeMonth(delta){currentMonth+=delta;if(currentMonth>11){currentMonth=0;currentYear++;}else if(currentMonth<0){currentMonth=11;currentYear--;}renderCalendar();}

// ==================== 模态框（核心交互逻辑）====================
function openDayModal(day){
const date=new Date(currentYear,currentMonth,day);
selectedDate=formatDate(date);
const hol=getHolidayInfo(selectedDate);
const wk=getWorkdayInfo(selectedDate);
const cur=customStatus[selectedDate];
const rest = isRestDay(date); // 是否是休息日

document.getElementById('modalTitle').textContent=`${currentMonth+1}月${day}日`;
let options=[];

if(rest){
// 休息日（法定节假日/周末/已休假）-> 可以标记为"今天要上班"
document.getElementById('modalSubtitle').textContent='今天是休息日，但...';
options.push({label:'今天要上班😭',tag:'班',tagClass:'tag-work',action:()=>setDayStatus('work')});
// 如果已经有自定义状态，也可以恢复
if(cur){
options.push({label:'恢复默认',tag:'恢复',tagClass:'tag-holiday',action:()=>setDayStatus(null)});
}
}else{
// 工作日 -> 可以请假
document.getElementById('modalSubtitle').textContent='选择休假类型';
options.push(
{label:'公司休假（全天）',tag:'公休',tagClass:'tag-company',action:()=>setDayStatus('company-full')},
{label:'个人休假（全天）',tag:'个休',tagClass:'tag-personal',action:()=>setDayStatus('personal-full')},
{label:'个人休假（上午）',tag:'半天',tagClass:'tag-personal',action:()=>setDayStatus('personal-am')},
{label:'个人休假（下午）',tag:'半天',tagClass:'tag-personal',action:()=>setDayStatus('personal-pm')}
);
if(cur){
options.push({label:'恢复默认',tag:'恢复',tagClass:'tag-work',action:()=>setDayStatus(null)});
}
}

document.getElementById('modalOptions').innerHTML=options.map((opt,i)=>`<button class="modal-btn" onclick="modalOptions[${i}].action()"><span>${opt.label}</span><span class="btn-tag ${opt.tagClass}">${opt.tag}</span></button>`).join('');
window.modalOptions=options;
document.getElementById('modal').classList.add('active');
}
function closeModal(){document.getElementById('modal').classList.remove('active');selectedDate=null;}
function setDayStatus(type){if(type===null)delete customStatus[selectedDate];else customStatus[selectedDate]={type};saveCustomStatus();closeModal();renderCalendar();}
document.getElementById('modal').addEventListener('click',(e)=>{if(e.target.id==='modal')closeModal();});

// ==================== 统计 ====================
function updateAll(){}

// ==================== 事件 ====================
document.getElementById('monthlySalary').addEventListener('input',saveState);

// ==================== 初始化 ====================
document.getElementById('monthlySalary').value=state.monthlySalary||'';
applyTheme();
renderModeGrid();
renderStartTimeGrid();
renderEndTimeGrid();
renderLunchDuration();
renderLunchStart();
renderCalendar();
