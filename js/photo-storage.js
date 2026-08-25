const PHOTO_DB_NAME='plant-care-log-media-v1';
const PHOTO_STORE_NAME='photos';
const SNAPSHOT_STORE_NAME='snapshots';
let photoStorageAvailable=false;
let photoDatabasePromise=null;

function isStoredPhoto(value){
  return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value || '');
}

function photoByteSize(dataUrl){
  const encoded=String(dataUrl || '').split(',')[1] || '';
  return Math.max(0,Math.floor(encoded.length*3/4)-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0));
}

function openPhotoDatabase(){
  if(photoDatabasePromise) return photoDatabasePromise;
  photoDatabasePromise=new Promise((resolve,reject)=>{
    if(!window.indexedDB) return reject(new Error('IndexedDB is not available'));
    const request=indexedDB.open(PHOTO_DB_NAME,2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(PHOTO_STORE_NAME)) db.createObjectStore(PHOTO_STORE_NAME,{keyPath:'id'});
      if(!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) db.createObjectStore(SNAPSHOT_STORE_NAME,{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || new Error('IndexedDBを開けませんでした'));
    request.onblocked=()=>reject(new Error('IndexedDBの更新がブロックされました'));
  });
  return photoDatabasePromise;
}

async function databaseStoreRequest(storeName,mode,operation){
  const db=await openPhotoDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(storeName,mode);
    const store=transaction.objectStore(storeName);
    let request;
    let result;
    try{ request=operation(store); }
    catch(error){ reject(error); return; }
    request.onsuccess=()=>{ result=request.result; };
    transaction.oncomplete=()=>resolve(result);
    transaction.onerror=()=>reject(transaction.error || request.error || new Error('写真ストレージの操作に失敗しました'));
    transaction.onabort=()=>reject(transaction.error || request.error || new Error('写真ストレージの操作が中断されました'));
  });
}

function photoStoreRequest(mode,operation){
  return databaseStoreRequest(PHOTO_STORE_NAME,mode,operation);
}

async function saveRestoreSnapshot(payload){
  if(!photoStorageAvailable){
    localStorage.setItem(PRE_RESTORE_KEY,JSON.stringify(payload));
    return;
  }
  await databaseStoreRequest(SNAPSHOT_STORE_NAME,'readwrite',store=>store.put({id:'pre-restore',payload,updatedAt:Date.now()}));
  localStorage.setItem(PRE_RESTORE_KEY,'indexeddb');
}

async function loadRestoreSnapshot(){
  const marker=localStorage.getItem(PRE_RESTORE_KEY);
  if(!marker) return null;
  if(marker!=='indexeddb') return JSON.parse(marker);
  const record=await databaseStoreRequest(SNAPSHOT_STORE_NAME,'readonly',store=>store.get('pre-restore'));
  return record?.payload || null;
}

async function clearRestoreSnapshot(){
  localStorage.removeItem(PRE_RESTORE_KEY);
  if(!photoStorageAvailable) return;
  try{ await databaseStoreRequest(SNAPSHOT_STORE_NAME,'readwrite',store=>store.delete('pre-restore')); }
  catch(error){ console.warn('復元用スナップショットを削除できませんでした',error); }
}

async function putPhotoRecord(id,dataUrl){
  if(!id || !isStoredPhoto(dataUrl)) return null;
  await photoStoreRequest('readwrite',store=>store.put({
    id:String(id),dataUrl,byteSize:photoByteSize(dataUrl),updatedAt:Date.now()
  }));
  return String(id);
}

async function getPhotoRecord(id){
  if(!id) return null;
  return photoStoreRequest('readonly',store=>store.get(String(id)));
}

async function deletePhotoRecord(id){
  if(!id || !photoStorageAvailable) return;
  try{ await photoStoreRequest('readwrite',store=>store.delete(String(id))); }
  catch(error){ console.warn('写真データを削除できませんでした',error); }
}

