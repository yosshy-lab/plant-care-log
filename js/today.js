function todayDayBounds(){
  const start=new Date();
  start.setHours(0,0,0,0);
  return {start:start.getTime(),end:start.getTime()+24*60*60*1000,date:dateKey(start)};
}

function planCompletedOnDate(plant,plan,date){
  return (plant.logs || []).some(log=>
    String(log.sourcePlanId || '')===String(plan.id) && log.sourcePlanDate===date
  );
}

function todayDashboardItems(){
  const bounds=todayDayBounds();
  const plans=[];
  const overdue=[];
  data.plants.forEach(plant=>{
    if(plantManagementStatus(plant)==='ended') return;
    (plant.plans || []).forEach(plan=>{
      if(planCompletedOnDate(plant,plan,bounds.date)) return;
      const item={kind:'plan',plant,plan};
      if(planOccursOnDate(plan,bounds.date)) plans.push(item);
      const oneTime=(plan.recurrence?.unit || 'none')==='none';
      if(oneTime && Number(plan.startAt)<Date.now()) overdue.push(item);
    });
  });
  const reminders=(data.reminders || []).filter(reminder=>planOccursOnDate(reminder,bounds.date));
  const overdueReminders=(data.reminders || []).filter(reminder=>
    (reminder.recurrence?.unit || 'none')==='none' && Number(reminder.startAt)<Date.now()
  );
  const uniquePlans=[...new Map([...overdue,...plans].map(item=>[
    `${String(item.plant.id)}:${String(item.plan.id)}`,item
  ])).values()];
  const displayReminders=[...new Map([...overdueReminders,...reminders].map(item=>[String(item.id),item])).values()];
  return {bounds,plans,overdue,reminders,overdueReminders,displayPlans:uniquePlans,displayReminders};
}

function dashboardTaskTime(plan,isOverdue){
  if(isOverdue) return '期限超過';
  return new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit'}).format(new Date(Number(plan.startAt)));
}

function renderToday(){
  if(!$('todayTasks')) return;
  const {bounds,plans,overdue,reminders,overdueReminders,displayPlans,displayReminders}=todayDashboardItems();
  const yesterday=new Date(bounds.start-24*60*60*1000);
  const yesterdayKey=dateKey(yesterday);
  const rain=Number(weather?.days?.[yesterdayKey]);
  $('todayDateLabel').textContent=new Intl.DateTimeFormat('ja-JP',{
    month:'long',day:'numeric',weekday:'short'
  }).format(new Date(bounds.start));
  $('todayPlanCount').textContent=`${plans.length+reminders.length}件`;
  $('overduePlanCount').textContent=`${overdue.length+overdueReminders.length}件`;
  $('yesterdayRainAmount').textContent=Number.isFinite(rain)?`${rain.toFixed(1)}mm`:'--';

  const planHtml=displayPlans.map(({plant,plan})=>{
    const isOverdue=Number(plan.startAt)<Date.now() && (plan.recurrence?.unit || 'none')==='none';
    return `<article class="today-task${isOverdue?' overdue':''}">
      <div class="today-task-heading">
        <div>
          <div class="today-task-name">${esc(plant.name)}</div>
          <div class="today-task-care">${esc(plan.care || '水やり')} ・ ${esc(recurrenceText(plan.recurrence))}</div>
        </div>
        <span class="today-task-time">${esc(dashboardTaskTime(plan,isOverdue))}</span>
      </div>
      ${plan.note?`<div class="today-task-note">${esc(plan.note)}</div>`:''}
      <div class="today-task-actions">
        <button class="today-task-complete" type="button" onclick="completeTodayPlan('${esc(String(plant.id))}','${esc(String(plan.id))}')">完了して記録</button>
        <button class="secondary" type="button" onclick="postponeTodayPlan('${esc(String(plant.id))}','${esc(String(plan.id))}')">1日延期</button>
      </div>
    </article>`;
  }).join('');

  const reminderHtml=displayReminders.map(reminder=>{
    const isOverdue=Number(reminder.startAt)<Date.now() && (reminder.recurrence?.unit || 'none')==='none';
    return `<article class="today-task today-reminder${isOverdue?' overdue':''}">
    <div class="today-task-heading">
      <div>
        <div class="today-task-name">${esc(reminder.title)}</div>
        <div class="today-task-care">備忘録 ・ ${esc(recurrenceText(reminder.recurrence))}</div>
      </div>
      <span class="today-task-time">${esc(dashboardTaskTime(reminder,isOverdue))}</span>
    </div>
    ${reminder.memo?`<div class="today-task-note">${esc(reminder.memo)}</div>`:''}
    <div class="today-task-actions">
      <button class="secondary" type="button" onclick="editReminder('${esc(String(reminder.id))}')">内容を確認・編集</button>
    </div>
  </article>`;
  }).join('');

  $('todayTasks').innerHTML=planHtml+reminderHtml || `<div class="today-empty">
    <strong>今日の予定はありません</strong>
    植物一覧からケアを記録するか、中央の「記録」から予定を追加できます。
  </div>`;
}

