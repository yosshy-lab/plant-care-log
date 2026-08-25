

function toast(msg){
  const t=$('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
}
function esc(s=''){
  return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

const RELEASE_NOTES=[
  {
    version:'1.7.0',date:'2026年8月25日',title:'写真保存をIndexedDBへ移行',
    items:[
      '既存写真を、より大容量の写真ストレージへ初回起動時に自動移行します。',
      '株登録写真と状態・写真記録をIndexedDBへ保存するように変更しました。',
      'メニュー内で写真枚数とブラウザの使用容量・容量目安を確認できます。',
      'バックアップと復元では、これまでどおり写真を含めて移行できます。'
    ]
  },
  {
    version:'1.6.0',date:'2026年8月25日',title:'ケア予定と当日降雨記録に対応',
    items:[
      '単発または日・週・月単位の繰り返しケア予定を登録できるようになりました。',
      '隔週・隔月など、任意の間隔を指定できます。',
      '当日の降水も、予報を含む注意を確認して水やりとして記録できます。',
      'ケア予定をバックアップ・復元の対象に追加しました。'
    ]
  },
  {
    version:'1.5.1',date:'2026年8月22日',title:'説明文と内部構成を整備',
    items:['README、プライバシー説明、利用上の注意を整備しました。','JavaScriptを機能別ファイルへ分割しました。']
  },
  {
    version:'1.5.0',date:'2026年8月21日',title:'過去のケア記録を拡充',
    items:['過去日時のケア登録と、既存履歴の編集に対応しました。','カレンダーの過去日からケアを追加できるようになりました。']
  },
  {
    version:'1.4.0',date:'2026年8月21日',title:'バックアップを強化',
    items:['バックアップ時期の案内、内容検証、復元取り消しを追加しました。']
  },
  {
    version:'1.3.0〜1.3.2',date:'2026年8月21日',title:'検索と品質確認を追加',
    items:['株の検索・絞り込み、休眠・管理終了に対応しました。','自動テストとJavaScript・CSSのファイル分割を導入しました。']
  },
  {
    version:'1.2.0',date:'2026年8月21日',title:'並べ替えとカレンダーを改善',
    items:['株の並べ替えと、カレンダーの土日表示を追加しました。']
  },
  {
    version:'1.1.0〜1.1.1',date:'2026年8月21日',title:'アクセス解析と表示を改善',
    items:['任意停止できる匿名アクセス解析を追加しました。','ケア操作ボタンの幅とレスポンシブ表示を整えました。']
  },
  {
    version:'1.0.0',date:'2026年8月21日',title:'最初の正式版',
    items:['植物情報、ケア履歴、カレンダー、降水量、バックアップなどの基本機能を公開しました。']
  }
];

function openReleaseNotes(source='menu'){
  closeDataMenu();
  $('releaseNotesList').innerHTML=RELEASE_NOTES.map((release,index)=>`
    <section class="release-note-item${index===0?' latest':''}">
      <div class="release-note-heading">
        <strong>v${esc(release.version)}</strong><span>${esc(release.date)}</span>
      </div>
      <h3>${esc(release.title)}</h3>
      <ul>${release.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>
    </section>`).join('');
  $('releaseNotesDialog').showModal();
  trackPlantCareEvent('release_notes_viewed',{source});
}

function initializeReleaseNotes(){
  const latest=RELEASE_NOTES[0];
  $('releaseNoticeVersion').textContent=`v${latest.version} 更新`;
  $('releaseNoticeTitle').textContent=latest.title;
  const alreadySeen=localStorage.getItem(RELEASE_SEEN_KEY)===APP_VERSION;
  $('releaseNotice').hidden=alreadySeen;
  if(!alreadySeen) localStorage.setItem(RELEASE_SEEN_KEY,APP_VERSION);
}
function fmtDate(ts){
  if(!ts) return '記録なし';
  const d=new Date(ts);
  return new Intl.DateTimeFormat('ja-JP',{
    year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'
  }).format(d);
}
function toDateTimeLocal(ts=Date.now()){
  const d=new Date(ts);
  const pad=value=>String(value).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function recordedAtValue(id){
  const value=$(id).value;
  const timestamp=value?new Date(value).getTime():NaN;
  if(!Number.isFinite(timestamp)){
    alert('記録日時を入力してください');
    return null;
  }
  if(timestamp>Date.now()){
    alert('未来の日時はケア履歴として登録できません。予定として管理してください。');
    return null;
  }
  return timestamp;
}

function careTimeForDate(date){
  const now=new Date();
  const candidate=new Date(`${date}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`);
  if(candidate.getTime()<=now.getTime()) return candidate.getTime();
  return new Date(`${date}T12:00:00`).getTime();
}

function scheduleTimeForDate(date){
  const now=new Date();
  const candidate=new Date(`${date}T09:00:00`);
  if(candidate.getTime()>now.getTime()) return candidate.getTime();
  return now.getTime()+60*60*1000;
}

function planDateTimeValue(id){
  const value=$(id).value;
  const timestamp=value?new Date(value).getTime():NaN;
  if(!Number.isFinite(timestamp)){
    alert('予定日時を入力してください');
    return null;
  }
  if(timestamp<=Date.now()){
    alert('予定日時には現在より後の日時を入力してください。過去のケアは履歴として記録できます。');
    return null;
  }
  return timestamp;
}

function recurrenceText(recurrence={unit:'none',interval:1}){
  const interval=Math.max(1,Number(recurrence.interval) || 1);
  if(recurrence.unit==='day') return interval===1?'毎日':`${interval}日おき`;
  if(recurrence.unit==='week') return interval===1?'毎週':interval===2?'隔週':`${interval}週間おき`;
  if(recurrence.unit==='month') return interval===1?'毎月':interval===2?'隔月':`${interval}か月おき`;
  return '1回のみ';
}

function elapsed(ts){
  if(!ts) return {main:'未記録',sub:'最初のケアを記録してください'};
  const diff=Date.now()-ts;
  const days=Math.floor(diff/86400000);
  const hours=Math.floor(diff/3600000);
  const mins=Math.floor(diff/60000);
  if(days>=1) return {main:`${days}日`,sub:'前回のケアから'};
  if(hours>=1) return {main:`${hours}時間`,sub:'前回のケアから'};
  return {main:`${Math.max(0,mins)}分`,sub:'前回のケアから'};
}

function applyListLayout(){
  const isGrid=listLayout==='grid';
  $('plants').classList.toggle('grid-layout',isGrid);
  $('listLayoutBtn').classList.toggle('active',!isGrid);
  $('gridLayoutBtn').classList.toggle('active',isGrid);
  $('listLayoutBtn').setAttribute('aria-pressed',String(!isGrid));
  $('gridLayoutBtn').setAttribute('aria-pressed',String(isGrid));
}

function setListLayout(layout){
  listLayout=layout==='grid'?'grid':'list';
  localStorage.setItem(LIST_LAYOUT_KEY,listLayout);
  applyListLayout();
}

function plantManagementStatus(plant){
  return ['active','dormant','ended'].includes(plant.managementStatus)?plant.managementStatus:'active';
}

function plantStatusBadge(plant){
  const status=plantManagementStatus(plant);
  if(status==='dormant') return '<span class="plant-status dormant">休眠中</span>';
  if(status==='ended') return '<span class="plant-status ended">管理終了</span>';
  return '';
}

function filteredPlants(){
  const query=$('plantSearch').value.trim().toLocaleLowerCase('ja-JP');
  const statusFilter=$('plantStatusFilter').value;
  const stageFilter=$('plantStageFilter').value;
  return data.plants.filter(plant=>{
    const status=plantManagementStatus(plant);
    const statusMatch=statusFilter==='all' ||
      (statusFilter==='current' && status!=='ended') ||
      status===statusFilter;
    const stageMatch=!stageFilter || (plant.stage || '成株')===stageFilter;
    const searchTarget=[plant.name,plant.type,plant.location,plant.source,plant.memo]
      .filter(Boolean).join(' ').toLocaleLowerCase('ja-JP');
    const queryMatch=!query || searchTarget.includes(query);
    return statusMatch && stageMatch && queryMatch;
  });
}

function render(){
  const root=$('plants');
  applyListLayout();
  if(!data.plants.length){
    $('filterResultCount').textContent='';
    root.innerHTML='<div class="card empty">まだ植物がありません。<br>「＋ 植物を追加」から登録してください。</div>';
    renderCalendarFilters();
    if(!$('calendarView').classList.contains('hidden')) renderCalendar();
    return;
  }
  const visiblePlants=filteredPlants();
  $('filterResultCount').textContent=`${visiblePlants.length}株を表示／登録 ${data.plants.length}株`;
  if(!visiblePlants.length){
    root.innerHTML='<div class="card empty">条件に一致する株がありません。<br>検索語や絞り込みを変更してください。</div>';
    renderCalendarFilters();
    if(!$('calendarView').classList.contains('hidden')) renderCalendar();
    return;
  }
  root.innerHTML=visiblePlants.map(p=>{
    const last=p.logs?.[0];
    const e=elapsed(last?.time);
    const status=plantManagementStatus(p);
    const careActions=status==='ended'
      ?'<div class="care-closed-note">管理終了した株です</div>'
      :`<div class="care-actions">
        <button class="care" onclick="event.stopPropagation();openCare('${p.id}')">＋ ケアを記録</button>
        <button class="quick-water" onclick="event.stopPropagation();quickWater('${p.id}')">💧 水やり</button>
      </div>`;
    return `<div class="card plant-card" role="button" tabindex="0"
      aria-label="${esc(p.name)}の詳細を表示"
      onclick="handlePlantCardClick('${p.id}',event)" onkeydown="handlePlantCardKey('${p.id}',event)">
      <div class="plant-summary">
        <div class="name">${esc(p.name)}</div>
        <div class="meta">${esc(p.stage || '成株')}${p.type?` ・ ${esc(p.type)}`:''}${plantStatusBadge(p)}</div>
      </div>
      <div class="elapsed">${e.main} <span>${e.sub}</span></div>
      <div class="meta">前回：${fmtDate(last?.time)}</div>
      ${careActions}
    </div>`;
  }).join('');
  renderCalendarFilters();
  if(!$('calendarView').classList.contains('hidden')) renderCalendar();
}

window.quickWater=id=>{
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  if(plantManagementStatus(p)==='ended') return toast('管理終了した株には記録できません');
  if(!Array.isArray(p.logs)) p.logs=[];
  const now=Date.now();
  if(p.logs.some(log=>Math.abs(now-Number(log.time))<=10000)){
    toast('10秒以内に記録済みのため、重複を防止しました');
    return;
  }
  const log={
    time:now,
    care:'水やり',
    type:'通常',
    fertilizer:'なし',
    note:'一覧の水やりボタンから記録'
  };
  p.logs.unshift(log);
  p.logs.sort((a,b)=>b.time-a.time);
  if(save()){
    toast(`💧 ${p.name} の水やりを記録しました`);
    trackPlantCareEvent('water_recorded',{method:'quick'});
  }else p.logs=p.logs.filter(item=>item!==log);
};

$('listLayoutBtn').onclick=()=>setListLayout('list');
$('gridLayoutBtn').onclick=()=>setListLayout('grid');
$('plantSearch').oninput=render;
$('plantStatusFilter').onchange=render;
$('plantStageFilter').onchange=render;

function handlePlantCardClick(id,event){
  if(event.target.closest('button,.menu-panel')) return;
  openPlantDetails(id);
}

function handlePlantCardKey(id,event){
  if((event.key==='Enter' || event.key===' ') && !event.target.closest('button')){
    event.preventDefault();
    openPlantDetails(id);
  }
}

function dateOnly(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return esc(value || '未設定');
  const [year,month,day]=value.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function detailItem(label,value,wide=false){
  if(value===undefined || value===null || value==='') return '';
  return `<div class="${wide?'detail-wide':''}"><div class="detail-label">${esc(label)}</div><div class="detail-value">${value}</div></div>`;
}

function openPlantDetails(id){
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  detailPlantId=p.id;
  const last=p.logs?.[0];
  const validPhoto=/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.photo || '');
  const photo=validPhoto?`<img class="detail-photo" src="${p.photo}" alt="${esc(p.name)}の登録写真">`:'';
  const price=p.price!=='' && p.price!==undefined && Number.isFinite(Number(p.price))
    ?`${Number(p.price).toLocaleString('ja-JP')}円`:'';
  const acquisition=[
    detailItem('入手日',p.acquiredDate?dateOnly(p.acquiredDate):''),
    detailItem('入手方法',p.acquisitionMethod?esc(p.acquisitionMethod):''),
    detailItem('入手先',p.source?esc(p.source):''),
    detailItem('購入価格',price),
    detailItem('由来',p.origin?esc(p.origin):'')
  ].join('');
  const cultivation=[
    detailItem('播種日',p.sowingDate?dateOnly(p.sowingDate):''),
    detailItem('発芽日',p.germinationDate?dateOnly(p.germinationDate):''),
    detailItem('管理場所',p.location?esc(p.location):''),
    detailItem('雨の当たり方',p.rainExposure==='sheltered'?'雨が当たらない':'雨が当たる'),
    detailItem('メモ',p.memo?`<span class="detail-note">${esc(p.memo)}</span>`:'',true)
  ].join('');
  const latest=last
    ?`<div class="detail-latest"><div class="detail-latest-title">${esc(last.care || '水やり')}</div><div class="detail-latest-meta">${fmtDate(last.time)}</div><div class="detail-value">${careDetailHtml(last)}</div>${photoHtml(last.photo)}</div>`
    :'<div class="detail-value">ケア履歴はまだありません。</div>';
  $('plantDetailsContent').innerHTML=`
    <div class="detail-hero">${photo}<div><h2 class="detail-title">${esc(p.name)}</h2>
      <div class="detail-subtitle">${esc(p.stage || '成株')}${p.type?` ・ ${esc(p.type)}`:''}${plantStatusBadge(p)}</div>
      </div></div>
    ${acquisition?`<section class="detail-section"><h3>入手情報</h3><div class="detail-grid">${acquisition}</div></section>`:''}
    ${cultivation?`<section class="detail-section"><h3>栽培情報・メモ</h3><div class="detail-grid">${cultivation}</div></section>`:''}
    <section class="detail-section"><h3>直近のケア</h3>${latest}</section>`;
  $('carePlantDetails').disabled=plantManagementStatus(p)==='ended';
  $('plantDetailsDialog').showModal();
  trackPlantCareEvent('plant_details_viewed');
}

$('closePlantDetails').onclick=()=> $('plantDetailsDialog').close();
$('editPlantDetails').onclick=()=>{
  const id=detailPlantId;
  $('plantDetailsDialog').close();
  openPlantEditor(id);
};
$('carePlantDetails').onclick=()=>{
  const id=detailPlantId;
  $('plantDetailsDialog').close();
  openCare(id);
};
$('historyPlantDetails').onclick=()=>{
  const id=detailPlantId;
  $('plantDetailsDialog').close();
  showHistory(id);
};
$('plansPlantDetails').onclick=()=>{
  const id=detailPlantId;
  $('plantDetailsDialog').close();
  showPlans(id);
};
$('shortcutPlantDetails').onclick=()=>{
  const id=detailPlantId;
  $('plantDetailsDialog').close();
  copyShortcutUrl(id);
};
$('deletePlantDetails').onclick=()=>{
  const id=detailPlantId;
  const count=data.plants.length;
  removePlant(id);
  if(data.plants.length<count) $('plantDetailsDialog').close();
};

let editingPlantId=null;
let editingPlantPhoto='';
let editingPlantPhotoId='';
let editingPlantPhotoChanged=false;

const PLANT_FIELD_IDS=[
  'plantName','plantType','plantAcquiredDate','plantSource','plantPrice',
  'plantSowingDate','plantGerminationDate','plantLocation','plantMemo'
];

function togglePlantConditionalFields(){
  $('purchasePriceFields').hidden=$('plantAcquisitionMethod').value!=='購入';
  $('seedDateFields').hidden=!['実生','播種'].includes($('plantStage').value);
}

function setPlantPhotoPreview(photo){
  editingPlantPhoto=photo || '';
  $('plantPhotoPreview').src=editingPlantPhoto;
  $('plantPhotoPreview').style.display=editingPlantPhoto?'block':'none';
  $('removePlantPhoto').style.display=editingPlantPhoto?'inline-block':'none';
}

function resetPlantForm(){
  PLANT_FIELD_IDS.forEach(id=>$(id).value='');
  $('plantStage').value='成株';
  $('plantManagementStatus').value='active';
  $('plantAcquisitionMethod').value='';
  $('plantOrigin').value='';
  $('plantRainExposure').value='rain';
  $('plantPhoto').value='';
  $('acquisitionSection').open=false;
  $('cultivationSection').open=false;
  $('plantRecordMeta').hidden=true;
  setPlantPhotoPreview('');
  editingPlantPhotoId='';
  editingPlantPhotoChanged=false;
  togglePlantConditionalFields();
}

function openNewPlant(){
  editingPlantId=null;
  resetPlantForm();
  $('plantDialogTitle').textContent='植物を追加';
  $('savePlant').textContent='登録する';
  $('plantDialog').showModal();
}

window.openPlantEditor=id=>{
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  editingPlantId=p.id;
  resetPlantForm();
  $('plantDialogTitle').textContent='株情報を編集';
  $('savePlant').textContent='変更を保存';
  $('plantName').value=p.name || '';
  $('plantType').value=p.type || '';
  $('plantStage').value=p.stage || '成株';
  $('plantManagementStatus').value=p.managementStatus || 'active';
  $('plantAcquiredDate').value=p.acquiredDate || '';
  $('plantAcquisitionMethod').value=p.acquisitionMethod || '';
  $('plantSource').value=p.source || '';
  $('plantPrice').value=p.price ?? '';
  $('plantOrigin').value=p.origin || '';
  $('plantSowingDate').value=p.sowingDate || '';
  $('plantGerminationDate').value=p.germinationDate || '';
  $('plantLocation').value=p.location || '';
  $('plantRainExposure').value=p.rainExposure || 'rain';
  $('plantMemo').value=p.memo || '';
  editingPlantPhotoId=p.photoId || '';
  setPlantPhotoPreview(p.photo || '');
  $('acquisitionSection').open=Boolean(p.acquiredDate || p.acquisitionMethod || p.source || p.price || p.origin);
  $('cultivationSection').open=Boolean(p.sowingDate || p.germinationDate || p.location || p.memo || p.photo || p.rainExposure==='sheltered');
  if(p.createdAt){
    $('plantRecordMeta').hidden=false;
    $('plantRecordMeta').textContent=`登録：${fmtDate(p.createdAt)}${p.updatedAt?`　更新：${fmtDate(p.updatedAt)}`:''}`;
  }
  togglePlantConditionalFields();
  $('plantDialog').showModal();
};

$('addBtn').onclick=openNewPlant;
$('plantStage').onchange=togglePlantConditionalFields;
$('plantAcquisitionMethod').onchange=togglePlantConditionalFields;
$('plantPhoto').onchange=async()=>{
  const file=$('plantPhoto').files[0];
  if(!file) return;
  try{
    setPlantPhotoPreview(await compressImage(file));
    editingPlantPhotoChanged=true;
  }catch(e){
    alert(e.message);
    $('plantPhoto').value='';
  }
};
$('removePlantPhoto').onclick=()=>{
  $('plantPhoto').value='';
  setPlantPhotoPreview('');
  editingPlantPhotoChanged=true;
};
$('cancelPlant').onclick=()=> $('plantDialog').close();
$('savePlant').onclick=async()=>{
  const name=$('plantName').value.trim();
  if(!name) return alert('管理名を入力してください');
  const now=Date.now();
  const previousPhotoId=editingPlantPhotoId;
  let photoId=previousPhotoId;
  if(editingPlantPhotoChanged && photoStorageAvailable){
    try{
      photoId=editingPlantPhoto?await savePhotoData(editingPlantPhoto,null,'plant-photo'):'';
    }catch(error){
      alert('写真を保存できませんでした。端末の空き容量を確認して、もう一度お試しください。');
      return;
    }
  }
  if(editingPlantPhotoChanged && !editingPlantPhoto) photoId='';
  const details={
    name,
    stage:$('plantStage').value,
    managementStatus:$('plantManagementStatus').value,
    type:$('plantType').value.trim(),
    acquiredDate:$('plantAcquiredDate').value,
    acquisitionMethod:$('plantAcquisitionMethod').value,
    source:$('plantSource').value.trim(),
    price:$('plantAcquisitionMethod').value==='購入' && $('plantPrice').value!==''?Number($('plantPrice').value):'',
    origin:$('plantOrigin').value,
    sowingDate:['実生','播種'].includes($('plantStage').value)?$('plantSowingDate').value:'',
    germinationDate:['実生','播種'].includes($('plantStage').value)?$('plantGerminationDate').value:'',
    location:$('plantLocation').value.trim(),
    rainExposure:$('plantRainExposure').value,
    memo:$('plantMemo').value.trim(),
    photo:editingPlantPhoto,
    photoId,
    updatedAt:now
  };
  if(editingPlantId!==null){
    const p=data.plants.find(x=>String(x.id)===String(editingPlantId));
    if(!p) return alert('編集する株が見つかりませんでした');
    const previous={...p};
    Object.assign(p,details);
    if(save()){
      if(previousPhotoId && previousPhotoId!==photoId) await deletePhotoRecord(previousPhotoId);
      updatePhotoStorageStatus();
      $('plantDialog').close();
      toast('株情報を更新しました');
      trackPlantCareEvent('plant_updated');
    }else{
      if(photoId && photoId!==previousPhotoId) await deletePhotoRecord(photoId);
      Object.assign(p,previous);
      render();
    }
  }else{
    const newPlant={
      id:crypto.randomUUID(),
      ...details,
      createdAt:now,
      logs:[],
      plans:[]
    };
    data.plants.push(newPlant);
    if(save()){
      updatePhotoStorageStatus();
      $('plantDialog').close();
      toast('植物を登録しました');
      trackPlantCareEvent('plant_added');
    }else{
      if(photoId) await deletePhotoRecord(photoId);
      data.plants=data.plants.filter(p=>p!==newPlant);
      render();
    }
  }
};

const CARE_FIELD_IDS={
  '水やり':'waterFields',
  '薬剤散布':'pesticideFields',
  '植え替え':'repotFields',
  '施肥':'fertilizeFields',
  '状態・写真記録':'growthFields'
};

function toggleCareFields(){
  Object.values(CARE_FIELD_IDS).forEach(id=>$(id).hidden=true);
  const selected=CARE_FIELD_IDS[$('careType').value];
  if(selected) $(selected).hidden=false;
}

let editingLogIndex=null;
let editingPlanId=null;
let careMode='record';
let editingCarePhoto='';
let editingCarePhotoId='';

function resetCareForm(){
  ['waterAmount','pesticideName','pesticideTarget','pesticideDilution','pesticideNextDate',
   'potType','potSize','soilMix','repotReason','fertilizerName','fertilizerAmount',
   'plantHeight','trunkWidth','leafCount','waterNote'].forEach(id=>$(id).value='');
  $('waterType').value='たっぷり灌水';
  $('fertilizer').value='なし';
  $('pesticideMethod').value='散布';
  $('fertilizerForm').value='液肥';
  $('rootPruned').checked=false;
  $('carePhoto').value='';
  $('careRecordedAt').value=toDateTimeLocal();
  $('careRecordedAt').max=toDateTimeLocal();
  $('recurrenceUnit').value='none';
  $('recurrenceInterval').value='1';
  editingCarePhoto='';
  editingCarePhotoId='';
  $('photoPreview').src='';
  $('photoPreview').style.display='none';
}

function updateRecurrenceFields(){
  const unit=$('recurrenceUnit').value;
  const interval=Math.max(1,Number($('recurrenceInterval').value) || 1);
  $('recurrenceIntervalFields').hidden=unit==='none';
  $('recurrenceIntervalUnit').textContent=unit==='day'?'日おき':unit==='week'?'週間おき':'か月おき';
  $('recurrenceSummary').textContent=unit==='none'
    ?'この日時に1回だけ予定します。'
    :`${recurrenceText({unit,interval})}、同じケアを予定として表示します。`;
}

function compressImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('写真を読み込めませんでした'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('この写真形式は読み込めませんでした'));
      img.onload=()=>{
        const maxSide=900;
        const scale=Math.min(1,maxSide/Math.max(img.width,img.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.width*scale));
        canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.72));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

window.openCare=(id,options={})=>{
  currentId=id;
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  if(plantManagementStatus(p)==='ended') return toast('管理終了した株には記録できません');
  careMode=options.mode==='plan'?'plan':'record';
  editingLogIndex=Number.isInteger(options.logIndex)?options.logIndex:null;
  editingPlanId=options.planId===undefined || options.planId===null?null:String(options.planId);
  resetCareForm();
  const existing=careMode==='plan'
    ?(p.plans || []).find(plan=>String(plan.id)===editingPlanId)
    :(editingLogIndex===null?null:p.logs?.[editingLogIndex]);
  $('recurrenceFields').hidden=careMode!=='plan';
  $('carePhotoFields').hidden=careMode==='plan';
  $('careDateLabel').textContent=careMode==='plan'?'予定日時':'記録日時';
  $('careDateHint').textContent=careMode==='plan'
    ?'開始日時と繰り返し間隔を指定してください。月末に存在しない日付は、その月の末日に予定します。'
    :'記録を忘れた場合は、実際にケアした過去の日時へ変更できます。';
  $('careRecordedAt').max=careMode==='plan'?'':toDateTimeLocal();
  if(existing){
    const details=existing.details || {};
    $('careTitle').textContent=careMode==='plan'?`${p.name} のケア予定を編集`:`${p.name} のケア記録を編集`;
    $('saveCare').textContent='変更を保存';
    $('careType').value=existing.care || '水やり';
    $('careRecordedAt').value=toDateTimeLocal(careMode==='plan'?existing.startAt:existing.time);
    $('waterType').value=existing.type || 'たっぷり灌水';
    $('fertilizer').value=existing.fertilizer || 'なし';
    $('waterAmount').value=details.waterAmount || '';
    $('pesticideName').value=details.name || '';
    $('pesticideTarget').value=details.target || '';
    $('pesticideDilution').value=details.dilution || '';
    $('pesticideMethod').value=details.method || '散布';
    $('pesticideNextDate').value=details.nextDate || '';
    $('potType').value=details.potType || '';
    $('potSize').value=details.potSize || '';
    $('soilMix').value=details.soilMix || '';
    $('rootPruned').checked=Boolean(details.rootPruned);
    $('repotReason').value=details.reason || '';
    $('fertilizerName').value=details.name || '';
    $('fertilizerForm').value=details.form || '液肥';
    $('fertilizerAmount').value=details.amount || '';
    $('plantHeight').value=details.height || '';
    $('trunkWidth').value=details.trunkWidth || '';
    $('leafCount').value=details.leafCount || '';
    $('waterNote').value=existing.note || '';
    editingCarePhoto=careMode==='record'?(existing.photo || ''):'';
    editingCarePhotoId=careMode==='record'?(existing.photoId || ''):'';
    if(careMode==='plan'){
      $('recurrenceUnit').value=existing.recurrence?.unit || 'none';
      $('recurrenceInterval').value=String(existing.recurrence?.interval || 1);
    }
    if(editingCarePhoto){
      $('photoPreview').src=editingCarePhoto;
      $('photoPreview').style.display='block';
    }
  }else{
    $('careTitle').textContent=careMode==='plan'?`${p.name} のケア予定`:`${p.name} のケア記録`;
    $('saveCare').textContent=careMode==='plan'?'予定を保存':'記録する';
    $('careType').value='水やり';
    if(options.date) $('careRecordedAt').value=toDateTimeLocal(
      careMode==='plan'?scheduleTimeForDate(options.date):careTimeForDate(options.date)
    );
    else if(careMode==='plan') $('careRecordedAt').value=toDateTimeLocal(Date.now()+60*60*1000);
  }
  updateRecurrenceFields();
  toggleCareFields();
  $('careDialog').showModal();
};
$('careType').onchange=toggleCareFields;
$('recurrenceUnit').onchange=updateRecurrenceFields;
$('recurrenceInterval').oninput=updateRecurrenceFields;
$('carePhoto').onchange=()=>{
  const file=$('carePhoto').files[0];
  if(!file){
    if(!editingCarePhoto) $('photoPreview').style.display='none';
    return;
  }
  const url=URL.createObjectURL(file);
  $('photoPreview').src=url;
  $('photoPreview').style.display='block';
  $('photoPreview').onload=()=>URL.revokeObjectURL(url);
};
$('cancelCare').onclick=()=> $('careDialog').close();
$('saveCare').onclick=async()=>{
  const p=data.plants.find(x=>String(x.id)===String(currentId));
  const care=$('careType').value;
  const recordedAt=careMode==='plan'?planDateTimeValue('careRecordedAt'):recordedAtValue('careRecordedAt');
  if(recordedAt===null) return;
  if(care==='薬剤散布' && !$('pesticideName').value.trim()) return alert('薬剤名を入力してください');
  if(care==='施肥' && !$('fertilizerName').value.trim()) return alert('肥料名を入力してください');

  const details={};
  if(care==='水やり') Object.assign(details,{waterAmount:$('waterAmount').value.trim()});
  if(care==='薬剤散布') Object.assign(details,{
    name:$('pesticideName').value.trim(),target:$('pesticideTarget').value.trim(),
    dilution:$('pesticideDilution').value.trim(),method:$('pesticideMethod').value,
    nextDate:$('pesticideNextDate').value
  });
  if(care==='植え替え') Object.assign(details,{
    potType:$('potType').value.trim(),potSize:$('potSize').value.trim(),
    soilMix:$('soilMix').value.trim(),rootPruned:$('rootPruned').checked,
    reason:$('repotReason').value.trim()
  });
  if(care==='施肥') Object.assign(details,{
    name:$('fertilizerName').value.trim(),form:$('fertilizerForm').value,
    amount:$('fertilizerAmount').value.trim()
  });
  if(care==='状態・写真記録') Object.assign(details,{
    height:$('plantHeight').value.trim(),trunkWidth:$('trunkWidth').value.trim(),
    leafCount:$('leafCount').value.trim()
  });

  let photo=care==='状態・写真記録'?editingCarePhoto:'';
  const photoFile=$('carePhoto').files[0];
  if(careMode==='record' && care==='状態・写真記録' && photoFile){
    const normalLabel=editingLogIndex===null?'記録する':'変更を保存';
    $('saveCare').disabled=true;
    $('saveCare').textContent='写真を処理中…';
    try{ photo=await compressImage(photoFile); }
    catch(e){ alert(e.message); return; }
    finally{
      $('saveCare').disabled=false;
      $('saveCare').textContent=normalLabel;
    }
  }

  const log={
    time:recordedAt,
    care,
    type:care==='水やり' ? $('waterType').value : care,
    fertilizer:care==='水やり' ? $('fertilizer').value : 'なし',
    details,
    note:$('waterNote').value.trim(),
    photo,
    photoId:careMode==='record' && care==='状態・写真記録'?editingCarePhotoId:''
  };
  if(careMode==='plan'){
    if(!Array.isArray(p.plans)) p.plans=[];
    const recurrence={
      unit:$('recurrenceUnit').value,
      interval:Math.max(1,Math.min(365,Number($('recurrenceInterval').value) || 1))
    };
    const plan={
      ...log,
      id:editingPlanId || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      startAt:recordedAt,
      recurrence,
      createdAt:Date.now()
    };
    delete plan.time;
    delete plan.photo;
    delete plan.photoId;
    const previousPlans=[...p.plans];
    const existingIndex=p.plans.findIndex(item=>String(item.id)===String(editingPlanId));
    if(existingIndex>=0) p.plans[existingIndex]={...p.plans[existingIndex],...plan,createdAt:p.plans[existingIndex].createdAt || plan.createdAt};
    else p.plans.push(plan);
    p.plans.sort((a,b)=>Number(a.startAt)-Number(b.startAt));
    if(save()){
      $('careDialog').close();
      toast(existingIndex>=0?'予定を変更しました':'予定を登録しました');
      trackPlantCareEvent(existingIndex>=0?'care_plan_edited':'care_plan_created',{care_type:care,recurrence:recurrence.unit});
      showPlans(p.id);
    }else p.plans=previousPlans;
    return;
  }
  const previousPhotoId=editingCarePhotoId;
  if(care==='状態・写真記録' && photoFile && photoStorageAvailable){
    try{ log.photoId=await savePhotoData(photo,null,'care-photo'); }
    catch(error){
      alert('写真を保存できませんでした。端末の空き容量を確認して、もう一度お試しください。');
      return;
    }
  }
  const wasEditing=editingLogIndex!==null;
  const previousLogs=[...(p.logs || [])];
  if(wasEditing) p.logs[editingLogIndex]=log;
  else p.logs.push(log);
  p.logs.sort((a,b)=>b.time-a.time);
  if(save()){
    if(previousPhotoId && previousPhotoId!==log.photoId) await deletePhotoRecord(previousPhotoId);
    updatePhotoStorageStatus();
    $('careDialog').close();
    trackPlantCareEvent(wasEditing?'care_history_edited':'care_recorded',{care_type:care});
    if(wasEditing) showHistory(p.id);
  }else{
    if(log.photoId && log.photoId!==previousPhotoId) await deletePhotoRecord(log.photoId);
    p.logs=previousLogs;
  }
};

function careDetailHtml(l){
  const care=l.care || '水やり';
  const d=l.details || {};
  const parts=[];
  if(care==='水やり'){
    parts.push(`方法：${esc(l.type || '通常')}`);
    parts.push(`液肥：${esc(l.fertilizer || 'なし')}`);
    if(d.waterAmount) parts.push(`量：${esc(d.waterAmount)}`);
  }
  if(care==='薬剤散布'){
    if(d.name) parts.push(`薬剤：${esc(d.name)}`);
    if(d.target) parts.push(`対象：${esc(d.target)}`);
    if(d.dilution) parts.push(`希釈：${esc(d.dilution)}`);
    if(d.method) parts.push(`方法：${esc(d.method)}`);
    if(d.nextDate) parts.push(`次回：${esc(d.nextDate)}`);
  }
  if(care==='植え替え'){
    if(d.potType || d.potSize) parts.push(`鉢：${esc([d.potType,d.potSize].filter(Boolean).join(' '))}`);
    if(d.soilMix) parts.push(`用土：${esc(d.soilMix)}`);
    if(d.rootPruned) parts.push('根切り・根整理：あり');
    if(d.reason) parts.push(`理由：${esc(d.reason)}`);
  }
  if(care==='施肥'){
    if(d.name) parts.push(`肥料：${esc(d.name)}`);
    if(d.form) parts.push(`種類：${esc(d.form)}`);
    if(d.amount) parts.push(`希釈・量：${esc(d.amount)}`);
  }
  if(care==='状態・写真記録'){
    if(d.height) parts.push(`高さ：${esc(d.height)}`);
    if(d.trunkWidth) parts.push(`幹・茎：${esc(d.trunkWidth)}`);
    if(d.leafCount) parts.push(`葉数：${esc(d.leafCount)}`);
  }
  if(l.note) parts.push(`メモ：${esc(l.note)}`);
  return parts.join('<br>') || '詳細なし';
}

function photoHtml(photo){
  if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo || '')) return '';
  return `<img class="history-photo" src="${photo}" alt="成長記録の写真">`;
}

