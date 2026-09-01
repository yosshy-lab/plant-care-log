function escapeCalendarText(value=''){
  return String(value)
    .replace(/\\/g,'\\\\')
    .replace(/\r?\n/g,'\\n')
    .replace(/,/g,'\\,')
    .replace(/;/g,'\\;');
}

function calendarLocalDateTime(timestamp){
  const date=new Date(Number(timestamp));
  if(!Number.isFinite(date.getTime())) return '';
  const part=value=>String(value).padStart(2,'0');
  return `${date.getFullYear()}${part(date.getMonth()+1)}${part(date.getDate())}T${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
}

function calendarUtcDateTime(timestamp=Date.now()){
  return new Date(timestamp).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

function calendarRecurrenceRule(recurrence={unit:'none',interval:1}){
  const frequency={day:'DAILY',week:'WEEKLY',month:'MONTHLY'}[recurrence.unit];
  if(!frequency) return '';
  const interval=Math.max(1,Number(recurrence.interval) || 1);
  return `RRULE:FREQ=${frequency};INTERVAL=${interval}`;
}

function calendarUid(type,ownerId,itemId){
  const safe=value=>encodeURIComponent(String(value)).replace(/%/g,'');
  return `${safe(type)}-${safe(ownerId)}-${safe(itemId)}@plant-care-log`;
}

function calendarEvent({uid,summary,startAt,description,recurrence}){
  const start=Number(startAt);
  const end=start+60*60*1000;
  const lines=[
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${calendarUtcDateTime()}`,
    `DTSTART:${calendarLocalDateTime(start)}`,
    `DTEND:${calendarLocalDateTime(end)}`,
    `SUMMARY:${escapeCalendarText(summary)}`
  ];
  if(description) lines.push(`DESCRIPTION:${escapeCalendarText(description)}`);
  const rule=calendarRecurrenceRule(recurrence);
  if(rule) lines.push(rule);
  lines.push('END:VEVENT');
  return lines;
}

function foldCalendarLine(line){
  const encoder=new TextEncoder();
  const chunks=[];
  let chunk='';
  for(const character of line){
    const candidate=chunk+character;
    const limit=chunks.length?74:75;
    if(chunk && encoder.encode(candidate).length>limit){
      chunks.push(chunk);
      chunk=character;
    }else chunk=candidate;
  }
  if(chunk || !chunks.length) chunks.push(chunk);
  return chunks.map((part,index)=>index?` ${part}`:part).join('\r\n');
}

function plantPlanCalendarItem(plant,plan){
  const care=plan.care || '水やり';
  const details=[];
  details.push(`植物：${plant.name}`);
  details.push(`ケア：${care}`);
  if(plan.note) details.push(`メモ：${plan.note}`);
  details.push(`繰り返し：${recurrenceText(plan.recurrence)}`);
  return {
    kind:'plan',
    uid:calendarUid('plan',plant.id,plan.id),
    summary:`[塊根植物記録] ${plant.name}・${care}`,
    startAt:plan.startAt,
    description:details.join('\n'),
    recurrence:plan.recurrence
  };
}

function reminderCalendarItem(reminder){
  const details=[];
  if(reminder.memo) details.push(`メモ：${reminder.memo}`);
  details.push(`繰り返し：${recurrenceText(reminder.recurrence)}`);
  return {
    kind:'reminder',
    uid:calendarUid('reminder','global',reminder.id),
    summary:`[塊根植物記録] ${reminder.title}`,
    startAt:reminder.startAt,
    description:details.join('\n'),
    recurrence:reminder.recurrence
  };
}

function isExportableCalendarItem(item){
  if(!Number.isFinite(Number(item.startAt))) return false;
  const recurrenceUnit=item.recurrence?.unit || 'none';
  return recurrenceUnit!=='none' || Number(item.startAt)>=Date.now();
}

function allCalendarExportItems(){
  const plans=data.plants.flatMap(plant=>(plant.plans || []).map(plan=>plantPlanCalendarItem(plant,plan)));
  const reminders=(data.reminders || []).map(reminderCalendarItem);
  return [...plans,...reminders].filter(isExportableCalendarItem);
}

function calendarItemsForScope(scope){
  const items=allCalendarExportItems();
  if(scope==='plans') return items.filter(item=>item.kind==='plan');
  if(scope==='reminders') return items.filter(item=>item.kind==='reminder');
  return items;
}

function createCalendarFile(items){
  const lines=[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plant Care Log//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  items.forEach(item=>lines.push(...calendarEvent(item)));
  lines.push('END:VCALENDAR');
  return `${lines.map(foldCalendarLine).join('\r\n')}\r\n`;
}

function downloadCalendarItems(items,filename){
  if(!items.length) return false;
  const blob=new Blob([createCalendarFile(items)],{type:'text/calendar;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  return true;
}

function calendarExportFilename(){
  const date=new Date();
  const part=value=>String(value).padStart(2,'0');
  return `plant-care-plans-${date.getFullYear()}-${part(date.getMonth()+1)}-${part(date.getDate())}.ics`;
}

function updateCalendarExportDialog(){
  const scope=$('calendarExportScope').value;
  const items=calendarItemsForScope(scope);
  const planCount=items.filter(item=>item.kind==='plan').length;
  const reminderCount=items.filter(item=>item.kind==='reminder').length;
  $('calendarExportSummary').textContent=items.length
    ?`ケア予定 ${planCount}件・備忘録 ${reminderCount}件を書き出します。`
    :'書き出せる未来の予定はありません。';
  $('saveCalendarExport').disabled=!items.length;
}

$('calendarExportBtn').onclick=()=>{
  closeDataMenu();
  $('calendarExportScope').value='all';
  updateCalendarExportDialog();
  $('calendarExportDialog').showModal();
};
$('calendarExportScope').onchange=updateCalendarExportDialog;
$('cancelCalendarExport').onclick=()=> $('calendarExportDialog').close();
$('saveCalendarExport').onclick=()=>{
  const items=calendarItemsForScope($('calendarExportScope').value);
  if(!downloadCalendarItems(items,calendarExportFilename())) return;
  $('calendarExportDialog').close();
  toast(`${items.length}件のカレンダー用ファイルを作成しました`);
  trackPlantCareEvent('calendar_exported',{item_count:items.length,scope:$('calendarExportScope').value});
};

window.exportPlantCarePlan=(plantId,planId)=>{
  const plant=data.plants.find(item=>String(item.id)===String(plantId));
  const plan=plant?.plans?.find(item=>String(item.id)===String(planId));
  if(!plant || !plan) return toast('ケア予定が見つかりません');
  downloadCalendarItems([plantPlanCalendarItem(plant,plan)],calendarExportFilename());
  trackPlantCareEvent('calendar_plan_exported');
};

window.exportGlobalReminder=reminderId=>{
  const reminder=(data.reminders || []).find(item=>String(item.id)===String(reminderId));
  if(!reminder) return toast('備忘録が見つかりません');
  downloadCalendarItems([reminderCalendarItem(reminder)],calendarExportFilename());
  trackPlantCareEvent('calendar_reminder_exported');
};
