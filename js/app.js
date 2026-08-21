const APP_VERSION='1.3.2';
const KEY='plant-care-log-v1';
const WEATHER_KEY='plant-care-weather-v1';
const LIST_LAYOUT_KEY='plant-care-list-layout-v1';
const LEGACY_KEYS=['pachypodium-water-log-v2','pachypodium-water-log-v1'];

function loadWeather(){
  const defaults={latitude:null,longitude:null,accuracy:null,cityName:'',municipalityCode:'',cityLookupAttemptedAt:0,displayThreshold:1,equivalentThreshold:10,days:{},lastUpdated:0};
  try{
    const saved=JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null');
    if(!saved || typeof saved!=='object') return defaults;
    return {...defaults,...saved,days:saved.days && typeof saved.days==='object'?saved.days:{}};
  }catch(e){ return defaults; }
}

let weather=loadWeather();
function saveWeatherLocal(){ localStorage.setItem(WEATHER_KEY,JSON.stringify(weather)); }
function hasWeatherLocation(settings){
  return typeof settings.latitude==='number' && Number.isFinite(settings.latitude) && Math.abs(settings.latitude)<=90 &&
    typeof settings.longitude==='number' && Number.isFinite(settings.longitude) && Math.abs(settings.longitude)<=180;
}

function readStoredData(key){
  const value=localStorage.getItem(key);
  if(!value) return null;
  try{
    const parsed=JSON.parse(value);
    return parsed && Array.isArray(parsed.plants) ? parsed : null;
  }catch(e){
    console.warn(`保存データを読み込めませんでした: ${key}`, e);
    return null;
  }
}

function loadData(){
  const current=readStoredData(KEY);
  if(current) return current;

  for(const legacyKey of LEGACY_KEYS){
    const legacy=readStoredData(legacyKey);
    if(legacy){
      localStorage.setItem(KEY, JSON.stringify(legacy));
      return legacy;
    }
  }

  return {plants:[]};
}

let data=loadData();
let currentId=null;
let detailPlantId=null;
let listLayout=localStorage.getItem(LIST_LAYOUT_KEY)==='grid'?'grid':'list';
const $=id=>document.getElementById(id);
$('appVersionDisplay').textContent=`v${APP_VERSION}`;