window.showHistory=id=>{
  const p=data.plants.find(x=>x.id===id);
  $('historyTitle').textContent=`${p.name} の履歴`;
  $('historyList').innerHTML=(p.logs?.length?p.logs.map((l,i)=>`
    <div class="history-item">
      <div class="history-title">${fmtDate(l.time)} ・ ${esc(l.care || '水やり')}</div>
      <div class="history-note">${careDetailHtml(l)}</div>
      ${photoHtml(l.photo)}
      <div class="history-actions">
        <button class="secondary" type="button" onclick="editLog('${id}',${i})">編集</button>
        <button class="danger" type="button" onclick="removeLog('${id}',${i})">削除</button>
      </div>
    </div>`).join(''):'<div class="empty">履歴はまだありません。</div>');
  $('historyDialog').showModal();
};
$('closeHistory').onclick=()=> $('historyDialog').close();

function showPlans(id){
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  currentId=p.id;
  const plans=[...(p.plans || [])].sort((a,b)=>Number(a.startAt)-Number(b.startAt));
  $('plansTitle').textContent=`${p.name} のケア予定`;
  $('addPlan').disabled=plantManagementStatus(p)==='ended';
  $('plansList').innerHTML=plans.length?plans.map(plan=>`
    <div class="plan-item">
      <div class="history-title">${fmtDate(plan.startAt)} ・ ${esc(plan.care || '水やり')}</div>
      <div class="plan-repeat">${esc(recurrenceText(plan.recurrence))}</div>
      <div class="history-note">${careDetailHtml(plan)}</div>
      <div class="history-actions">
        <button class="secondary" type="button" onclick="editPlan('${p.id}','${esc(String(plan.id))}')">編集</button>
        <button class="danger" type="button" onclick="removePlan('${p.id}','${esc(String(plan.id))}')">削除</button>
      </div>
    </div>`).join(''):'<div class="empty">予定はまだありません。</div>';
  $('plansDialog').showModal();
}
window.showPlans=showPlans;
$('closePlans').onclick=()=> $('plansDialog').close();
$('addPlan').onclick=()=>{
  const id=currentId;
  $('plansDialog').close();
  openCare(id,{mode:'plan'});
};
window.editPlan=(id,planId)=>{
  $('plansDialog').close();
  openCare(id,{mode:'plan',planId});
};
window.removePlan=(id,planId)=>{
  if(!confirm('このケア予定を削除しますか？')) return;
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  p.plans=(p.plans || []).filter(plan=>String(plan.id)!==String(planId));
  save();
  showPlans(id);
};

