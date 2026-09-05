function todayDayBounds(){
  const start=new Date();
  start.setHours(0,0,0,0);
  return {start:start.getTime(),end:start.getTime()+86400000,date:dateKey(start)};
}

function planCompletedOnDate(plant,plan,date){
  return (plant.logs || []).some(log=>String(log.sourcePlanId || '')===String(plan.id) && log.sourcePlanDate===date);
}

let todayPlantFilter='all';
let todayCareFilter='all';
let todaySelectionMode=false;
let todaySelectedPlanKeys=new Set();
let todayUndoState=null;
let todayRecentPresets=[];

function todayPlanKey(plantId,planId,occurrenceDate){ return `${String(plantId)}::${String(planId)}::${occurrenceDate}`; }

function upcomingOccurrence(item,startAt){
  for(let offset=1;offset<=7;offset++){
    const target=new Date(startAt);
    target.setDate(target.getDate()+offset);
    const date=dateKey(target);
    if(planOccursOnDate(item,date)) return date;
  }
  return '';
}

function todayDashboardItems(){
  const bounds=todayDayBounds(),overdue=[],current=[],upcoming=[];
  data.plants.forEach(plant=>{
    if(plantManagementStatus(plant)==='ended') return;
    (plant.plans || []).forEach(plan=>{
      const oneTime=(plan.recurrence?.unit || 'none')==='none';
      if(oneTime && Number(plan.startAt)<Date.now()){
        overdue.push({kind:'plan',group:'overdue',plant,plan,occurrenceDate:dateKey(new Date(Number(plan.startAt)))});
        return;
      }
      if(planOccursOnDate(plan,bounds.date) && !planCompletedOnDate(plant,plan,bounds.date)){
        current.push({kind:'plan',group:'current',plant,plan,occurrenceDate:bounds.date});
        return;
      }
      const occurrenceDate=upcomingOccurrence(plan,bounds.start);
      if(occurrenceDate) upcoming.push({kind:'plan',group:'upcoming',plant,plan,occurrenceDate});
    });
  });
  (data.reminders || []).forEach(reminder=>{
    const oneTime=(reminder.recurrence?.unit || 'none')==='none';
    if(oneTime && Number(reminder.startAt)<Date.now()){
      overdue.push({kind:'reminder',group:'overdue',reminder,occurrenceDate:dateKey(new Date(Number(reminder.startAt)))});
      return;
    }
    if(planOccursOnDate(reminder,bounds.date)){
      current.push({kind:'reminder',group:'current',reminder,occurrenceDate:bounds.date});
      return;
    }
    const occurrenceDate=upcomingOccurrence(reminder,bounds.start);
    if(occurrenceDate) upcoming.push({kind:'reminder',group:'upcoming',reminder,occurrenceDate});
  });
  const sortItems=items=>items.sort((a,b)=>Number(a.plan?.startAt || a.reminder?.startAt)-Number(b.plan?.startAt || b.reminder?.startAt));
  return {bounds,overdue:sortItems(overdue),current:sortItems(current),upcoming:sortItems(upcoming)};
}

function todayItemPlantValue(item){ return item.kind==='plan'?String(item.plant.id):'reminders'; }
function todayItemCareValue(item){ return item.kind==='plan'?(item.plan.care || '水やり'):'備忘録'; }
function todayItemMatches(item){
  return (todayPlantFilter==='all' || todayItemPlantValue(item)===todayPlantFilter) && (todayCareFilter==='all' || todayItemCareValue(item)===todayCareFilter);
}

function renderTodayFilters(allItems){
  const plants=[...new Map(allItems.filter(item=>item.kind==='plan').map(item=>[String(item.plant.id),item.plant.name])).entries()];
  const hasReminders=allItems.some(item=>item.kind==='reminder');
  $('todayPlantFilter').innerHTML='<option value="all">すべての植物</option>'+plants.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')+(hasReminders?'<option value="reminders">備忘録</option>':'');
  if(![...$('todayPlantFilter').options].some(option=>option.value===todayPlantFilter)) todayPlantFilter='all';
  $('todayPlantFilter').value=todayPlantFilter;
  const careValues=[...new Set(allItems.map(todayItemCareValue))];
  $('todayCareFilter').innerHTML='<option value="all">すべてのケア</option>'+careValues.map(care=>`<option value="${esc(care)}">${esc(care)}</option>`).join('');
  if(!careValues.includes(todayCareFilter)) todayCareFilter='all';
  $('todayCareFilter').value=todayCareFilter;
}

