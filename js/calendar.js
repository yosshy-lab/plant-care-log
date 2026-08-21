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

function calendarEventsFor(date){
  const plantId=$('calendarPlantFilter').value;
  const careFilter=$('calendarCareFilter').value;
  const events=[];
  data.plants.filter(p=>!plantId || p.id===plantId).forEach(p=>{
    (p.logs || []).forEach(log=>{
      const care=log.care || '水やり';
      if((!careFilter || care===careFilter) && dateKey(new Date(log.time))===date){
        events.push({plant:p,log,care,planned:false});
      }
      if(care==='薬剤散布' && (!careFilter || careFilter==='薬剤散布') && log.details?.nextDate===date){
        events.push({plant:p,log,care,planned:true});
      }
    });
  });
  return events.sort((a,b)=>Number(a.planned)-Number(b.planned) || b.log.time-a.log.time);
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
  const isPast=selectedCalendarDate<dateKey(new Date());
  const equivalent=rain!==null && rain>=Number(weather.equivalentThreshold);
  const date=new Date(`${selectedCalendarDate}T00:00:00`);
  const title=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(date);
  const rainHtml=rain===null?'':`<div class="calendar-entry rain-entry">
    <div class="entry-title">☔ ${rainLabelForDate(selectedCalendarDate)} ${rain.toFixed(1)}mm${weatherCitySuffix()}</div>
    <div class="entry-meta">${equivalent?'水やり相当候補です。雨が当たる株を選んで記録できます。':'設定した水やり相当量には達していません。'}</div>
    ${equivalent && isPast?`<button class="rain-action" onclick="openRainWatering('${selectedCalendarDate}',${rain})">雨を水やり扱いにする</button>`:''}
  </div>`;
  const careHtml=events.length?events.map(event=>{
    if(event.planned){
      return `<div class="calendar-entry"><div class="entry-title">⏰ ${esc(event.plant.name)}・薬剤散布予定</div>
        <div class="entry-meta">薬剤：${esc(event.log.details?.name || '未入力')} ／ 対象：${esc(event.log.details?.target || '未入力')}</div></div>`;
    }
    return `<div class="calendar-entry"><div class="entry-title">${esc(event.plant.name)}・${esc(event.care)}</div>
      <div class="entry-meta">${careDetailHtml(event.log)}</div>${photoHtml(event.log.photo)}</div>`;
  }).join(''):(rain===null?'<div class="empty">この日の記録・予定はありません。</div>':'');
  const canAdd=selectedCalendarDate<=dateKey(new Date());
  const addCareHtml=canAdd && data.plants.some(plant=>plantManagementStatus(plant)!=='ended')
    ?`<button id="addCareForDateBtn" class="calendar-add-care" type="button" onclick="openCalendarCare('${selectedCalendarDate}')">＋ この日のケアを追加</button>`
    :'';
  $('calendarDayDetails').innerHTML=`<h3>${title}</h3>${addCareHtml}${rainHtml}${careHtml}`;
}

let calendarCareDate='';

window.openCalendarCare=date=>{
  const plants=data.plants.filter(plant=>plantManagementStatus(plant)!=='ended');
  if(!plants.length) return toast('ケアを記録できる株がありません');
  const filteredId=$('calendarPlantFilter').value;
  const filteredPlant=plants.find(plant=>String(plant.id)===String(filteredId));
  if(filteredPlant || plants.length===1){
    openCare((filteredPlant || plants[0]).id,{date});
    return;
  }
  calendarCareDate=date;
  $('calendarCareDateText').textContent=`${date} に記録する株を選択してください。`;
  $('calendarCarePlant').innerHTML=plants.map(plant=>`<option value="${esc(String(plant.id))}">${esc(plant.name)}</option>`).join('');
  $('calendarCarePlantDialog').showModal();
};
$('cancelCalendarCare').onclick=()=> $('calendarCarePlantDialog').close();
$('continueCalendarCare').onclick=()=>{
  const id=$('calendarCarePlant').value;
  $('calendarCarePlantDialog').close();
  openCare(id,{date:calendarCareDate});
};

window.selectCalendarDate=date=>{
  selectedCalendarDate=date;
  renderCalendar();
};

function setView(view){
  const calendar=view==='calendar';
  $('listView').classList.toggle('hidden',calendar);
  $('calendarView').classList.toggle('hidden',!calendar);
  $('listViewBtn').classList.toggle('active',!calendar);
  $('calendarViewBtn').classList.toggle('active',calendar);
  if(calendar){
    renderCalendarFilters();
    renderCalendar();
  }
}

$('listViewBtn').onclick=()=>{
  setView('list');
  trackPlantCareEvent('list_viewed');
};
$('calendarViewBtn').onclick=()=>{
  setView('calendar');
  trackPlantCareEvent('calendar_viewed');
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