let reorderDraft=[];

function renderReorderPlants(){
  $('reorderPlantsList').innerHTML=reorderDraft.map((id,index)=>{
    const plant=data.plants.find(item=>String(item.id)===String(id));
    if(!plant) return '';
    return `<div class="reorder-row">
      <div>
        <div class="reorder-name">${esc(plant.name)}</div>
        <div class="reorder-meta">${esc(plant.stage || '成株')}${plant.type?` ・ ${esc(plant.type)}`:''}</div>
      </div>
      <div class="reorder-actions">
        <button class="secondary" type="button" aria-label="${esc(plant.name)}を上へ" onclick="moveReorderPlant(${index},-1)" ${index===0?'disabled':''}>↑</button>
        <button class="secondary" type="button" aria-label="${esc(plant.name)}を下へ" onclick="moveReorderPlant(${index},1)" ${index===reorderDraft.length-1?'disabled':''}>↓</button>
      </div>
    </div>`;
  }).join('');
}

function openPlantReorder(){
  closeDataMenu();
  if(data.plants.length<2){
    toast(data.plants.length?'並べ替えるには2株以上登録してください':'植物がまだ登録されていません');
    return;
  }
  reorderDraft=data.plants.map(plant=>String(plant.id));
  renderReorderPlants();
  $('reorderPlantsDialog').showModal();
}