async function prunePhotoRecords(targetData=data){
  if(!photoStorageAvailable) return;
  const referenced=new Set();
  for(const plant of targetData.plants || []){
    if(plant.photoId) referenced.add(String(plant.photoId));
    for(const log of plant.logs || []) if(log.photoId) referenced.add(String(log.photoId));
  }
  const ids=await photoStoreRequest('readonly',store=>store.getAllKeys());
  await Promise.all(ids.filter(id=>!referenced.has(String(id))).map(deletePhotoRecord));
}

async function savePhotoData(dataUrl,existingId=null,prefix='photo'){
  if(!isStoredPhoto(dataUrl)) return null;
  if(!photoStorageAvailable) return existingId;
  const id=existingId || `${prefix}:${crypto.randomUUID()}`;
  await putPhotoRecord(id,dataUrl);
  return id;
}

async function persistEmbeddedPhotos(targetData=data){
  let migrated=0;
  for(const plant of targetData.plants || []){
    if(isStoredPhoto(plant.photo)){
      plant.photoId=plant.photoId || `plant:${String(plant.id)}:profile`;
      await putPhotoRecord(plant.photoId,plant.photo);
      migrated++;
    }
    for(const [index,log] of (plant.logs || []).entries()){
      if(!isStoredPhoto(log.photo)) continue;
      log.photoId=log.photoId || `plant:${String(plant.id)}:log:${Number(log.time) || 0}:${index}`;
      await putPhotoRecord(log.photoId,log.photo);
      migrated++;
    }
  }
  return migrated;
}

async function hydrateStoredPhotos(targetData=data){
  for(const plant of targetData.plants || []){
    if(plant.photoId && !isStoredPhoto(plant.photo)){
      const record=await getPhotoRecord(plant.photoId);
      plant.photo=record?.dataUrl || '';
    }
    for(const log of plant.logs || []){
      if(!log.photoId || isStoredPhoto(log.photo)) continue;
      const record=await getPhotoRecord(log.photoId);
      log.photo=record?.dataUrl || '';
    }
  }
}

async function initializePhotoStorage(){
  try{
    await openPhotoDatabase();
    photoStorageAvailable=true;
    await persistEmbeddedPhotos(data);
    await hydrateStoredPhotos(data);
    localStorage.setItem(KEY,JSON.stringify(storageDataPayload(data)));
  }catch(error){
    photoStorageAvailable=false;
    console.warn('IndexedDBを利用できないため、従来の写真保存を継続します',error);
  }
}

function formatStorageSize(bytes){
  const value=Number(bytes) || 0;
  if(value<1024) return `${value}B`;
  if(value<1024*1024) return `${(value/1024).toFixed(1)}KB`;
  return `${(value/1024/1024).toFixed(1)}MB`;
}

async function photoStorageStats(){
  if(!photoStorageAvailable) return {available:false,count:0,photoBytes:0};
  const records=await photoStoreRequest('readonly',store=>store.getAll());
  const estimate=navigator.storage?.estimate?await navigator.storage.estimate():{};
  return {
    available:true,
    count:records.length,
    photoBytes:records.reduce((sum,record)=>sum+(Number(record.byteSize) || photoByteSize(record.dataUrl)),0),
    usage:Number(estimate.usage) || 0,
    quota:Number(estimate.quota) || 0
  };
}

async function updatePhotoStorageStatus(){
  const target=$('photoStorageStatus');
  if(!target) return;
  try{
    const stats=await photoStorageStats();
    if(!stats.available){
      target.textContent='写真：従来方式で保存中';
      return;
    }
    const quota=stats.quota?` ／ サイト全体 ${formatStorageSize(stats.usage)} / 推定上限 ${formatStorageSize(stats.quota)}`:'';
    target.textContent=`写真 ${stats.count}枚・約${formatStorageSize(stats.photoBytes)}${quota}`;
  }catch(error){
    target.textContent='写真ストレージの使用量を取得できません';
  }
}
