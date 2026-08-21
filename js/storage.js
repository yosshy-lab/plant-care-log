const APP_VERSION='1.5.1';
const KEY='plant-care-log-v1';
const WEATHER_KEY='plant-care-weather-v1';
const LIST_LAYOUT_KEY='plant-care-list-layout-v1';
const BACKUP_META_KEY='plant-care-backup-meta-v1';
const PRE_RESTORE_KEY='plant-care-pre-restore-v1';
const BACKUP_REMINDER_MS=30*24*60*60*1000;
const FIRST_BACKUP_REMINDER_MS=7*24*60*60*1000;
const LEGACY_KEYS=['pachypodium-water-log-v2','pachypodium-water-log-v1'];

function loadBackupMeta(){
  try{
    const saved=JSON.parse(localStorage.getItem(BACKUP_META_KEY) || 'null');
    return saved && typeof saved==='object'?saved:{};
  }catch(e){ return {}; }
}

function saveBackupMeta(meta){
  localStorage.setItem(BACKUP_META_KEY,JSON.stringify(meta));
}

function backupSummary(targetData=data){
  const plants=Array.isArray(targetData?.plants)?targetData.plants:[];
  const logs=plants.reduce((sum,plant)=>sum+(Array.isArray(plant.logs)?plant.logs.length:0),0);
  const photos=plants.reduce((sum,plant)=>
    sum+(plant.photo?1:0)+(Array.isArray(plant.logs)?plant.logs.filter(log=>log?.photo).length:0),0);
  return {plants:plants.length,logs,photos};
}

function createBackupPayload(targetData=data){
  return {
    format:'plant-care-log-backup',
    schemaVersion:1,
    appVersion:APP_VERSION,
    exportedAt:Date.now(),
    plants:targetData.plants
  };
}

function validateBackup(input){
  if(!input || typeof input!=='object' || !Array.isArray(input.plants)) throw new Error('invalid backup');
  const ids=new Set();
  const valid=input.plants.every(plant=>{
    if(!plant || typeof plant!=='object') return false;
    if((typeof plant.id!=='string' && typeof plant.id!=='number') || typeof plant.name!=='string' || !plant.name.trim()) return false;
    const id=String(plant.id);
    if(ids.has(id)) return false;
    ids.add(id);
    if('logs' in plant && !Array.isArray(plant.logs)) return false;
    return (plant.logs || []).every(log=>
      log && typeof log==='object' && Number.isFinite(Number(log.time)) &&
      (!('care' in log) || typeof log.care==='string')
    );
  });
  if(!valid) throw new Error('invalid backup');
  return {
    plants:input.plants.map(plant=>({...plant,logs:Array.isArray(plant.logs)?plant.logs:[]})),
    exportedAt:Number(input.exportedAt) || null
  };
}