window.moveReorderPlant=(index,direction)=>{
  const target=index+direction;
  if(target<0 || target>=reorderDraft.length) return;
  [reorderDraft[index],reorderDraft[target]]=[reorderDraft[target],reorderDraft[index]];
  renderReorderPlants();
};

$('reorderPlantsBtn').onclick=openPlantReorder;
$('cancelReorderPlants').onclick=()=> $('reorderPlantsDialog').close();
$('saveReorderPlants').onclick=()=>{
  const previous=data.plants;
  const plantsById=new Map(previous.map(plant=>[String(plant.id),plant]));
  const reordered=reorderDraft.map(id=>plantsById.get(id)).filter(Boolean);
  previous.forEach(plant=>{
    if(!reorderDraft.includes(String(plant.id))) reordered.push(plant);
  });
  data.plants=reordered;
  if(save()){
    $('reorderPlantsDialog').close();
    toast('株の並び順を保存しました');
    trackPlantCareEvent('plants_reordered',{plant_count:reordered.length});
  }else{
    data.plants=previous;
    render();
  }
};

function updateBatchWaterControls(){
  const checks=[...document.querySelectorAll('.batch-plant-check')];
  const selected=checks.filter(input=>input.checked).length;
  $('saveBatchWater').disabled=selected===0;
  $('saveBatchWater').textContent=selected?`選択した${selected}株に記録`:'株を選択してください';
  $('batchSelectAll').textContent=checks.length && selected===checks.length?'選択を解除':'すべて選択';
}