function dashboardTaskTime(item){
  if(item.group==='overdue') return '期限超過';
  if(item.group==='upcoming') return new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',weekday:'short'}).format(new Date(`${item.occurrenceDate}T00:00:00`));
  const source=item.plan || item.reminder;
  return new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit'}).format(new Date(Number(source.startAt)));
}

function todayTaskHtml(item){
  if(item.kind==='reminder'){
    const reminder=item.reminder;
    return `<article class="today-task today-reminder${item.group==='overdue'?' overdue':''}">
      <div class="today-task-heading"><div><div class="today-task-name">${esc(reminder.title)}</div><div class="today-task-care">備忘録 ・ ${esc(recurrenceText(reminder.recurrence))}</div></div><span class="today-task-time">${esc(dashboardTaskTime(item))}</span></div>
      ${reminder.memo?`<div class="today-task-note">${esc(reminder.memo)}</div>`:''}
      <div class="today-task-actions single"><button class="secondary" type="button" onclick="editReminder('${esc(String(reminder.id))}')">内容を確認・編集</button></div>
    </article>`;
  }
  const {plant,plan}=item;
  const key=todayPlanKey(plant.id,plan.id,item.occurrenceDate),selectable=item.group!=='upcoming';
  return `<article class="today-task${item.group==='overdue'?' overdue':''}${todaySelectedPlanKeys.has(key)?' selected':''}">
    ${selectable?`<label class="today-task-select${todaySelectionMode?'':' hidden'}"><input class="today-plan-check" type="checkbox" data-plant-id="${esc(String(plant.id))}" data-plan-id="${esc(String(plan.id))}" data-occurrence-date="${esc(item.occurrenceDate)}" ${todaySelectedPlanKeys.has(key)?'checked':''}><span>選択</span></label>`:''}
    <div class="today-task-heading"><div><div class="today-task-name">${esc(plant.name)}</div><div class="today-task-care">${esc(plan.care || '水やり')} ・ ${esc(recurrenceText(plan.recurrence))}</div></div><span class="today-task-time">${esc(dashboardTaskTime(item))}</span></div>
    ${plan.note?`<div class="today-task-note">${esc(plan.note)}</div>`:''}
    ${item.group==='upcoming'?`<div class="today-task-actions single"><button class="secondary" type="button" onclick="openDashboardCalendar('${esc(item.occurrenceDate)}')">カレンダーで確認</button></div>`:`<div class="today-task-actions"><button class="today-task-complete" type="button" onclick="completeTodayPlan('${esc(String(plant.id))}','${esc(String(plan.id))}','${esc(item.occurrenceDate)}')">完了して記録</button><button class="secondary" type="button" onclick="postponeTodayPlan('${esc(String(plant.id))}','${esc(String(plan.id))}')">1日延期</button></div>`}
  </article>`;
}

function renderTodayGroup(sectionId,countId,tasksId,items){
  $(sectionId).hidden=!items.length;
  $(countId).textContent=`${items.length}件`;
  $(tasksId).innerHTML=items.map(todayTaskHtml).join('');
}

function renderTodayRecentCare(){
  todayRecentPresets=recentCarePresets();
  $('todayRecentCare').hidden=!todayRecentPresets.length;
  $('todayRecentCareActions').innerHTML=todayRecentPresets.map((preset,index)=>`<button class="secondary" type="button" onclick="recordRecentCareFromToday(${index})"><span aria-hidden="true">${timelineIcon(preset.care)}</span>${esc(preset.label)}</button>`).join('');
}

function renderTodayUndo(){
  $('todayUndoNotice').hidden=!todayUndoState;
  $('todayUndoMessage').textContent=todayUndoState?.message || '';
}

function setTodayUndoState(state){
  todayUndoState=state;
  clearTimeout(window.__todayUndoTimer);
  if(state) window.__todayUndoTimer=setTimeout(()=>{todayUndoState=null;renderToday();},10000);
}

function updateTodayBatchActions(){
  const count=todaySelectedPlanKeys.size;
  $('todayBatchActions').hidden=!todaySelectionMode || count===0;
  $('todaySelectedCount').textContent=`${count}件を選択中`;
  $('todaySelectModeBtn').classList.toggle('active',todaySelectionMode);
  $('todaySelectModeBtn').setAttribute('aria-pressed',String(todaySelectionMode));
  $('todaySelectModeBtn').textContent=todaySelectionMode?'選択を終了':'複数選択';
}

