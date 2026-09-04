let editingReminderId=null;

function reminderItems(){
  if(!Array.isArray(data.reminders)) data.reminders=[];
  return data.reminders;
}

function updateReminderRecurrenceFields(){
  const unit=$('reminderRecurrenceUnit').value;
  const interval=Math.max(1,Number($('reminderRecurrenceInterval').value) || 1);
  $('reminderRecurrenceIntervalFields').hidden=unit==='none';
  $('reminderRecurrenceIntervalUnit').textContent=unit==='day'?'日おき':unit==='week'?'週間おき':'か月おき';
  $('reminderRecurrenceSummary').textContent=unit==='none'
    ?'この日時に1回だけ表示します。'
    :`${recurrenceText({unit,interval})}、カレンダーに繰り返し表示します。`;
}

function renderRemindersList(){
  const reminders=[...reminderItems()].sort((a,b)=>Number(a.startAt)-Number(b.startAt));
  $('remindersList').innerHTML=reminders.length?reminders.map(reminder=>`
    <div class="plan-item">
      <div class="history-title">${esc(reminder.title)}</div>
      <div class="history-note">${fmtDate(reminder.startAt)}</div>
      <div class="plan-repeat">${esc(recurrenceText(reminder.recurrence))}</div>
      ${reminder.memo?`<div class="history-note reminder-memo">${esc(reminder.memo)}</div>`:''}
      <div class="history-actions">
        <button class="secondary" type="button" onclick="exportGlobalReminder('${esc(String(reminder.id))}')">カレンダー</button>
        <button class="secondary" type="button" onclick="editReminder('${esc(String(reminder.id))}')">編集</button>
        <button class="danger" type="button" onclick="removeReminder('${esc(String(reminder.id))}')">削除</button>
      </div>
    </div>`).join(''):'<div class="empty">備忘録はまだありません。</div>';
}

function openReminders(){
  closeDataMenu();
  renderRemindersList();
  $('remindersDialog').showModal();
  trackPlantCareEvent('reminders_viewed');
}

function openReminderEditor({id=null,date=null}={}){
  editingReminderId=id===null?null:String(id);
  const reminder=editingReminderId===null?null:reminderItems().find(item=>String(item.id)===editingReminderId);
  if(editingReminderId!==null && !reminder) return;
  $('reminderDialogTitle').textContent=reminder?'備忘録を編集':'備忘録を追加';
  $('saveReminder').textContent=reminder?'変更を保存':'予定を保存';
  $('reminderTitle').value=reminder?.title || '';
  $('reminderStartAt').value=toDateTimeLocal(reminder?.startAt || (date?scheduleTimeForDate(date):Date.now()+60*60*1000));
  $('reminderMemo').value=reminder?.memo || '';
  $('reminderRecurrenceUnit').value=reminder?.recurrence?.unit || 'none';
  $('reminderRecurrenceInterval').value=String(reminder?.recurrence?.interval || 1);
  clearFieldError('reminderTitle');
  clearFieldError('reminderStartAt');
  updateReminderRecurrenceFields();
  $('reminderDialog').showModal();
  markInputPristine($('reminderDialog'));
}

window.editReminder=id=>{
  if($('remindersDialog').open) $('remindersDialog').close();
  openReminderEditor({id});
};

window.removeReminder=id=>{
  if(!confirm('この備忘録を削除しますか？')) return;
  const previous=[...reminderItems()];
  data.reminders=data.reminders.filter(reminder=>String(reminder.id)!==String(id));
  if(save()){
    renderRemindersList();
    if(!$('calendarView').classList.contains('hidden')) renderCalendar();
    toast('備忘録を削除しました');
    trackPlantCareEvent('reminder_deleted');
  }else{
    data.reminders=previous;
    render();
  }
};

window.openCalendarReminder=date=>{
  if(date<dateKey(new Date())) return toast('過去の日付には備忘録を追加できません');
  if(typeof closeCalendarDayPanel==='function') closeCalendarDayPanel();
  openReminderEditor({date});
};

$('closeReminders').onclick=()=> $('remindersDialog').close();
$('addReminder').onclick=()=>{
  $('remindersDialog').close();
  openReminderEditor();
};
$('cancelReminder').onclick=()=>requestInputDialogClose($('reminderDialog'));
$('reminderRecurrenceUnit').onchange=updateReminderRecurrenceFields;
$('reminderRecurrenceInterval').oninput=updateReminderRecurrenceFields;
$('saveReminder').onclick=()=>{
  const title=$('reminderTitle').value.trim();
  if(!title) return showFieldError('reminderTitle','予定名を入力してください。');
  const startAt=new Date($('reminderStartAt').value).getTime();
  if(!Number.isFinite(startAt)) return showFieldError('reminderStartAt','予定日時を入力してください。');
  if(editingReminderId===null && startAt<=Date.now()) return alert('予定日時には現在より後の日時を入力してください');
  const recurrence={
    unit:$('reminderRecurrenceUnit').value,
    interval:Math.max(1,Math.min(365,Number($('reminderRecurrenceInterval').value) || 1))
  };
  const reminder={
    id:editingReminderId || crypto.randomUUID(),
    title,
    startAt,
    memo:$('reminderMemo').value.trim(),
    recurrence,
    createdAt:Date.now()
  };
  const previous=[...reminderItems()];
  const index=data.reminders.findIndex(item=>String(item.id)===editingReminderId);
  if(index>=0) reminder.createdAt=data.reminders[index].createdAt || reminder.createdAt;
  if(index>=0) data.reminders[index]=reminder;
  else data.reminders.push(reminder);
  data.reminders.sort((a,b)=>Number(a.startAt)-Number(b.startAt));
  if(save()){
    closeInputDialogAfterSave($('reminderDialog'));
    renderRemindersList();
    if(!$('calendarView').classList.contains('hidden')) renderCalendar();
    toast(index>=0?'備忘録を変更しました':'備忘録を登録しました');
    trackPlantCareEvent(index>=0?'reminder_edited':'reminder_created',{recurrence:recurrence.unit});
  }else{
    data.reminders=previous;
    render();
  }
};