let batchWaterContext=null;

function openBatchWatering(context=null){
  closeDataMenu();
  const availablePlants=data.plants.filter(plant=>plantManagementStatus(plant)!=='ended');
  if(!availablePlants.length){
    alert('まとめて記録できる植物がありません。管理終了の状態をご確認ください。');
    return;
  }
  batchWaterContext=context && context.rainDate?context:null;
  const todayRain=Boolean(batchWaterContext?.today);
  $('batchWaterTitle').textContent=batchWaterContext?'降雨を水やりとして記録':'まとめて水やり';
  $('batchWaterHint').textContent=batchWaterContext
    ?todayRain
      ?`${batchWaterContext.rainDate} の降水予報 ${Number(batchWaterContext.rainAmount).toFixed(1)}mm。当日の値には予報が含まれる可能性があります。実際に雨が当たった株だけを選択してください。`
      :`${batchWaterContext.rainDate} の降雨 ${Number(batchWaterContext.rainAmount).toFixed(1)}mm。雨が当たる設定の株を選択しています。`
    :'水やりした株を選択してください。記録を忘れた場合は日時を過去へ変更できます。';
  const batchTime=batchWaterContext?(todayRain?Date.now():new Date(`${batchWaterContext.rainDate}T12:00:00`).getTime()):Date.now();
  $('batchWaterTime').value=toDateTimeLocal(batchTime);
  $('batchWaterTime').max=toDateTimeLocal();
  $('batchWaterTime').disabled=Boolean(batchWaterContext);
  $('batchWaterTimeHint').textContent=batchWaterContext
    ?todayRain?'現在時刻で保存します。予報値ではなく、実際の降雨を確認してから記録してください。':'降雨記録は選択日の正午として保存します。'
    :'実際に水やりした日時を指定できます。';
  $('batchPlantList').innerHTML=availablePlants.map(p=>`
    <label class="batch-plant-row">
      <input class="batch-plant-check" type="checkbox" value="${esc(String(p.id))}" ${batchWaterContext && (p.rainExposure || 'rain')==='rain'?'checked':''}>
      <span>
        <span class="batch-plant-name">${esc(p.name)}</span>
        <span class="batch-plant-meta">${esc(p.stage || '成株')}${p.type?` ・ ${esc(p.type)}`:''}</span>
      </span>
    </label>`).join('');
  updateBatchWaterControls();
  $('batchWaterDialog').showModal();
}