function downloadBackup(payload,filename){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=filename;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
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

function save(){
  try{
    localStorage.setItem(KEY, JSON.stringify(data));
    render();
    renderBackupStatus();
    return true;
  }catch(e){
    alert('保存容量がいっぱいです。不要な写真や記録を削除してから、もう一度お試しください。');
    return false;
  }
}

const $=id=>document.getElementById(id);
$('appVersionDisplay').textContent=`v${APP_VERSION}`;

function backupStatusText(){
  const summary=backupSummary();
  if(!summary.plants) return '登録データはありません';
  const meta=loadBackupMeta();
  const counts=`${summary.plants}株・履歴${summary.logs}件・写真${summary.photos}枚`;
  if(!meta.lastBackupAt) return `未バックアップ　${counts}`;
  return `最終保存 ${fmtDate(meta.lastBackupAt)}　${counts}`;
}

function isBackupDue(){
  const summary=backupSummary();
  if(!summary.plants) return false;
  const now=Date.now();
  const meta=loadBackupMeta();
  if(meta.lastBackupAt) return now-meta.lastBackupAt>=BACKUP_REMINDER_MS;
  return meta.firstDataSeenAt && now-meta.firstDataSeenAt>=FIRST_BACKUP_REMINDER_MS;
}

function renderBackupStatus(){
  const meta=loadBackupMeta();
  if(data.plants.length && !meta.firstDataSeenAt){
    meta.firstDataSeenAt=Date.now();
    saveBackupMeta(meta);
  }
  const due=Boolean(isBackupDue());
  $('backupStatus').textContent=backupStatusText();
  $('backupStatus').classList.toggle('due',due);
  $('restorePreImportBtn').hidden=!localStorage.getItem(PRE_RESTORE_KEY);
  $('menuBtn').classList.toggle('backup-due',due);
  $('menuBtn').setAttribute('aria-label',due?'メニュー（バックアップをおすすめします）':'メニュー');
}

function notifyBackupDue(){
  if(!isBackupDue()) return;
  const meta=loadBackupMeta();
  const now=Date.now();
  if(meta.lastReminderAt && now-meta.lastReminderAt<24*60*60*1000) return;
  meta.lastReminderAt=now;
  saveBackupMeta(meta);
  setTimeout(()=>toast('データ保護のため、バックアップ保存をおすすめします'),350);
}

$('exportBtn').onclick=()=>{
  closeDataMenu();
  const date=new Date().toISOString().slice(0,10);
  downloadBackup(createBackupPayload(),`plant-care-log-backup-${date}.json`);
  const meta=loadBackupMeta();
  meta.lastBackupAt=Date.now();
  meta.firstDataSeenAt=meta.firstDataSeenAt || meta.lastBackupAt;
  saveBackupMeta(meta);
  renderBackupStatus();
  toast('バックアップを保存しました');
  trackPlantCareEvent('backup_exported');
};

$('importBtn').onclick=()=>{
  closeDataMenu();
  $('importFile').click();
};

$('importFile').onchange=async()=>{
  const file=$('importFile').files[0];
  if(!file) return;

  try{
    const restored=validateBackup(JSON.parse(await file.text()));
    const current=backupSummary();
    const incoming=backupSummary(restored);
    if(!confirm(
      `現在の${current.plants}株・履歴${current.logs}件を、バックアップの${incoming.plants}株・履歴${incoming.logs}件で上書きします。\n復元前のデータは端末内へ自動退避します。復元しますか？`
    )) return;

    try{
      localStorage.setItem(PRE_RESTORE_KEY,JSON.stringify(createBackupPayload()));
    }catch(e){
      alert('復元前データを自動退避できませんでした。先に「バックアップを保存」を実行してから、もう一度お試しください。');
      return;
    }

    const previous=data;
    data={plants:restored.plants};
    if(save()){
      toast(`${incoming.plants}株・履歴${incoming.logs}件を復元しました`);
      trackPlantCareEvent('backup_restored');
    }else{
      data=previous;
      localStorage.removeItem(PRE_RESTORE_KEY);
      render();
      renderBackupStatus();
    }
  }catch(e){
    alert('バックアップファイルを検証できませんでした。塊根植物記録で保存した正しいJSONファイルを選んでください。');
  }finally{
    $('importFile').value='';
  }
};

$('restorePreImportBtn').onclick=()=>{
  closeDataMenu();
  try{
    const restorePoint=validateBackup(JSON.parse(localStorage.getItem(PRE_RESTORE_KEY) || 'null'));
    const summary=backupSummary(restorePoint);
    if(!confirm(`復元前の${summary.plants}株・履歴${summary.logs}件へ戻しますか？\n現在のデータも復元ポイントとして入れ替えて保存します。`)) return;
    const current=createBackupPayload();
    const previous=data;
    data={plants:restorePoint.plants};
    if(save()){
      localStorage.setItem(PRE_RESTORE_KEY,JSON.stringify(current));
      renderBackupStatus();
      toast('復元前のデータへ戻しました');
      trackPlantCareEvent('backup_rollback');
    }else{
      data=previous;
      render();
    }
  }catch(e){
    localStorage.removeItem(PRE_RESTORE_KEY);
    renderBackupStatus();
    alert('復元前データを読み込めませんでした。');
  }
};