function todayWeatherText(bounds){
  const rain=Number(weather?.days?.[bounds.date]),max=Number(weather?.maxTemps?.[bounds.date]),min=Number(weather?.minTemps?.[bounds.date]);
  $('todayWeatherSummary').textContent=Number.isFinite(max)&&Number.isFinite(min)?`${Math.round(max)}° / ${Math.round(min)}°`:'--';
  $('todayWeatherRain').textContent=Number.isFinite(rain)?`降水 ${rain.toFixed(1)}mm${weather.cityName?`・${weather.cityName}`:''}`:'天気データなし';
}

function renderToday(){
  if(!$('todayTaskSections')) return;
  const dashboard=todayDashboardItems(),allItems=[...dashboard.overdue,...dashboard.current,...dashboard.upcoming];
  renderTodayFilters(allItems);
  const overdue=dashboard.overdue.filter(todayItemMatches),current=dashboard.current.filter(todayItemMatches),upcoming=dashboard.upcoming.filter(todayItemMatches);
  $('todayDateLabel').textContent=new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(new Date(dashboard.bounds.start));
  const todayOverdue=dashboard.overdue.filter(item=>item.occurrenceDate===dashboard.bounds.date).length;
  $('todayPlanCount').textContent=`${dashboard.current.length+todayOverdue}件`;
  $('overduePlanCount').textContent=`${dashboard.overdue.length}件`;
  $('upcomingPlanCount').textContent=`${dashboard.upcoming.length}件`;
  todayWeatherText(dashboard.bounds);
  renderTodayGroup('todayOverdueSection','todayOverdueCount','todayOverdueTasks',overdue);
  renderTodayGroup('todayCurrentSection','todayCurrentCount','todayCurrentTasks',current);
  renderTodayGroup('todayUpcomingSection','todayUpcomingCount','todayUpcomingTasks',upcoming);
  $('todayEmpty').hidden=Boolean(overdue.length || current.length || upcoming.length);
  renderTodayRecentCare();renderTodayUndo();updateTodayBatchActions();
}

function snapshotTodayPlants(ids){
  return [...new Set(ids.map(String))].map(id=>{
    const plant=data.plants.find(item=>String(item.id)===id);
    return plant?{id,logs:[...(plant.logs || [])],plans:[...(plant.plans || [])].map(plan=>({...plan}))}:null;
  }).filter(Boolean);
}

function restoreTodaySnapshots(snapshots){
  snapshots.forEach(snapshot=>{
    const plant=data.plants.find(item=>String(item.id)===snapshot.id);
    if(plant){plant.logs=snapshot.logs;plant.plans=snapshot.plans;}
  });
}

function completePlanWithoutSaving(plant,plan,occurrenceDate){
  if(planCompletedOnDate(plant,plan,occurrenceDate)) return false;
  if(!Array.isArray(plant.logs)) plant.logs=[];
  const care=plan.care || '水やり';
  plant.logs.push({time:Date.now(),care,type:plan.type || (care==='水やり'?'通常':care),fertilizer:plan.fertilizer || 'なし',details:{...(plan.details || {})},note:plan.note || '今日画面から完了',photo:'',photoId:'',sourcePlanId:String(plan.id),sourcePlanDate:occurrenceDate});
  plant.logs.sort((a,b)=>Number(b.time)-Number(a.time));
  if((plan.recurrence?.unit || 'none')==='none') plant.plans=plant.plans.filter(item=>String(item.id)!==String(plan.id));
  return true;
}

window.completeTodayPlan=(plantId,planId,occurrenceDate=todayDayBounds().date)=>{
  const plant=data.plants.find(item=>String(item.id)===String(plantId)),plan=plant?.plans?.find(item=>String(item.id)===String(planId));
  if(!plant || !plan) return toast('ケア予定が見つかりません');
  const snapshots=snapshotTodayPlants([plantId]);
  if(!completePlanWithoutSaving(plant,plan,occurrenceDate)) return toast('この予定はすでに完了しています');
  setTodayUndoState({snapshots,message:`${plant.name} の${plan.care || '水やり'}を記録しました`});
  if(save()) trackPlantCareEvent('today_plan_completed',{care_type:plan.care || '水やり',recurrence:plan.recurrence?.unit || 'none'});
  else{setTodayUndoState(null);restoreTodaySnapshots(snapshots);render();}
};