window.openRainWatering=(date,amount)=>openBatchWatering({
  rainDate:date,
  rainAmount:Number(amount),
  today:date===dateKey(new Date())
});

$('batchPlantList').onchange=updateBatchWaterControls;
$('batchSelectAll').onclick=()=>{
  const checks=[...document.querySelectorAll('.batch-plant-check')];
  const shouldSelect=!checks.every(input=>input.checked);
  checks.forEach(input=>{ input.checked=shouldSelect; });
  updateBatchWaterControls();
};
$('cancelBatchWater').onclick=()=>{
  batchWaterContext=null;
  $('batchWaterDialog').close();
};
$('saveBatchWater').onclick=()=>{
  const selectedIds=new Set(
    [...document.querySelectorAll('.batch-plant-check:checked')].map(input=>input.value)
  );
  if(!selectedIds.size) return;

  const context=batchWaterContext;
  const now=context?(context.today?Date.now():new Date(`${context.rainDate}T12:00:00`).getTime()):recordedAtValue('batchWaterTime');
  if(now===null) return;
  const additions=[];
  let skipped=0;
  data.plants.forEach(p=>{
    if(!selectedIds.has(String(p.id))) return;
    if(!Array.isArray(p.logs)) p.logs=[];
    const duplicate=context
      ?p.logs.some(log=>dateKey(new Date(log.time))===context.rainDate && /^(降雨|当日降水) /.test(String(log.note || '')))
      :p.logs.some(log=>Math.abs(now-Number(log.time))<=10000);
    if(duplicate){
      skipped++;
      return;
    }
    const log={
      time:now,
      care:'水やり',
      type:'通常',
      fertilizer:'なし',
      note:context
        ?`${context.today?'当日降水':'降雨'} ${Number(context.rainAmount).toFixed(1)}mmを水やり扱いとして記録${context.today?'（予報を含む可能性あり）':''}`
        :'まとめて水やりから記録'
    };
    p.logs.unshift(log);
    p.logs.sort((a,b)=>b.time-a.time);
    additions.push({plant:p,log});
  });

  if(!additions.length){
    $('batchWaterDialog').close();
    batchWaterContext=null;
    toast(context?'この日の降雨は選択した株に記録済みです':'10秒以内に記録済みのため、重複を防止しました');
    return;
  }

  if(save()){
    $('batchWaterDialog').close();
    batchWaterContext=null;
    trackPlantCareEvent('batch_water_recorded',{
      source:context?'rain':'manual',
      plant_count:additions.length
    });
    const suffix=skipped?`（${skipped}株は重複防止）`:'';
    toast(`${context?'☔':'💧'} ${additions.length}株の${context?'降雨':'水やり'}を記録しました${suffix}`);
  }else{
    additions.forEach(({plant,log})=>{
      plant.logs=plant.logs.filter(item=>item!==log);
    });
  }
};