function save(){
  try{
    localStorage.setItem(KEY, JSON.stringify(data));
    render();
    return true;
  }catch(e){
    alert('保存容量がいっぱいです。不要な写真や記録を削除してから、もう一度お試しください。');
    return false;
  }
}
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
function fmtDate(ts){
  if(!ts) return '記録なし';
  const d=new Date(ts);
  return new Intl.DateTimeFormat('ja-JP',{
    year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'
  }).format(d);
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
  }catch(e){
    alert(e.message);
    $('plantPhoto').value='';
  }
};
$('removePlantPhoto').onclick=()=>{
  $('plantPhoto').value='';
  setPlantPhotoPreview('');
};
$('cancelPlant').onclick=()=> $('plantDialog').close();
$('savePlant').onclick=()=>{
  const name=$('plantName').value.trim();
  if(!name) return alert('管理名を入力してください');
  const now=Date.now();
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
    updatedAt:now
  };
  if(editingPlantId!==null){
    const p=data.plants.find(x=>String(x.id)===String(editingPlantId));
    if(!p) return alert('編集する株が見つかりませんでした');
    const previous={...p};
    Object.assign(p,details);
    if(save()){
      $('plantDialog').close();
      toast('株情報を更新しました');
      trackPlantCareEvent('plant_updated');
    }else{
      Object.assign(p,previous);
      render();
    }
  }else{
    const newPlant={
      id:crypto.randomUUID(),
      ...details,
      createdAt:now,
      logs:[]
    };
    data.plants.push(newPlant);
    if(save()){
      $('plantDialog').close();
      toast('植物を登録しました');
      trackPlantCareEvent('plant_added');
    }else{
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
  $('photoPreview').src='';
  $('photoPreview').style.display='none';
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

window.openCare=id=>{
  currentId=id;
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  if(plantManagementStatus(p)==='ended') return toast('管理終了した株には記録できません');
  $('careTitle').textContent=`${p.name} のケア記録`;
  $('careType').value='水やり';
  resetCareForm();
  toggleCareFields();
  $('careDialog').showModal();
};
$('careType').onchange=toggleCareFields;
$('carePhoto').onchange=()=>{
  const file=$('carePhoto').files[0];
  if(!file){
    $('photoPreview').style.display='none';
    return;
  }
  const url=URL.createObjectURL(file);
  $('photoPreview').src=url;
  $('photoPreview').style.display='block';
  $('photoPreview').onload=()=>URL.revokeObjectURL(url);
};
$('cancelCare').onclick=()=> $('careDialog').close();
$('saveCare').onclick=async()=>{
  const p=data.plants.find(x=>x.id===currentId);
  const care=$('careType').value;
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

  let photo='';
  const photoFile=$('carePhoto').files[0];
  if(care==='状態・写真記録' && photoFile){
    $('saveCare').disabled=true;
    $('saveCare').textContent='写真を処理中…';
    try{ photo=await compressImage(photoFile); }
    catch(e){ alert(e.message); return; }
    finally{
      $('saveCare').disabled=false;
      $('saveCare').textContent='記録する';
    }
  }

  const log={
    time:Date.now(),
    care,
    type:care==='水やり' ? $('waterType').value : care,
    fertilizer:care==='水やり' ? $('fertilizer').value : 'なし',
    details,
    note:$('waterNote').value.trim(),
    photo
  };
  p.logs.unshift(log);
  if(save()){
    $('careDialog').close();
    trackPlantCareEvent('care_recorded',{care_type:care});
  }else p.logs.shift();
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

const CARE_CLASSES={
  '水やり':'water','薬剤散布':'pesticide','植え替え':'repot',
  '施肥':'fertilize','状態・写真記録':'growth'
};
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let selectedCalendarDate=dateKey(new Date());

function dateKey(date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
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
  $('calendarDayDetails').innerHTML=`<h3>${title}</h3>${rainHtml}${careHtml}`;
}

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

window.showHistory=id=>{
  const p=data.plants.find(x=>x.id===id);
  $('historyTitle').textContent=`${p.name} の履歴`;
  $('historyList').innerHTML=(p.logs?.length?p.logs.map((l,i)=>`
    <div class="history-item">
      <div class="history-title">${fmtDate(l.time)} ・ ${esc(l.care || '水やり')}</div>
      <div class="history-note">${careDetailHtml(l)}</div>
      ${photoHtml(l.photo)}
      <button class="danger" style="margin-top:7px;padding:7px 10px;font-size:12px"
        onclick="removeLog('${id}',${i})">この記録を削除</button>
    </div>`).join(''):'<div class="empty">履歴はまだありません。</div>');
  $('historyDialog').showModal();
};
$('closeHistory').onclick=()=> $('historyDialog').close();

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
  $('batchWaterTitle').textContent=batchWaterContext?'降雨を水やりとして記録':'まとめて水やり';
  $('batchWaterHint').textContent=batchWaterContext
    ?`${batchWaterContext.rainDate} の降雨 ${Number(batchWaterContext.rainAmount).toFixed(1)}mm。雨が当たる設定の株を選択しています。`
    :'水やりした株を選択してください。';
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

window.openRainWatering=(date,amount)=>openBatchWatering({rainDate:date,rainAmount:Number(amount)});

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
  const now=context?new Date(`${context.rainDate}T12:00:00`).getTime():Date.now();
  const additions=[];
  let skipped=0;
  data.plants.forEach(p=>{
    if(!selectedIds.has(String(p.id))) return;
    if(!Array.isArray(p.logs)) p.logs=[];
    const duplicate=context
      ?p.logs.some(log=>dateKey(new Date(log.time))===context.rainDate && String(log.note || '').startsWith('降雨 '))
      :(p.logs[0] && now-p.logs[0].time<=10000);
    if(duplicate){
      skipped++;
      return;
    }
    const log={
      time:now,
      care:'水やり',
      type:'通常',
      fertilizer:'なし',
      note:context?`降雨 ${Number(context.rainAmount).toFixed(1)}mmを水やり扱いとして記録`:'まとめて水やりから記録'
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

window.removePlant=id=>{
  const p=data.plants.find(x=>x.id===id);
  if(confirm(`「${p.name}」を削除しますか？\nケア履歴も削除されます。`)){
    data.plants=data.plants.filter(x=>x.id!==id);
    save();
  }
};
window.removeLog=(id,index)=>{
  if(!confirm('このケア記録を削除しますか？')) return;
  const p=data.plants.find(x=>x.id===id);
  p.logs.splice(index,1);
  save();
  showHistory(id);
};

$('menuBtn').onclick=e=>{
  e.stopPropagation();
  const willOpen=$('dataMenu').hidden;
  $('dataMenu').hidden=!willOpen;
  $('menuBtn').setAttribute('aria-expanded',String(willOpen));
};

$('helpBtn').onclick=()=>{
  closeDataMenu();
  $('helpDialog').showModal();
  trackPlantCareEvent('help_viewed');
};
$('closeHelp').onclick=()=> $('helpDialog').close();

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

let weatherDraft=null;

async function resolveMunicipalityName(latitude,longitude){
  const params=new URLSearchParams({lat:String(latitude),lon:String(longitude)});
  const addressResponse=await fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?${params}`);
  if(!addressResponse.ok) throw new Error(`reverse geocoder ${addressResponse.status}`);
  const address=await addressResponse.json();
  const municipalityCode=String(address.results?.muniCd || '').replace(/\D/g,'');
  if(!municipalityCode) throw new Error('municipality code not found');

  const municipalitiesResponse=await fetch('https://maps.gsi.go.jp/js/muni.js',{cache:'force-cache'});
  if(!municipalitiesResponse.ok) throw new Error(`municipalities ${municipalitiesResponse.status}`);
  const municipalities=await municipalitiesResponse.text();
  const target=`GSI.MUNI_ARRAY["${municipalityCode}"]`;
  const line=municipalities.split('\n').find(item=>item.includes(target));
  const values=line?.match(/'([^']+)'/)?.[1]?.split(',');
  const cityName=values?.slice(3).join(',').trim().replace(/\u3000+/g,' ');
  if(!cityName) throw new Error('municipality name not found');
  return {cityName,municipalityCode};
}

async function refreshStoredMunicipality(){
  if(!hasWeatherLocation(weather) || weather.cityName) return;
  if(Date.now()-Number(weather.cityLookupAttemptedAt)<24*60*60*1000) return;
  weather={...weather,cityLookupAttemptedAt:Date.now()};
  saveWeatherLocal();
  try{
    const municipality=await resolveMunicipalityName(weather.latitude,weather.longitude);
    weather={...weather,...municipality};
    saveWeatherLocal();
    if($('weatherDialog').open){
      weatherDraft={...weather,days:{...weather.days}};
      updateWeatherDialogStatus();
    }
    if(!$('calendarView').classList.contains('hidden')) renderCalendar();
  }catch(e){
    console.warn('市区町村名を取得できませんでした',e);
  }
}

function weatherStatusText(settings){
  if(!hasWeatherLocation(settings)){
    return '現在地は未設定です。取得すると降水量をカレンダーに表示できます。';
  }
  const updated=settings.lastUpdated
    ?`天気の最終更新：${fmtDate(settings.lastUpdated)}`
    :'天気データはまだ取得していません。';
  const accuracy=settings.accuracy?`（位置精度 約${Math.round(settings.accuracy)}m）`:'';
  const place=settings.cityName?`現在地：${settings.cityName}`:'現在地：市区町村名を確認できません';
  return `${place}${accuracy}\n${updated}`;
}

function updateWeatherDialogStatus(message){
  $('weatherStatus').textContent=message || weatherStatusText(weatherDraft || weather);
}

function openWeatherSettings(){
  closeDataMenu();
  weatherDraft={...weather,days:{...weather.days}};
  $('rainDisplayThreshold').value=String(weather.displayThreshold);
  $('rainEquivalentThreshold').value=String(weather.equivalentThreshold);
  $('getLocationBtn').disabled=false;
  $('getLocationBtn').textContent=hasWeatherLocation(weatherDraft)?'現在地を再取得':'現在地を取得';
  $('saveWeather').disabled=false;
  updateWeatherDialogStatus();
  $('weatherDialog').showModal();
}

async function refreshWeather(force=false){
  if(!hasWeatherLocation(weather)) return;
  if(!force && Date.now()-Number(weather.lastUpdated)<60*60*1000) return;
  const params=new URLSearchParams({
    latitude:String(weather.latitude),longitude:String(weather.longitude),
    daily:'precipitation_sum',timezone:'auto',past_days:'92',forecast_days:'16'
  });
  try{
    const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if(!response.ok) throw new Error(`weather ${response.status}`);
    const json=await response.json();
    const times=json.daily?.time;
    const amounts=json.daily?.precipitation_sum;
    if(!Array.isArray(times) || !Array.isArray(amounts)) throw new Error('invalid weather data');
    const days={};
    times.forEach((date,index)=>{
      const amount=Number(amounts[index]);
      if(/^\d{4}-\d{2}-\d{2}$/.test(date) && amounts[index]!==null && Number.isFinite(amount)) days[date]=amount;
    });
    weather={...weather,days,lastUpdated:Date.now()};
    saveWeatherLocal();
    if($('weatherDialog').open){
      weatherDraft={...weather,days:{...weather.days}};
      updateWeatherDialogStatus();
    }
    if(!$('calendarView').classList.contains('hidden')) renderCalendar();
  }catch(e){
    console.warn('天気データを取得できませんでした',e);
    if($('weatherDialog').open) updateWeatherDialogStatus('天気データを取得できませんでした。通信状態を確認して、もう一度お試しください。');
  }
}

$('weatherSettingsBtn').onclick=openWeatherSettings;
$('getLocationBtn').onclick=()=>{
  if(!navigator.geolocation){
    updateWeatherDialogStatus('このブラウザは現在地の取得に対応していません。');
    return;
  }
  $('getLocationBtn').disabled=true;
  $('getLocationBtn').textContent='現在地を取得中…';
  $('saveWeather').disabled=true;
  navigator.geolocation.getCurrentPosition(async position=>{
    weatherDraft={
      ...(weatherDraft || weather),
      latitude:Number(position.coords.latitude.toFixed(4)),
      longitude:Number(position.coords.longitude.toFixed(4)),
      accuracy:position.coords.accuracy,
      cityName:'',
      municipalityCode:'',
      cityLookupAttemptedAt:Date.now()
    };
    updateWeatherDialogStatus('現在地を取得しました。市区町村名を確認中…');
    try{
      const municipality=await resolveMunicipalityName(weatherDraft.latitude,weatherDraft.longitude);
      weatherDraft={...weatherDraft,...municipality};
      updateWeatherDialogStatus(`現在地：${municipality.cityName}\n設定を保存すると天気データを更新します。`);
    }catch(e){
      console.warn('市区町村名を取得できませんでした',e);
      updateWeatherDialogStatus('現在地は取得しましたが、市区町村名を確認できませんでした。通信状態を確認して再取得してください。');
    }finally{
      $('getLocationBtn').disabled=false;
      $('getLocationBtn').textContent='現在地を再取得';
      $('saveWeather').disabled=false;
    }
  },error=>{
    const messages={1:'位置情報の利用が許可されませんでした。iPhoneまたはブラウザの設定をご確認ください。',2:'現在地を取得できませんでした。',3:'現在地の取得がタイムアウトしました。'};
    updateWeatherDialogStatus(messages[error.code] || '現在地を取得できませんでした。');
    $('getLocationBtn').disabled=false;
    $('getLocationBtn').textContent='現在地を取得';
    $('saveWeather').disabled=false;
  },{enableHighAccuracy:false,timeout:15000,maximumAge:10*60*1000});
};
$('cancelWeather').onclick=()=>{
  weatherDraft=null;
  $('weatherDialog').close();
};
$('saveWeather').onclick=()=>{
  const displayThreshold=Number($('rainDisplayThreshold').value);
  const equivalentThreshold=Number($('rainEquivalentThreshold').value);
  weather={...(weatherDraft || weather),displayThreshold,equivalentThreshold};
  saveWeatherLocal();
  weatherDraft=null;
  $('weatherDialog').close();
  renderCalendar();
  refreshWeather(true);
  toast('天気・位置設定を保存しました');
};

$('exportBtn').onclick=()=>{
  closeDataMenu();
  trackPlantCareEvent('backup_exported');
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='plant-care-log-backup.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};

$('importBtn').onclick=()=>{
  closeDataMenu();
  $('importFile').click();
};

$('importFile').onchange=async()=>{
  const file=$('importFile').files[0];
  if(!file) return;

  try{
    const restored=JSON.parse(await file.text());
    const valid=restored && Array.isArray(restored.plants) && restored.plants.every(p=>
      p && typeof p==='object' &&
      (typeof p.id==='string' || typeof p.id==='number') &&
      typeof p.name==='string' &&
      (!('logs' in p) || Array.isArray(p.logs))
    );
    if(!valid) throw new Error('invalid backup');

    const currentCount=data.plants.length;
    const restoredCount=restored.plants.length;
    if(!confirm(
      `現在の${currentCount}株のデータを、バックアップの${restoredCount}株で上書きします。\n復元しますか？`
    )) return;

    restored.plants.forEach(p=>{ if(!Array.isArray(p.logs)) p.logs=[]; });
    const previous=data;
    data=restored;
    if(save()){
      toast(`${restoredCount}株のデータを復元しました`);
      trackPlantCareEvent('backup_restored');
    }else{
      data=previous;
      render();
    }
  }catch(e){
    alert('バックアップファイルを読み込めませんでした。塊根植物記録で保存したJSONファイルを選んでください。');
  }finally{
    $('importFile').value='';
  }
};

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
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  history.replaceState({},'',location.pathname);
  setTimeout(()=>toast(`💧 ${p.name} の水やりを記録しました`),100);
}

autoRecordFromUrl();
render();
refreshStoredMunicipality();
refreshWeather();