window.completeTodayPlan=(plantId,planId)=>{
  const plant=data.plants.find(item=>String(item.id)===String(plantId));
  const plan=plant?.plans?.find(item=>String(item.id)===String(planId));
  if(!plant || !plan) return toast('ケア予定が見つかりません');
  const occurrenceDate=todayDayBounds().date;
  if(planCompletedOnDate(plant,plan,occurrenceDate)) return toast('この予定は今日すでに完了しています');
  if(!Array.isArray(plant.logs)) plant.logs=[];
  const care=plan.care || '水やり';
  const log={
    time:Date.now(),
    care,
    type:plan.type || (care==='水やり'?'通常':care),
    fertilizer:plan.fertilizer || 'なし',
    details:{...(plan.details || {})},
    note:plan.note || '今日の予定から完了',
    photo:'',photoId:'',
    sourcePlanId:String(plan.id),sourcePlanDate:occurrenceDate
  };
  const previousLogs=[...plant.logs];
  const previousPlans=[...(plant.plans || [])];
  plant.logs.push(log);
  plant.logs.sort((a,b)=>Number(b.time)-Number(a.time));
  if((plan.recurrence?.unit || 'none')==='none'){
    plant.plans=plant.plans.filter(item=>String(item.id)!==String(plan.id));
  }
  if(save()){
    toast(`${plant.name} の${log.care}を記録しました`);
    trackPlantCareEvent('today_plan_completed',{care_type:log.care,recurrence:plan.recurrence?.unit || 'none'});
  }else{
    plant.logs=previousLogs;
    plant.plans=previousPlans;
    render();
  }
};

window.postponeTodayPlan=(plantId,planId)=>{
  const plant=data.plants.find(item=>String(item.id)===String(plantId));
  const plan=plant?.plans?.find(item=>String(item.id)===String(planId));
  if(!plant || !plan) return toast('ケア予定が見つかりません');
  const previous=Number(plan.startAt);
  plan.startAt=previous+24*60*60*1000;
  plan.updatedAt=Date.now();
  if(save()){
    toast(`${plant.name} の予定を1日延期しました`);
    trackPlantCareEvent('today_plan_postponed',{recurrence:plan.recurrence?.unit || 'none'});
  }else{
    plan.startAt=previous;
    render();
  }
};

function openDashboardCalendar(date){
  const target=new Date(`${date}T00:00:00`);
  calendarMonth=new Date(target.getFullYear(),target.getMonth(),1);
  selectedCalendarDate=date;
  setView('calendar');
}

$('todayOpenCalendarBtn').onclick=()=>openDashboardCalendar(todayDayBounds().date);
$('todayPlansStat').onclick=()=>openDashboardCalendar(todayDayBounds().date);
$('overduePlansStat').onclick=()=>openDashboardCalendar(todayDayBounds().date);
$('yesterdayRainStat').onclick=()=>{
  const yesterday=new Date(todayDayBounds().start-24*60*60*1000);
  openDashboardCalendar(dateKey(yesterday));
};
$('todayRefreshBtn').onclick=async()=>{
  await refreshWeather(true);
  renderToday();
  toast('今日の情報を更新しました');
};