window.copyShortcutUrl=async id=>{
  const p=data.plants.find(x=>x.id===id);
  const base=location.origin + location.pathname;
  const url=base + '?water=' + encodeURIComponent(id);
  try{
    await navigator.clipboard.writeText(url);
    toast(`「${p.name}」のURLをコピーしました`);
  }catch(e){
    prompt('このURLをコピーしてください', url);
  }
};

window.removePlant=async id=>{
  const p=data.plants.find(x=>x.id===id);
  if(confirm(`「${p.name}」を削除しますか？\nケア履歴も削除されます。`)){
    const index=data.plants.indexOf(p);
    data.plants=data.plants.filter(x=>x.id!==id);
    if(save()){
      await Promise.all([p.photoId,...(p.logs || []).map(log=>log.photoId)].filter(Boolean).map(deletePhotoRecord));
      updatePhotoStorageStatus();
    }else{
      data.plants.splice(index,0,p);
      render();
    }
  }
};
window.editLog=(id,index)=>{
  $('historyDialog').close();
  openCare(id,{logIndex:index});
};

window.removeLog=async(id,index)=>{
  if(!confirm('このケア記録を削除しますか？')) return;
  const p=data.plants.find(x=>x.id===id);
  const [removed]=p.logs.splice(index,1);
  if(save()){
    if(removed?.photoId){
      await deletePhotoRecord(removed.photoId);
      updatePhotoStorageStatus();
    }
  }else{
    p.logs.splice(index,0,removed);
    render();
  }
  showHistory(id);
};