window.postponeTodayPlan=(plantId,planId)=>{
  const plant=data.plants.find(item=>String(item.id)===String(plantId)),plan=plant?.plans?.find(item=>String(item.id)===String(planId));
  if(!plant || !plan) return toast('ケア予定が見つかりません');
  setTodayUndoState(null);
  const previous=Number(plan.startAt);plan.startAt=previous+86400000;plan.updatedAt=Date.now();
  if(save()){toast(`${plant.name} の予定を1日延期しました`);trackPlantCareEvent('today_plan_postponed',{recurrence:plan.recurrence?.unit || 'none'});}
  else{plan.startAt=previous;render();}
};

window.openDashboardCalendar=date=>{
  const target=new Date(`${date}T00:00:00`);calendarMonth=new Date(target.getFullYear(),target.getMonth(),1);selectedCalendarDate=date;setView('calendar');
};
window.recordRecentCareFromToday=index=>{const preset=todayRecentPresets[index];if(preset) openBatchCareRecording([],preset);};

$('todayPlantFilter').onchange=()=>{todayPlantFilter=$('todayPlantFilter').value;todaySelectedPlanKeys.clear();renderToday();};
$('todayCareFilter').onchange=()=>{todayCareFilter=$('todayCareFilter').value;todaySelectedPlanKeys.clear();renderToday();};
$('todaySelectModeBtn').onclick=()=>{todaySelectionMode=!todaySelectionMode;todaySelectedPlanKeys.clear();renderToday();};
$('todayTaskSections').onchange=event=>{
  if(!event.target.classList.contains('today-plan-check')) return;
  const key=todayPlanKey(event.target.dataset.plantId,event.target.dataset.planId,event.target.dataset.occurrenceDate);
  if(event.target.checked) todaySelectedPlanKeys.add(key);else todaySelectedPlanKeys.delete(key);
  renderToday();
};
$('completeSelectedTodayPlans').onclick=()=>{
  const targets=[];
  todaySelectedPlanKeys.forEach(key=>{
    const [plantId,planId,occurrenceDate]=key.split('::'),plant=data.plants.find(item=>String(item.id)===plantId),plan=plant?.plans?.find(item=>String(item.id)===planId);
    if(plant && plan) targets.push({plant,plan,occurrenceDate});
  });
  if(!targets.length) return;
  const snapshots=snapshotTodayPlants(targets.map(item=>item.plant.id)),completed=targets.filter(item=>completePlanWithoutSaving(item.plant,item.plan,item.occurrenceDate));
  setTodayUndoState({snapshots,message:`${completed.length}件の予定を完了しました`});todaySelectedPlanKeys.clear();
  if(save()) trackPlantCareEvent('today_plans_batch_completed',{plan_count:completed.length});
  else{setTodayUndoState(null);restoreTodaySnapshots(snapshots);render();}
};
$('postponeSelectedTodayPlans').onclick=()=>{
  setTodayUndoState(null);
  const targets=[];
  todaySelectedPlanKeys.forEach(key=>{const [plantId,planId]=key.split('::'),plant=data.plants.find(item=>String(item.id)===plantId),plan=plant?.plans?.find(item=>String(item.id)===planId);if(plan) targets.push(plan);});
  const previous=targets.map(plan=>({plan,startAt:plan.startAt,updatedAt:plan.updatedAt}));
  targets.forEach(plan=>{plan.startAt=Number(plan.startAt)+86400000;plan.updatedAt=Date.now();});todaySelectedPlanKeys.clear();
  if(save()){toast(`${targets.length}件の予定を1日延期しました`);trackPlantCareEvent('today_plans_batch_postponed',{plan_count:targets.length});}
  else{previous.forEach(item=>{item.plan.startAt=item.startAt;item.plan.updatedAt=item.updatedAt;});render();}
};
$('undoTodayAction').onclick=()=>{if(!todayUndoState)return;const snapshots=todayUndoState.snapshots;setTodayUndoState(null);restoreTodaySnapshots(snapshots);if(save())toast('完了を取り消しました');};
$('todayOpenCalendarBtn').onclick=()=>openDashboardCalendar(todayDayBounds().date);
$('todayPlansStat').onclick=()=>openDashboardCalendar(todayDayBounds().date);
$('overduePlansStat').onclick=()=>openDashboardCalendar(todayDayBounds().date);
$('upcomingPlansStat').onclick=()=>openDashboardCalendar(dateKey(new Date(todayDayBounds().start+86400000)));
$('todayWeatherStat').onclick=()=>openDashboardCalendar(todayDayBounds().date);
$('todayEmptyAddPlan').onclick=()=>$('navRecordBtn').click();
$('todayRefreshBtn').onclick=async()=>{await refreshWeather(true);renderToday();toast('今日の情報を更新しました');};
