function dateKey(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

const CARE_CLASSES={
  '水やり':'water','薬剤散布':'pesticide','植え替え':'repot',
  '施肥':'fertilize','状態・写真記録':'growth'
};
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let selectedCalendarDate=dateKey(new Date());
const APP_VIEW_KEY='plant-care-view-v1';

function savedAppView(){
  try{
    const view=localStorage.getItem(APP_VIEW_KEY) || 'today';
    return ['today','list','calendar'].includes(view)?view:'today';
  }catch(e){ return 'today'; }
}

function rainfallForDate(date){
  const amount=Number(weather.days?.[date]);
  return Number.isFinite(amount) && amount>=Number(weather.displayThreshold) ? amount : null;
}

function rainLabelForDate(date){
  return date>=dateKey(new Date())?'降水予報':'降雨';
}

function weatherCitySuffix(){
  return weather.cityName?`（${esc(weather.cityName)}）`:'';
}

function renderCalendarFilters(){
  const select=$('calendarPlantFilter');
  const current=select.value;
  select.innerHTML='<option value="">すべての植物</option>'+data.plants.map(p=>
    `<option value="${esc(p.id)}">${esc(p.name)}</option>`
  ).join('');
  if([...select.options].some(o=>o.value===current)) select.value=current;
}

function planOccursOnDate(plan,date){
  const start=new Date(Number(plan.startAt));
  const target=new Date(`${date}T00:00:00`);
  const startDate=new Date(start.getFullYear(),start.getMonth(),start.getDate());
  if(!Number.isFinite(start.getTime()) || target<startDate) return false;
  const recurrence=plan.recurrence || {unit:'none',interval:1};
  const interval=Math.max(1,Number(recurrence.interval) || 1);
  if(recurrence.unit==='none') return dateKey(start)===date;
  const dayDiff=Math.round((target-startDate)/86400000);
  if(recurrence.unit==='day') return dayDiff%interval===0;
  if(recurrence.unit==='week') return dayDiff%(7*interval)===0;
  if(recurrence.unit==='month'){
    const monthDiff=(target.getFullYear()-start.getFullYear())*12+target.getMonth()-start.getMonth();
    if(monthDiff<0 || monthDiff%interval!==0) return false;
    const lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
    return target.getDate()===Math.min(start.getDate(),lastDay);
  }
  return false;
}

function calendarEventsFor(date){
  const plantId=$('calendarPlantFilter').value;
  const careFilter=$('calendarCareFilter').value;
  const events=[];
  data.plants.filter(p=>!plantId || p.id===plantId).forEach(p=>{
    (p.logs || []).forEach((log,logIndex)=>{
      const care=log.care || '水やり';
      if((!careFilter || care===careFilter) && dateKey(new Date(log.time))===date){
        events.push({plant:p,log,logIndex,care,planned:false});
      }
      if(care==='薬剤散布' && (!careFilter || careFilter==='薬剤散布') && log.details?.nextDate===date){
        events.push({plant:p,log,logIndex,care,planned:true});
      }
    });
    (p.plans || []).forEach(plan=>{
      const care=plan.care || '水やり';
      if((!careFilter || care===careFilter) && planOccursOnDate(plan,date)){
        events.push({plant:p,log:plan,care,planned:true,carePlan:true});
      }
    });
  });
  if(!plantId && !careFilter){
    (data.reminders || []).forEach(reminder=>{
      if(planOccursOnDate(reminder,date)){
        events.push({reminder,log:reminder,planned:true,globalReminder:true});
      }
    });
  }
  return events.sort((a,b)=>Number(a.planned)-Number(b.planned) ||
    Number(b.log.time || b.log.startAt)-Number(a.log.time || a.log.startAt));
}

function renderCalendar(){
  const year=calendarMonth.getFullYear();
  const month=calendarMonth.getMonth();
  $('calendarTitle').textContent=`${year}年 ${month+1}月`;
  const first=new Date(year,month,1);
  const start=new Date(year,month,1-first.getDay());
  const today=dateKey(new Date());
  const weekdays=['日','月','火','水','木','金','土'];
  let html=weekdays.map(day=>`<div class="weekday">${day}</div>`).join('');

  for(let i=0;i<42;i++){
    const day=new Date(start);
    day.setDate(start.getDate()+i);
    const key=dateKey(day);
    const events=calendarEventsFor(key);
    const rain=rainfallForDate(key);
    const rainMarker=rain===null?'':`<i class="event-dot ${rain>=Number(weather.equivalentThreshold)?'rain-equivalent':'rain'}" title="${rainLabelForDate(key)} ${rain.toFixed(1)}mm${weatherCitySuffix()}"></i>`;
    const eventLimit=rain===null?5:4;
    const markers=events.slice(0,eventLimit).map(event=>{
      if(event.globalReminder) return '<i class="event-dot reminder" title="備忘録"></i>';
      if(event.planned) return '<i class="event-dot planned" title="予定"></i>';
      const photo=event.log.photo ? '<span class="photo-mark">📷</span>' : '';
      return `<i class="event-dot ${CARE_CLASSES[event.care] || 'growth'}"></i>${photo}`;
    }).join('');
    const more=events.length>eventLimit?`<span class="more-mark">+${events.length-eventLimit}</span>`:'';
    const classes=['calendar-day'];
    if(day.getDay()===0) classes.push('sunday');
    if(day.getDay()===6) classes.push('saturday');
    if(day.getMonth()!==month) classes.push('other');
    if(key===today) classes.push('today');
    if(key===selectedCalendarDate) classes.push('selected');
    html+=`<button class="${classes.join(' ')}" onclick="selectCalendarDate('${key}')">
      <span class="day-number">${day.getDate()}</span><span class="event-dots">${rainMarker}${markers}${more}</span>
    </button>`;
  }
  $('calendarGrid').innerHTML=html;
  renderCalendarDayDetails();
}

function renderCalendarDayDetails(){
  const events=calendarEventsFor(selectedCalendarDate);
  const rain=rainfallForDate(selectedCalendarDate);
  const today=dateKey(new Date());
  const isToday=selectedCalendarDate===today;
  const canRecordRain=selectedCalendarDate<=today;
  const equivalent=rain!==null && rain>=Number(weather.equivalentThreshold);
  const date=new Date(`${selectedCalendarDate}T00:00:00`);
  const title=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(date);
  const rainHtml=rain===null?'':`<div class="calendar-entry rain-entry">
    <div class="entry-title">☔ ${rainLabelForDate(selectedCalendarDate)} ${rain.toFixed(1)}mm${weatherCitySuffix()}</div>
    <div class="entry-meta">${equivalent
      ?isToday?'水やり相当候補です。当日の値には予報が含まれる可能性があります。実際に雨が当たった株だけを選んでください。':'水やり相当候補です。雨が当たる株を選んで記録できます。'
      :'設定した水やり相当量には達していません。'}</div>
    ${equivalent && canRecordRain?`<button class="rain-action" onclick="openRainWatering('${selectedCalendarDate}',${rain})">${isToday?'現在までの雨を水やり扱いにする':'雨を水やり扱いにする'}</button>`:''}
  </div>`;
  const careHtml=events.length?events.map(event=>{
    if(event.globalReminder){
      return `<div class="calendar-entry reminder-entry"><div class="entry-title">📝 ${esc(event.reminder.title)}</div>
        <div class="entry-meta">${esc(recurrenceText(event.reminder.recurrence))}${event.reminder.memo?`<br>${esc(event.reminder.memo)}`:''}</div>
        <div class="calendar-entry-actions">
          <button class="secondary" type="button" onclick="exportGlobalReminder('${esc(String(event.reminder.id))}')">カレンダー</button>
          <button class="secondary calendar-entry-edit" type="button" onclick="editReminder('${esc(String(event.reminder.id))}')">編集</button>
        </div></div>`;
    }
    if(event.carePlan){
      return `<div class="calendar-entry calendar-plan-entry"><div class="entry-title">⏰ ${esc(event.plant.name)}・${esc(event.care)}予定</div>
        <div class="entry-meta">${careDetailHtml(event.log)}<br>${esc(recurrenceText(event.log.recurrence))}</div>
        <div class="calendar-entry-actions">
          <button class="secondary" type="button" onclick="exportPlantCarePlan('${esc(String(event.plant.id))}','${esc(String(event.log.id))}')">カレンダー</button>
          <button class="secondary calendar-entry-edit" type="button" onclick="editPlan('${esc(String(event.plant.id))}','${esc(String(event.log.id))}','calendar')">編集</button>
          <button class="danger calendar-entry-delete" type="button" onclick="removePlan('${esc(String(event.plant.id))}','${esc(String(event.log.id))}','calendar')">削除</button>
        </div></div>`;
    }
    if(event.planned){
      return `<div class="calendar-entry"><div class="entry-title">⏰ ${esc(event.plant.name)}・薬剤散布予定</div>
        <div class="entry-meta">薬剤：${esc(event.log.details?.name || '未入力')} ／ 対象：${esc(event.log.details?.target || '未入力')}</div>
        <div class="calendar-entry-actions">
          <button class="secondary calendar-entry-edit" type="button" onclick="editLog('${esc(String(event.plant.id))}',${event.logIndex},'calendar')">元の記録を編集</button>
        </div></div>`;
    }
    return `<div class="calendar-entry calendar-care-entry"><div class="entry-title">${esc(event.plant.name)}・${esc(event.care)}</div>
      <div class="entry-meta">${careDetailHtml(event.log)}</div>${photoHtml(event.log.photo)}
      <div class="calendar-entry-actions">
        <button class="secondary calendar-entry-edit" type="button" onclick="editLog('${esc(String(event.plant.id))}',${event.logIndex},'calendar')">編集</button>
        <button class="danger calendar-entry-delete" type="button" onclick="removeLog('${esc(String(event.plant.id))}',${event.logIndex},'calendar')">削除</button>
      </div></div>`;
  }).join(''):(rain===null?'<div class="empty">この日の記録・予定はありません。</div>':'');
  const isFuture=selectedCalendarDate>dateKey(new Date());
  const addCareHtml=data.plants.some(plant=>plantManagementStatus(plant)!=='ended')
    ?`<button id="addCareForDateBtn" class="calendar-add-care" type="button" onclick="openCalendarCare('${selectedCalendarDate}')">＋ この日の${isFuture?'予定':'ケア'}を追加</button>`
    :'';
  const addReminderHtml=selectedCalendarDate>today
    ?`<button id="addReminderForDateBtn" class="calendar-add-reminder" type="button" onclick="openCalendarReminder('${selectedCalendarDate}')">＋ この日の備忘録を追加</button>`
    :'';
  $('calendarDayDetails').innerHTML=`<h3>${title}</h3><div class="calendar-add-actions">${addCareHtml}${addReminderHtml}</div>${rainHtml}${careHtml}`;
}

let calendarCareDate='';

window.openCalendarCare=date=>{
  const plants=data.plants.filter(plant=>plantManagementStatus(plant)!=='ended');
  if(!plants.length) return toast('ケアを記録できる株がありません');
  const filteredId=$('calendarPlantFilter').value;
  const filteredPlant=plants.find(plant=>String(plant.id)===String(filteredId));
  const mode=date>dateKey(new Date())?'plan':'record';
  if(filteredPlant || plants.length===1){
    openCare((filteredPlant || plants[0]).id,{date,mode});
    return;
  }
  calendarCareDate=date;
  $('calendarCarePlantTitle').textContent=mode==='plan'?'未来のケア予定を追加':'過去のケアを追加';
  $('calendarCareDateText').textContent=`${date} に${mode==='plan'?'予定する':'記録する'}株を選択してください。`;
  $('calendarCarePlant').innerHTML=plants.map(plant=>`<option value="${esc(String(plant.id))}">${esc(plant.name)}</option>`).join('');
  $('calendarCarePlantDialog').showModal();
};
$('cancelCalendarCare').onclick=()=> $('calendarCarePlantDialog').close();
$('continueCalendarCare').onclick=()=>{
  const id=$('calendarCarePlant').value;
  $('calendarCarePlantDialog').close();
  openCare(id,{date:calendarCareDate,mode:calendarCareDate>dateKey(new Date())?'plan':'record'});
};

window.selectCalendarDate=date=>{
  selectedCalendarDate=date;
  renderCalendar();
};

function setView(view,{persist=true}={}){
  const selected=['today','list','calendar'].includes(view)?view:'today';
  $('todayView').classList.toggle('hidden',selected!=='today');
  $('listView').classList.toggle('hidden',selected!=='list');
  $('calendarView').classList.toggle('hidden',selected!=='calendar');
  const navButtons={today:$('navTodayBtn'),list:$('navListBtn'),calendar:$('navCalendarBtn')};
  Object.entries(navButtons).forEach(([name,button])=>{
    const active=name===selected;
    button.classList.toggle('active',active);
    if(active) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  if(selected!=='list' && typeof setListSelectionMode==='function') setListSelectionMode(false,{renderList:false});
  if(selected==='today' && typeof renderToday==='function') renderToday();
  if(selected==='calendar'){
    renderCalendarFilters();
    renderCalendar();
  }
  if(persist){
    try{ localStorage.setItem(APP_VIEW_KEY,selected); }catch(e){}
  }
}

$('navTodayBtn').onclick=()=>{
  setView('today');
  trackPlantCareEvent('today_viewed');
};
$('navListBtn').onclick=()=>{
  setView('list');
  trackPlantCareEvent('list_viewed');
};
$('navCalendarBtn').onclick=()=>{
  setView('calendar');
  trackPlantCareEvent('calendar_viewed');
};
$('navMoreBtn').onclick=event=>{
  event.stopPropagation();
  if($('dataMenu').hidden) $('menuBtn').click();
  else closeDataMenu();
};
$('prevMonth').onclick=()=>{
  calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);
  selectedCalendarDate=dateKey(calendarMonth);
  renderCalendar();
};
$('nextMonth').onclick=()=>{
  calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);
  selectedCalendarDate=dateKey(calendarMonth);
  renderCalendar();
};
$('todayBtn').onclick=()=>{
  const today=new Date();
  calendarMonth=new Date(today.getFullYear(),today.getMonth(),1);
  selectedCalendarDate=dateKey(today);
  renderCalendar();
};
$('calendarPlantFilter').onchange=renderCalendar;
$('calendarCareFilter').onchange=renderCalendar;