$('menuBtn').onclick=e=>{
  e.stopPropagation();
  const willOpen=$('dataMenu').hidden;
  $('dataMenu').hidden=!willOpen;
  $('menuBtn').setAttribute('aria-expanded',String(willOpen));
  if(willOpen) updatePhotoStorageStatus();
};

$('helpBtn').onclick=()=>{
  closeDataMenu();
  $('helpDialog').showModal();
  trackPlantCareEvent('help_viewed');
};
$('closeHelp').onclick=()=> $('helpDialog').close();
$('releaseNotesBtn').onclick=()=>openReleaseNotes('menu');
$('releaseNoticeDetails').onclick=()=>openReleaseNotes('notice');
$('closeReleaseNotes').onclick=()=> $('releaseNotesDialog').close();

function openAnalyticsSettings(){
  closeDataMenu();
  if($('helpDialog').open) $('helpDialog').close();
  $('analyticsEnabled').checked=window.plantCareAnalyticsEnabled;
  $('analyticsDialog').showModal();
}
$('helpAnalyticsSettingsBtn').onclick=openAnalyticsSettings;
$('cancelAnalytics').onclick=()=> $('analyticsDialog').close();
$('saveAnalytics').onclick=()=>{
  const enabled=$('analyticsEnabled').checked;
  window.setPlantCareAnalytics(enabled);
  $('analyticsDialog').close();
  toast(enabled?'匿名のアクセス解析を有効にしました':'アクセス解析を停止しました');
};

function closeDataMenu(){
  $('dataMenu').hidden=true;
  $('menuBtn').setAttribute('aria-expanded','false');
}

document.addEventListener('click',e=>{
  if(!$('menuWrap').contains(e.target)) closeDataMenu();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    closeDataMenu();
  }
});

$('topBatchWaterBtn').onclick=()=>openBatchWatering();
$('batchWaterBtn').onclick=()=>openBatchWatering();
$('batchShortcutBtn').onclick=async()=>{
  closeDataMenu();
  const url=location.origin + location.pathname + '?water=batch';
  try{
    await navigator.clipboard.writeText(url);
    toast('まとめて水やりURLをコピーしました');
  }catch(e){
    prompt('このURLをコピーしてください',url);
  }
};

function autoRecordFromUrl(){
  const params=new URLSearchParams(location.search);
  const id=params.get('water');
  if(!id) return;

  if(id==='batch'){
    history.replaceState({},'',location.pathname);
    setTimeout(openBatchWatering,100);
    return;
  }

  const p=data.plants.find(x=>String(x.id)===id);
  if(!p){
    history.replaceState({},'',location.pathname);
    setTimeout(()=>toast('対象の株が見つかりませんでした'),100);
    return;
  }
  if(plantManagementStatus(p)==='ended'){
    history.replaceState({},'',location.pathname);
    setTimeout(()=>toast('管理終了した株には記録できません'),100);
    return;
  }

  const last=p.logs?.[0];
  const now=Date.now();

  // 再読み込みによる二重記録を防ぐため、10秒以内は重複させない
  if(!last || now-last.time>10000){
    p.logs.unshift({
      time:now,
      care:'水やり',
      type:'通常',
      fertilizer:'なし',
      note:'iPhoneショートカットから自動記録'
    });
    localStorage.setItem(KEY, JSON.stringify(storageDataPayload(data)));
  }

  history.replaceState({},'',location.pathname);
  setTimeout(()=>toast(`💧 ${p.name} の水やりを記録しました`),100);
}
