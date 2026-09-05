

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

function inputDialogState(dialog){
  return JSON.stringify([...dialog.querySelectorAll('input,select,textarea')].map(field=>[
    field.id,field.type==='checkbox'?field.checked:field.type==='file'?(field.files?.[0]?.name || ''):field.value
  ]));
}

function clearFieldError(fieldId){
  const field=$(fieldId);
  const errorId=(field.getAttribute('aria-describedby') || '').split(/\s+/)[0];
  const error=$(errorId);
  field.removeAttribute('aria-invalid');
  if(error) error.textContent='';
}

function showFieldError(fieldId,message){
  const field=$(fieldId);
  const errorId=(field.getAttribute('aria-describedby') || '').split(/\s+/)[0];
  const error=$(errorId);
  field.setAttribute('aria-invalid','true');
  if(error) error.textContent=message;
  field.focus({preventScroll:true});
  field.scrollIntoView({behavior:'smooth',block:'center'});
  return false;
}

function markInputPristine(dialog){
  dialog.dataset.inputBaseline=inputDialogState(dialog);
}

function inputDialogDirty(dialog){
  return dialog.dataset.inputBaseline!==undefined && dialog.dataset.inputBaseline!==inputDialogState(dialog);
}

function requestInputDialogClose(dialog,onClose=()=>{}){
  if(inputDialogDirty(dialog) && !confirm('入力途中の内容を破棄しますか？')) return false;
  markInputPristine(dialog);
  onClose();
  dialog.close();
  return true;
}

function closeInputDialogAfterSave(dialog){
  markInputPristine(dialog);
  dialog.close();
}

document.querySelectorAll('.input-dialog').forEach(dialog=>{
  dialog.addEventListener('input',event=>{
    if(event.target?.getAttribute?.('aria-invalid')==='true') clearFieldError(event.target.id);
  });
  dialog.addEventListener('cancel',event=>{
    event.preventDefault();
    requestInputDialogClose(dialog);
  });
});

const THEME_KEY='plant-care-theme-v1';
const THEME_LABELS={auto:'自動',light:'ライト',dark:'ダーク'};
const systemDarkMode=window.matchMedia('(prefers-color-scheme: dark)');
const isThemeMode=mode=>Object.prototype.hasOwnProperty.call(THEME_LABELS,mode);

function savedThemeMode(){
  try{
    const mode=localStorage.getItem(THEME_KEY) || 'auto';
    return isThemeMode(mode)?mode:'auto';
  }catch(e){
    return 'auto';
  }
}

function applyTheme(mode,{persist=false}={}){
  const selected=isThemeMode(mode)?mode:'auto';
  const effective=selected==='auto'?(systemDarkMode.matches?'dark':'light'):selected;
  document.documentElement.dataset.theme=effective;
  $('themeColorMeta').content=effective==='dark'?'#0f172a':'#f3f4f6';
  $('themeSettingsBtn').textContent=`表示テーマ：${THEME_LABELS[selected]}`;
  if(persist){
    try{ localStorage.setItem(THEME_KEY,selected); }catch(e){}
  }
}

function initializeTheme(){
  applyTheme(savedThemeMode());
  const followSystemTheme=()=>{
    if(savedThemeMode()==='auto') applyTheme('auto');
  };
  if(systemDarkMode.addEventListener) systemDarkMode.addEventListener('change',followSystemTheme);
  else systemDarkMode.addListener(followSystemTheme);
}

const RELEASE_NOTES=[
  {
    version:'1.16.0',date:'2026年9月5日',title:'いつものケアをすばやく記録',
    items:[
      '植物ごとの直前のケア内容を、日時以外そのまま入力できるようになりました。',
      'よく使うケア内容を最大20件のテンプレートとして保存・適用・削除できます。',
      '薬剤名、肥料名、希釈倍率や使用量を、過去の記録とテンプレートから選べます。',
      '中央の記録メニューに、最近使ったケアを最大3件表示します。',
      'ケア予定を翌日へ複製できるようになりました。',
      '複数のケア予定を選び、まとめて完了記録または1日延期できます。'
    ]
  },
  {
    version:'1.15.0',date:'2026年9月5日',title:'成長の変化をグラフと写真で確認',
    items:[
      '高さ、幹・茎の太さ、葉数を数値で記録し、植物詳細に推移グラフを表示します。',
      'これまでの「12cm」「18枚」形式の測定記録も、そのままグラフへ反映します。',
      '成長タイムラインを、すべて、写真、測定、ケアで絞り込めるようになりました。',
      '2枚の写真比較に撮影日の間隔を表示します。',
      '成長写真を古い順に連続表示し、経過日数を確認できます。',
      '写真と撮影日をまとめたHTMLファイルを書き出せるようになりました。'
    ]
  },
  {
    version:'1.14.0',date:'2026年9月4日',title:'入力画面を迷わず使える形へ刷新',
    items:[
      '植物の登録・編集を、基本情報、入手情報、栽培情報、写真の順に整理しました。',
      '必須項目と任意項目を明示し、入力不足は該当欄の近くへ表示するようにしました。',
      'ケア記録・ケア予定では、選んだケアに必要な入力欄だけを分かりやすく表示します。',
      '保存ボタンを画面下部へ固定し、長い入力画面でもすぐに保存できるようにしました。',
      '入力途中で閉じる場合は確認を表示し、誤って内容を失いにくくしました。',
      '写真選択と日時入力を、スマートフォンでも押しやすい表示へ整えました。'
    ]
  },
  {
    version:'1.13.0',date:'2026年9月4日',title:'カレンダーを見やすく刷新',
    items:[
      '月表示を整理し、日ごとの記録・予定・天気の件数が分かる表示へ変更しました。',
      'すべて、水やり、ケア、予定、備忘録、天気をワンタップで切り替えられるようになりました。',
      '植物とケア種類による細かな絞り込み、色と記号の凡例を折りたたんで表示できます。',
      '選択日の内容を、スマートフォンでは下から開く画面、広い画面では月表示の横へ表示します。',
      '選択日からケアや備忘録を追加する従来の操作も、そのまま利用できます。'
    ]
  },
  {
    version:'1.12.0',date:'2026年9月4日',title:'今日画面と成長タイムラインを追加',
    items:[
      '今日の予定、期限を過ぎた予定、昨日の降雨をまとめて確認できる「今日」画面を追加しました。',
      'スマートフォンで主要画面へ移動しやすい下部ナビゲーションと、中央の記録メニューを追加しました。',
      '植物一覧で複数株を直接選び、水やり、ケア記録、予定、一括編集へ進めるようになりました。',
      '単発のケア予定は「完了」で履歴へ移し、「1日延期」で翌日へ変更できるようになりました。',
      '植物詳細を写真中心の画面へ刷新し、水やり間隔、次回予定、写真とケアの成長タイムラインを追加しました。',
      '記録した成長写真から2枚を選び、並べて比較できるようになりました。',
      '「その他」を整理・カレンダーと天気・設定・ヘルプの4区分に整理しました。',
      'バックアップ、復元、保存容量の確認を、独立した「データ管理」画面へまとめました。'
    ]
  },
  {
    version:'1.11.0',date:'2026年9月2日',title:'まとめてケア記録と操作バーを追加',
    items:[
      '複数株へ同じ水やり、薬剤散布、植え替え、施肥、状態記録をまとめて登録できるようになりました。',
      '画面上部のまとめ操作を、スマートフォンでは文字サイズを保ったまま横スクロールできるようにしました。',
      '「植物を追加」を一覧画面専用の位置へ移動し、日常的なまとめ操作と役割を分けました。'
    ]
  },
  {
    version:'1.10.0',date:'2026年9月1日',title:'タグ・一括編集とカレンダー連携を追加',
    items:[
      '株へ複数のタグを登録し、検索やタグ絞り込みに利用できるようになりました。',
      '複数株のタグ、管理場所、生育区分、管理状態をまとめて変更できるようになりました。',
      'ケア予定と備忘録を、iPhoneやMacのカレンダーで開けるiCalendar（.ics）形式で書き出せるようになりました。'
    ]
  },
  {
    version:'1.9.0',date:'2026年8月26日',title:'カレンダー編集と表示テーマを追加',
    items:[
      'カレンダー上の登録済みケアとケア予定を、その場で編集・削除できるようになりました。',
      '右上メニューから「自動・ライト・ダーク」の表示テーマを選べるようになりました。',
      '「自動」ではiPhoneやMacの外観設定へ連動し、選択内容は次回も維持されます。',
      'ダーク表示でもカード、ボタン、入力欄、カレンダー、各ダイアログの境界が見やすくなるよう配色と枠線を調整しました。'
    ]
  },
  {
    version:'1.8.1',date:'2026年8月26日',title:'主要操作を画面上部へ集約',
    items:[
      '「まとめてケア予定」と「備忘録・予定」を画面上部から直接開けるようになりました。',
      '主要な4つの操作ボタンを、同じ幅・等間隔の横一列へ整理しました。',
      'スマートフォンの画面幅に合わせて、ボタンの文字サイズを自動調整します。',
      '従来どおり、右上メニューからも予定機能を利用できます。'
    ]
  },
  {
    version:'1.8.0',date:'2026年8月26日',title:'備忘録・まとめて予定を追加',
    items:[
      '液肥や作業予定などを、株を選ばずに登録できるようになりました。',
      '予定名、日時、メモと、日・週・月単位の繰り返しを設定できます。',
      '同じケア予定を、選択した複数株へまとめて登録できるようになりました。',
      '右上メニューとカレンダーの日付から登録し、カレンダーで確認できます。',
      '備忘録・予定をバックアップと復元の対象に追加しました。'
    ]
  },
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
  const releases=source==='notice'?RELEASE_NOTES.slice(0,1):RELEASE_NOTES;
  $('releaseNotesHint').textContent=source==='notice'
    ?'今回のアップデート内容です。過去の更新情報は「その他」メニューから確認できます。'
    :'塊根植物記録の主な変更内容です。';
  $('releaseNotesList').innerHTML=releases.map((release,index)=>`
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
    showFieldError(id,'記録日時を入力してください。');
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
    showFieldError(id,'予定日時を入力してください。');
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

function parsePlantTags(value){
  return normalizePlantTags(String(value || '').split(/[,、\n]/));
}

function plantTagsHtml(plant,{limit=4}={}){
  const tags=normalizePlantTags(plant.tags);
  if(!tags.length) return '';
  const visible=tags.slice(0,limit);
  const more=tags.length>limit?`<span class="plant-tag more">＋${tags.length-limit}</span>`:'';
  return `<div class="plant-tags">${visible.map(tag=>`<span class="plant-tag">${esc(tag)}</span>`).join('')}${more}</div>`;
}

function renderPlantTagFilter(){
  const select=$('plantTagFilter');
  const current=select.value;
  const tags=[...new Set(data.plants.flatMap(plant=>normalizePlantTags(plant.tags)))]
    .sort((a,b)=>a.localeCompare(b,'ja'));
  select.innerHTML='<option value="">すべてのタグ</option>'+tags.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join('');
  select.value=tags.includes(current)?current:'';
}

function filteredPlants(){
  const query=$('plantSearch').value.trim().toLocaleLowerCase('ja-JP');
  const statusFilter=$('plantStatusFilter').value;
  const stageFilter=$('plantStageFilter').value;
  const tagFilter=$('plantTagFilter').value;
  return data.plants.filter(plant=>{
    const status=plantManagementStatus(plant);
    const statusMatch=statusFilter==='all' ||
      (statusFilter==='current' && status!=='ended') ||
      status===statusFilter;
    const stageMatch=!stageFilter || (plant.stage || '成株')===stageFilter;
    const tagMatch=!tagFilter || normalizePlantTags(plant.tags).includes(tagFilter);
    const searchTarget=[plant.name,plant.type,plant.location,plant.source,plant.memo,...normalizePlantTags(plant.tags)]
      .filter(Boolean).join(' ').toLocaleLowerCase('ja-JP');
    const queryMatch=!query || searchTarget.includes(query);
    return statusMatch && stageMatch && tagMatch && queryMatch;
  });
}

let listSelectionMode=false;
const listSelectedPlantIds=new Set();

function selectedListPlantIds(){
  return [...listSelectedPlantIds].filter(id=>data.plants.some(plant=>
    String(plant.id)===String(id) && plantManagementStatus(plant)!=='ended'
  ));
}

function updateListSelectionUi(){
  const selected=selectedListPlantIds();
  const available=filteredPlants().filter(plant=>plantManagementStatus(plant)!=='ended');
  const allVisibleSelected=available.length && available.every(plant=>listSelectedPlantIds.has(String(plant.id)));
  $('selectionNotice').hidden=!listSelectionMode;
  $('selectionCount').textContent=`${selected.length}株を選択中`;
  $('selectionActionBar').hidden=!listSelectionMode || selected.length===0;
  $('toggleSelectModeBtn').textContent=listSelectionMode?(allVisibleSelected?'選択解除':'すべて選択'):'複数選択';
  $('listScreenTitle').textContent=listSelectionMode?'植物を選択':'植物一覧';
}

function setListSelectionMode(enabled,{renderList=true}={}){
  listSelectionMode=Boolean(enabled);
  if(!listSelectionMode) listSelectedPlantIds.clear();
  if(renderList) render();
  else updateListSelectionUi();
}

window.toggleListPlantSelection=id=>{
  if(!listSelectionMode) return;
  const key=String(id);
  if(listSelectedPlantIds.has(key)) listSelectedPlantIds.delete(key);
  else listSelectedPlantIds.add(key);
  render();
};

function render(){
  const root=$('plants');
  applyListLayout();
  renderPlantTagFilter();
  if(typeof renderToday==='function') renderToday();
  updateListSelectionUi();
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
    const photo=isStoredPhoto(p.photo)
      ?`<img class="plant-card-photo" src="${p.photo}" alt="${esc(p.name)}の写真">`
      :'<div class="plant-card-photo plant-card-photo-placeholder" aria-hidden="true">🌿</div>';
    const selected=listSelectedPlantIds.has(String(p.id));
    const selectionControl=listSelectionMode && status!=='ended'
      ?`<label class="plant-select-control" onclick="event.stopPropagation()">
        <input type="checkbox" ${selected?'checked':''} aria-label="${esc(p.name)}を選択"
          onchange="toggleListPlantSelection('${esc(String(p.id))}')">
      </label>`:'';
    const careActions=listSelectionMode?'' : status==='ended'
      ?'<div class="care-closed-note">管理終了した株です</div>'
      :`<div class="care-actions">
        <button class="care" onclick="event.stopPropagation();openCare('${p.id}')">＋ ケアを記録</button>
        <button class="quick-water" onclick="event.stopPropagation();quickWater('${p.id}')">💧 水やり</button>
      </div>`;
    return `<div class="card plant-card${listSelectionMode?' selection-mode':''}${selected?' is-selected':''}" role="button" tabindex="0"
      aria-label="${esc(p.name)}${listSelectionMode?'を選択':'の詳細を表示'}"
      onclick="handlePlantCardClick('${p.id}',event)" onkeydown="handlePlantCardKey('${p.id}',event)">
      ${selectionControl}
      <div class="plant-card-content">
        ${photo}
        <div class="plant-card-copy">
          <div class="plant-summary">
            <div class="name">${esc(p.name)}</div>
            <div class="meta">${esc(p.stage || '成株')}${p.type?` ・ ${esc(p.type)}`:''}${plantStatusBadge(p)}</div>
            ${plantTagsHtml(p)}
          </div>
          <div class="elapsed">${e.main} <span>${e.sub}</span></div>
          <div class="meta">前回：${fmtDate(last?.time)}</div>
        </div>
      </div>
      ${careActions}
    </div>`;
  }).join('');
  renderCalendarFilters();
  if(!$('calendarView').classList.contains('hidden')) renderCalendar();
}

window.quickWater=(id,source='list')=>{
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
    note:source==='detail'?'植物詳細の水やりボタンから記録':'一覧の水やりボタンから記録'
  };
  p.logs.unshift(log);
  p.logs.sort((a,b)=>b.time-a.time);
  if(save()){
    toast(`💧 ${p.name} の水やりを記録しました`);
    trackPlantCareEvent('water_recorded',{method:'quick',source});
  }else p.logs=p.logs.filter(item=>item!==log);
};

$('listLayoutBtn').onclick=()=>setListLayout('list');
$('gridLayoutBtn').onclick=()=>setListLayout('grid');
$('plantSearch').oninput=render;
$('plantStatusFilter').onchange=render;
$('plantStageFilter').onchange=render;
$('plantTagFilter').onchange=render;
$('toggleSelectModeBtn').onclick=()=>{
  if(!listSelectionMode){
    setListSelectionMode(true);
    return;
  }
  const available=filteredPlants().filter(plant=>plantManagementStatus(plant)!=='ended');
  const allSelected=available.length && available.every(plant=>listSelectedPlantIds.has(String(plant.id)));
  available.forEach(plant=>{
    const id=String(plant.id);
    if(allSelected) listSelectedPlantIds.delete(id);
    else listSelectedPlantIds.add(id);
  });
  render();
};
$('cancelSelectModeBtn').onclick=()=>setListSelectionMode(false);
$('selectionWaterBtn').onclick=()=>{
  const ids=selectedListPlantIds();
  openBatchWatering(null,ids);
  setListSelectionMode(false);
};
$('selectionCareBtn').onclick=()=>{
  const ids=selectedListPlantIds();
  openBatchCareRecording(ids);
  setListSelectionMode(false);
};
$('selectionPlanBtn').onclick=()=>{
  const ids=selectedListPlantIds();
  openBatchPlanning(ids);
  setListSelectionMode(false);
};
$('selectionEditBtn').onclick=()=>{
  const ids=selectedListPlantIds();
  openBatchEdit(ids);
  setListSelectionMode(false);
};

function handlePlantCardClick(id,event){
  if(event.target.closest('button,.menu-panel')) return;
  if(listSelectionMode){
    toggleListPlantSelection(id);
    return;
  }
  openPlantDetails(id);
}

function handlePlantCardKey(id,event){
  if((event.key==='Enter' || event.key===' ') && !event.target.closest('button')){
    event.preventDefault();
    if(listSelectionMode){
      toggleListPlantSelection(id);
      return;
    }
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

function plantWateringStats(plant){
  const times=(plant.logs || [])
    .filter(log=>(log.care || '水やり')==='水やり' && Number.isFinite(Number(log.time)))
    .map(log=>Number(log.time))
    .sort((a,b)=>b-a);
  if(!times.length) return {lastAt:null,averageDays:null,count:0};
  if(times.length===1) return {lastAt:times[0],averageDays:null,count:1};
  const intervals=times.slice(0,-1).map((time,index)=>Math.abs(time-times[index+1])/86400000);
  const average=intervals.reduce((sum,value)=>sum+value,0)/intervals.length;
  return {lastAt:times[0],averageDays:average,count:times.length};
}

function nextPlanOccurrence(plant){
  const plans=plant.plans || [];
  if(!plans.length) return null;
  const now=new Date();
  const dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const candidates=[];
  plans.forEach(plan=>{
    const unit=plan.recurrence?.unit || 'none';
    if(unit==='none'){
      if(Number(plan.startAt)>=Date.now()) candidates.push({plan,time:Number(plan.startAt)});
      return;
    }
    if(typeof planOccursOnDate!=='function') return;
    for(let offset=0;offset<=400;offset++){
      const target=new Date(dayStart);
      target.setDate(dayStart.getDate()+offset);
      const key=dateKey(target);
      if(!planOccursOnDate(plan,key)) continue;
      const original=new Date(Number(plan.startAt));
      target.setHours(original.getHours(),original.getMinutes(),0,0);
      candidates.push({plan,time:target.getTime(),isToday:offset===0});
      break;
    }
  });
  return candidates.sort((a,b)=>a.time-b.time)[0] || null;
}

function detailPlanTime(item){
  if(!item) return '予定なし';
  const target=new Date(item.time);
  const today=new Date();
  const tomorrow=new Date(today);
  tomorrow.setDate(today.getDate()+1);
  const key=dateKey(target);
  const prefix=key===dateKey(today)?'今日':key===dateKey(tomorrow)?'明日':`${target.getMonth()+1}/${target.getDate()}`;
  return `${prefix} ${String(target.getHours()).padStart(2,'0')}:${String(target.getMinutes()).padStart(2,'0')}`;
}

function timelineIcon(care){
  return {'水やり':'💧','薬剤散布':'☘','植え替え':'♻','施肥':'✦','状態・写真記録':'📷'}[care] || '✓';
}

function legacyMeasurementNumber(value){
  if(value===undefined || value===null || value==='') return null;
  const number=Number.parseFloat(String(value).replace(',','.'));
  return Number.isFinite(number) && number>=0?number:null;
}

function measurementValue(log,key){
  const details=log?.details || {};
  const structured=details.measurements?.[key];
  if(Number.isFinite(Number(structured)) && Number(structured)>=0) return Number(structured);
  const legacyKey={height:'height',trunkWidth:'trunkWidth',leafCount:'leafCount'}[key];
  return legacyMeasurementNumber(details[legacyKey]);
}

function logHasMeasurement(log){
  return ['height','trunkWidth','leafCount'].some(key=>measurementValue(log,key)!==null);
}

function timelineMatches(log,filter){
  if(filter==='photo') return isStoredPhoto(log.photo);
  if(filter==='measurement') return logHasMeasurement(log);
  if(filter==='care') return (log.care || '水やり')!=='状態・写真記録';
  return true;
}

function plantTimelineHtml(plant,filter='all'){
  const logs=[...(plant.logs || [])].filter(log=>timelineMatches(log,filter)).sort((a,b)=>Number(b.time)-Number(a.time)).slice(0,12);
  if(!logs.length) return `<div class="detail-timeline-empty">${filter==='all'?'まだ記録がありません。最初のケアや成長写真を記録してみましょう。':'この条件に合う記録はありません。'}</div>`;
  return `<div class="detail-timeline">${logs.map(log=>`
    <article class="detail-timeline-item${isStoredPhoto(log.photo)?' has-photo':''}" data-timeline-kind="${isStoredPhoto(log.photo)?'photo':logHasMeasurement(log)?'measurement':'care'}">
      <div class="detail-timeline-marker" aria-hidden="true">${timelineIcon(log.care || '水やり')}</div>
      <div class="detail-timeline-body">
        <div class="detail-timeline-heading"><strong>${esc(log.care || '水やり')}</strong><time>${esc(fmtDate(log.time))}</time></div>
        <div class="detail-timeline-note">${careDetailHtml(log)}</div>
        ${isStoredPhoto(log.photo)?`<img class="detail-timeline-photo" src="${log.photo}" alt="${esc(fmtDate(log.time))}の成長記録">`:''}
      </div>
    </article>`).join('')}</div>`;
}

function plantGrowthMeasurements(plant){
  return (plant.logs || []).map(log=>({
    time:Number(log.time),height:measurementValue(log,'height'),trunkWidth:measurementValue(log,'trunkWidth'),leafCount:measurementValue(log,'leafCount')
  })).filter(item=>Number.isFinite(item.time) && [item.height,item.trunkWidth,item.leafCount].some(value=>value!==null)).sort((a,b)=>a.time-b.time);
}

function growthChartCard(items,key,label,unit,color){
  const values=items.filter(item=>item[key]!==null).slice(-12);
  if(!values.length) return '';
  const numbers=values.map(item=>item[key]);
  const min=Math.min(...numbers),max=Math.max(...numbers),range=max-min || 1;
  const points=values.map((item,index)=>{
    const x=values.length===1?150:14+(index/(values.length-1))*272;
    const y=84-((item[key]-min)/range)*64;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const latest=values.at(-1);
  const change=values.length>1?latest[key]-values[0][key]:null;
  const changeText=change===null?'最初の測定':`${change>=0?'+':''}${Number(change.toFixed(1))}${unit}`;
  return `<article class="growth-chart-card">
    <div class="growth-chart-heading"><div><span>${esc(label)}</span><strong>${esc(String(latest[key]))}${esc(unit)}</strong></div><small>${esc(changeText)}・${values.length}回</small></div>
    <svg viewBox="0 0 300 100" role="img" aria-label="${esc(label)}の推移。最新${latest[key]}${unit}">
      <line x1="14" y1="84" x2="286" y2="84" class="growth-chart-axis"/>
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      ${points.split(' ').map(point=>{const [x,y]=point.split(',');return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`;}).join('')}
    </svg>
    <div class="growth-chart-dates"><span>${esc(dateOnly(dateKey(new Date(values[0].time))))}</span><span>${esc(dateOnly(dateKey(new Date(latest.time))))}</span></div>
  </article>`;
}

function plantGrowthChartsHtml(plant){
  const items=plantGrowthMeasurements(plant);
  if(!items.length) return '<div class="detail-timeline-empty">状態・写真記録で高さ、太さ、葉数を入力すると推移を表示します。</div>';
  return `<div class="growth-chart-grid">
    ${growthChartCard(items,'height','高さ','cm','#4f7a55')}
    ${growthChartCard(items,'trunkWidth','幹・茎','cm','#0e7490')}
    ${growthChartCard(items,'leafCount','葉数','枚','#7c3aed')}
  </div>`;
}

function plantComparisonPhotos(plant){
  const items=(plant.logs || [])
    .filter(log=>isStoredPhoto(log.photo))
    .sort((a,b)=>Number(a.time)-Number(b.time))
    .map(log=>({src:log.photo,time:Number(log.time),label:`${fmtDate(log.time)} ・ ${log.care || '成長記録'}`}));
  if(isStoredPhoto(plant.photo)) items.push({src:plant.photo,time:Number(plant.updatedAt || plant.createdAt || Date.now()),label:'現在の登録写真'});
  return items.sort((a,b)=>a.time-b.time);
}

let photoComparisonItems=[];
let detailTimelineFilter='all';
let growthPhotoSequenceItems=[];
let growthPhotoSequenceIndex=0;

function openPlantDetails(id){
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  const plantChanged=typeof detailPlantId==='undefined' || String(detailPlantId)!==String(p.id);
  detailPlantId=p.id;
  if(plantChanged) detailTimelineFilter='all';
  const water=plantWateringStats(p);
  const nextPlan=nextPlanOccurrence(p);
  const hero=isStoredPhoto(p.photo)
    ?`<img class="detail-hero-photo detail-photo" src="${p.photo}" alt="${esc(p.name)}の登録写真">`
    :'<div class="detail-hero-photo detail-hero-placeholder" aria-hidden="true">🌿</div>';
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
    detailItem('タグ',plantTagsHtml(p,{limit:50}),true),
    detailItem('雨の当たり方',p.rainExposure==='sheltered'?'雨が当たらない':'雨が当たる'),
    detailItem('メモ',p.memo?`<span class="detail-note">${esc(p.memo)}</span>`:'',true)
  ].join('');
  $('plantDetailsContent').innerHTML=`
    <div class="detail-hero">
      ${hero}
      <button class="detail-hero-close" type="button" aria-label="詳細を閉じる" onclick="$('plantDetailsDialog').close()">×</button>
      <div class="detail-hero-overlay">
        <h2 class="detail-title">${esc(p.name)}</h2>
        <div class="detail-subtitle">${esc(p.stage || '成株')}${p.type?` ・ ${esc(p.type)}`:''}${plantStatusBadge(p)}</div>
        ${plantTagsHtml(p,{limit:4})}
      </div>
    </div>
    <section class="detail-vitals" aria-label="管理状況">
      <div><span>前回の水やり</span><strong>${water.lastAt?esc(elapsed(water.lastAt).main):'未記録'}</strong><small>${water.lastAt?esc(fmtDate(water.lastAt)):'水やりを記録してください'}</small></div>
      <div><span>平均間隔</span><strong>${water.averageDays===null?'--':`${water.averageDays<10?water.averageDays.toFixed(1):Math.round(water.averageDays)}日`}</strong><small>${water.count>=2?`${water.count}回の記録から`:'2回以上で表示'}</small></div>
      <div><span>次の予定</span><strong>${esc(detailPlanTime(nextPlan))}</strong><small>${nextPlan?esc(nextPlan.plan.care || 'ケア予定'):'予定を追加できます'}</small></div>
    </section>`;
  $('plantDetailsTimelineContent').innerHTML=`
    <section class="detail-section growth-chart-section">
      <div class="detail-section-heading"><div><span class="screen-eyebrow">測定値をひと目で比較</span><h3>成長の推移</h3></div></div>
      ${plantGrowthChartsHtml(p)}
    </section>
    <section class="detail-section detail-timeline-section">
      <div class="detail-section-heading"><div><span class="screen-eyebrow">写真とケアを時系列で確認</span><h3>成長タイムライン</h3></div><button class="secondary" type="button" onclick="$('historyPlantDetails').click()">すべて見る</button></div>
      <div class="timeline-filter-chips" role="group" aria-label="タイムラインの絞り込み">
        ${[['all','すべて'],['photo','写真'],['measurement','測定'],['care','ケア']].map(([value,label])=>`<button type="button" class="${detailTimelineFilter===value?'active':''}" aria-pressed="${detailTimelineFilter===value}" onclick="setDetailTimelineFilter('${value}')">${label}</button>`).join('')}
      </div>
      <div id="plantTimelineList">${plantTimelineHtml(p,detailTimelineFilter)}</div>
    </section>
    ${acquisition?`<section class="detail-section"><h3>入手情報</h3><div class="detail-grid">${acquisition}</div></section>`:''}
    ${cultivation?`<section class="detail-section"><h3>栽培情報・メモ</h3><div class="detail-grid">${cultivation}</div></section>`:''}`;
  $('carePlantDetails').disabled=plantManagementStatus(p)==='ended';
  $('quickWaterPlantDetails').disabled=plantManagementStatus(p)==='ended';
  $('plansPlantDetails').disabled=plantManagementStatus(p)==='ended';
  const comparisonCount=plantComparisonPhotos(p).length;
  $('comparePhotosPlantDetails').disabled=comparisonCount<2;
  $('comparePhotosPlantDetails').textContent=comparisonCount<2?'成長写真を比較（2枚必要）':'成長写真を比較';
  $('growthPhotoSequencePlantDetails').disabled=comparisonCount<1;
  $('growthPhotoSequencePlantDetails').textContent=comparisonCount?'成長写真を連続表示':'成長写真を連続表示（写真なし）';
  $('exportGrowthPhotosPlantDetails').disabled=comparisonCount<1;
  if(!$('plantDetailsDialog').open) $('plantDetailsDialog').showModal();
  trackPlantCareEvent('plant_details_viewed');
}

$('closePlantDetails').onclick=()=> $('plantDetailsDialog').close();
$('quickWaterPlantDetails').onclick=()=>{
  const id=detailPlantId;
  quickWater(id,'detail');
  if($('plantDetailsDialog').open) openPlantDetails(id);
};
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
$('comparePhotosPlantDetails').onclick=()=>{
  const p=data.plants.find(x=>String(x.id)===String(detailPlantId));
  if(!p) return;
  photoComparisonItems=plantComparisonPhotos(p);
  if(photoComparisonItems.length<2) return toast('比較するには成長写真を2枚以上記録してください');
  const options=photoComparisonItems.map((item,index)=>`<option value="${index}">${esc(item.label)}</option>`).join('');
  $('comparePhotoA').innerHTML=options;
  $('comparePhotoB').innerHTML=options;
  $('comparePhotoA').value='0';
  $('comparePhotoB').value=String(photoComparisonItems.length-1);
  $('photoCompareTitle').textContent=`${p.name} の成長比較`;
  renderPhotoComparison();
  $('plantDetailsDialog').close();
  $('photoCompareDialog').showModal();
  trackPlantCareEvent('growth_photos_compared',{photo_count:photoComparisonItems.length});
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

function renderPhotoComparison(){
  const left=photoComparisonItems[Number($('comparePhotoA').value)];
  const right=photoComparisonItems[Number($('comparePhotoB').value)];
  if(!left || !right) return;
  const days=Math.abs(Math.round((right.time-left.time)/86400000));
  $('photoCompareStage').innerHTML=`
    <figure><img src="${left.src}" alt="左：${esc(left.label)}"><figcaption>${esc(left.label)}</figcaption></figure>
    <figure><img src="${right.src}" alt="右：${esc(right.label)}"><figcaption>${esc(right.label)}</figcaption></figure>
    <div class="photo-compare-elapsed" aria-live="polite">2枚の間隔：<strong>${days}日</strong></div>`;
}

$('comparePhotoA').onchange=renderPhotoComparison;
$('comparePhotoB').onchange=renderPhotoComparison;
$('closePhotoCompare').onclick=()=>{
  $('photoCompareDialog').close();
  openPlantDetails(detailPlantId);
};

window.setDetailTimelineFilter=filter=>{
  if(!['all','photo','measurement','care'].includes(filter)) return;
  detailTimelineFilter=filter;
  const p=data.plants.find(x=>String(x.id)===String(detailPlantId));
  if(!p) return;
  document.querySelectorAll('.timeline-filter-chips button').forEach(button=>{
    const active=button.getAttribute('onclick')?.includes(`'${filter}'`);
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  $('plantTimelineList').innerHTML=plantTimelineHtml(p,filter);
};

function growthPhotoElapsed(items,index){
  if(!items.length || !Number.isFinite(items[index]?.time) || !Number.isFinite(items[0]?.time)) return '';
  const days=Math.max(0,Math.round((items[index].time-items[0].time)/86400000));
  return index===0?'最初の写真':`最初の写真から${days}日`;
}

function renderGrowthPhotoSequence(){
  const item=growthPhotoSequenceItems[growthPhotoSequenceIndex];
  if(!item) return;
  $('growthPhotoSequenceImage').src=item.src;
  $('growthPhotoSequenceImage').alt=`${item.label}の成長写真`;
  $('growthPhotoSequenceDate').textContent=item.label;
  $('growthPhotoSequenceElapsed').textContent=growthPhotoElapsed(growthPhotoSequenceItems,growthPhotoSequenceIndex);
  $('growthPhotoSequenceCount').textContent=`${growthPhotoSequenceIndex+1} / ${growthPhotoSequenceItems.length}`;
  $('previousGrowthPhoto').disabled=growthPhotoSequenceIndex===0;
  $('nextGrowthPhoto').disabled=growthPhotoSequenceIndex===growthPhotoSequenceItems.length-1;
}

$('growthPhotoSequencePlantDetails').onclick=()=>{
  const p=data.plants.find(x=>String(x.id)===String(detailPlantId));
  if(!p) return;
  growthPhotoSequenceItems=plantComparisonPhotos(p);
  if(!growthPhotoSequenceItems.length) return toast('成長写真がありません');
  growthPhotoSequenceIndex=0;
  $('growthPhotoSequenceTitle').textContent=`${p.name} の成長写真`;
  renderGrowthPhotoSequence();
  $('plantDetailsDialog').close();
  $('growthPhotoSequenceDialog').showModal();
  trackPlantCareEvent('growth_photo_sequence_viewed',{photo_count:growthPhotoSequenceItems.length});
};
$('previousGrowthPhoto').onclick=()=>{ if(growthPhotoSequenceIndex>0){growthPhotoSequenceIndex--;renderGrowthPhotoSequence();} };
$('nextGrowthPhoto').onclick=()=>{ if(growthPhotoSequenceIndex<growthPhotoSequenceItems.length-1){growthPhotoSequenceIndex++;renderGrowthPhotoSequence();} };
$('closeGrowthPhotoSequence').onclick=()=>{
  $('growthPhotoSequenceDialog').close();
  openPlantDetails(detailPlantId);
};

$('exportGrowthPhotosPlantDetails').onclick=()=>{
  const p=data.plants.find(x=>String(x.id)===String(detailPlantId));
  if(!p) return;
  const photos=plantComparisonPhotos(p);
  if(!photos.length) return toast('書き出す成長写真がありません');
  const figures=photos.map((item,index)=>`<figure><img src="${item.src}" alt="${esc(item.label)}"><figcaption><strong>${esc(item.label)}</strong><span>${esc(growthPhotoElapsed(photos,index))}</span></figcaption></figure>`).join('');
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(p.name)}の成長写真</title><style>body{max-width:760px;margin:auto;padding:24px;font-family:-apple-system,sans-serif;color:#17201a;background:#f3f4f6}h1{font-size:24px}main{display:grid;gap:18px}figure{margin:0;padding:12px;border-radius:16px;background:#fff}img{display:block;width:100%;max-height:760px;object-fit:contain;border-radius:12px}figcaption{display:flex;justify-content:space-between;gap:12px;margin-top:9px;font-size:13px}span{color:#6b7280}@media(max-width:520px){body{padding:14px}figcaption{display:grid}}</style></head><body><h1>${esc(p.name)}の成長写真</h1><main>${figures}</main></body></html>`;
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=`plant-growth-${dateKey(new Date())}.html`;
  link.click();
  window.setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  toast(`${photos.length}枚の成長写真を書き出しました`);
  trackPlantCareEvent('growth_photos_exported',{photo_count:photos.length});
};

let editingPlantId=null;
let editingPlantPhoto='';
let editingPlantPhotoId='';
let editingPlantPhotoChanged=false;

const PLANT_FIELD_IDS=[
  'plantName','plantType','plantAcquiredDate','plantSource','plantPrice',
  'plantSowingDate','plantGerminationDate','plantLocation','plantTags','plantMemo'
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
  clearFieldError('plantName');
  togglePlantConditionalFields();
}

function openNewPlant(){
  editingPlantId=null;
  resetPlantForm();
  $('plantDialogTitle').textContent='植物を追加';
  $('savePlant').textContent='登録する';
  $('plantDialog').showModal();
  markInputPristine($('plantDialog'));
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
  $('plantTags').value=normalizePlantTags(p.tags).join(', ');
  $('plantRainExposure').value=p.rainExposure || 'rain';
  $('plantMemo').value=p.memo || '';
  editingPlantPhotoId=p.photoId || '';
  setPlantPhotoPreview(p.photo || '');
  $('acquisitionSection').open=Boolean(p.acquiredDate || p.acquisitionMethod || p.source || p.price || p.origin);
  $('cultivationSection').open=Boolean(p.sowingDate || p.germinationDate || p.location || normalizePlantTags(p.tags).length || p.memo || p.photo || p.rainExposure==='sheltered');
  if(p.createdAt){
    $('plantRecordMeta').hidden=false;
    $('plantRecordMeta').textContent=`登録：${fmtDate(p.createdAt)}${p.updatedAt?`　更新：${fmtDate(p.updatedAt)}`:''}`;
  }
  togglePlantConditionalFields();
  $('plantDialog').showModal();
  markInputPristine($('plantDialog'));
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
$('cancelPlant').onclick=()=>requestInputDialogClose($('plantDialog'));
$('savePlant').onclick=async()=>{
  const name=$('plantName').value.trim();
  if(!name) return showFieldError('plantName','管理名を入力してください。');
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
    tags:parsePlantTags($('plantTags').value),
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
      closeInputDialogAfterSave($('plantDialog'));
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
      closeInputDialogAfterSave($('plantDialog'));
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

function reusableCarePreset(source){
  if(!source) return null;
  return {
    care:source.care || '水やり',type:source.type || '',fertilizer:source.fertilizer || 'なし',
    details:{...(source.details || {})},note:source.note || ''
  };
}

function lastReusableCare(plant){
  return [...(plant?.logs || [])].sort((a,b)=>Number(b.time)-Number(a.time)).map(reusableCarePreset)[0] || null;
}

function recentCarePresets(){
  const logs=data.plants.flatMap(plant=>(plant.logs || []).map(log=>({...log,plantName:plant.name}))).sort((a,b)=>Number(b.time)-Number(a.time));
  const seen=new Set(),items=[];
  for(const log of logs){
    const preset=reusableCarePreset(log);
    const detailName=preset.details.name || preset.details.form || preset.type || '';
    const key=`${preset.care}:${detailName}`;
    if(seen.has(key)) continue;
    seen.add(key);
    items.push({...preset,label:detailName?`${preset.care}・${detailName}`:preset.care});
    if(items.length===3) break;
  }
  return items;
}

function careHistoryValues(care,field){
  const values=[];
  data.plants.forEach(plant=>[...(plant.logs || []),...(plant.plans || [])].forEach(item=>{
    if(item.care===care && item.details?.[field]) values.push(String(item.details[field]).trim());
  }));
  normalizeCareTemplates(data.careTemplates).forEach(item=>{
    if(item.care===care && item.details?.[field]) values.push(String(item.details[field]).trim());
  });
  return [...new Set(values.filter(Boolean))].slice(0,12);
}

function renderCareHistorySuggestions(){
  $('pesticideNameHistory').innerHTML=careHistoryValues('薬剤散布','name').map(value=>`<option value="${esc(value)}"></option>`).join('');
  $('dilutionHistory').innerHTML=[...new Set([...careHistoryValues('薬剤散布','dilution'),...careHistoryValues('施肥','amount')])].map(value=>`<option value="${esc(value)}"></option>`).join('');
  $('fertilizerNameHistory').innerHTML=careHistoryValues('施肥','name').map(value=>`<option value="${esc(value)}"></option>`).join('');
}

function renderCareTemplates(){
  const templates=normalizeCareTemplates(data.careTemplates);
  data.careTemplates=templates;
  $('careTemplateSelect').innerHTML='<option value="">テンプレートを選択</option>'+templates.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}（${esc(item.care)}）</option>`).join('');
  $('applyCareTemplate').disabled=true;
  $('deleteCareTemplate').disabled=true;
}

function applyCarePreset(preset){
  if(!preset) return;
  const details=preset.details || {};
  ['waterAmount','pesticideName','pesticideTarget','pesticideDilution','pesticideNextDate','potType','potSize','soilMix','repotReason','fertilizerName','fertilizerAmount','plantHeight','trunkWidth','leafCount','waterNote'].forEach(id=>$(id).value='');
  $('rootPruned').checked=false;
  $('careType').value=preset.care || '水やり';
  $('waterType').value=preset.type || 'たっぷり灌水';
  $('fertilizer').value=preset.fertilizer || 'なし';
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
  $('plantHeight').value=measurementValue(preset,'height') ?? '';
  $('trunkWidth').value=measurementValue(preset,'trunkWidth') ?? '';
  $('leafCount').value=measurementValue(preset,'leafCount') ?? '';
  $('waterNote').value=preset.note || '';
  toggleCareFields();
}

function carePresetFromForm(){
  const care=$('careType').value;
  const details={};
  if(care==='水やり') Object.assign(details,{waterAmount:$('waterAmount').value.trim()});
  if(care==='薬剤散布') Object.assign(details,{name:$('pesticideName').value.trim(),target:$('pesticideTarget').value.trim(),dilution:$('pesticideDilution').value.trim(),method:$('pesticideMethod').value,nextDate:$('pesticideNextDate').value});
  if(care==='植え替え') Object.assign(details,{potType:$('potType').value.trim(),potSize:$('potSize').value.trim(),soilMix:$('soilMix').value.trim(),rootPruned:$('rootPruned').checked,reason:$('repotReason').value.trim()});
  if(care==='施肥') Object.assign(details,{name:$('fertilizerName').value.trim(),form:$('fertilizerForm').value,amount:$('fertilizerAmount').value.trim()});
  if(care==='状態・写真記録'){
    const height=legacyMeasurementNumber($('plantHeight').value),trunkWidth=legacyMeasurementNumber($('trunkWidth').value),leafCount=legacyMeasurementNumber($('leafCount').value);
    Object.assign(details,{height:height===null?'':`${height}cm`,trunkWidth:trunkWidth===null?'':`${trunkWidth}cm`,leafCount:leafCount===null?'':`${Math.round(leafCount)}枚`,measurements:{height,trunkWidth,leafCount:leafCount===null?null:Math.round(leafCount)}});
  }
  return {care,type:care==='水やり'?$('waterType').value:care,fertilizer:care==='水やり'?$('fertilizer').value:'なし',details,note:$('waterNote').value.trim()};
}

function toggleCareFields(){
  Object.values(CARE_FIELD_IDS).forEach(id=>$(id).hidden=true);
  const selected=CARE_FIELD_IDS[$('careType').value];
  if(selected) $(selected).hidden=false;
  if($('careType').value!=='薬剤散布') clearFieldError('pesticideName');
  if($('careType').value!=='施肥') clearFieldError('fertilizerName');
}

let editingLogIndex=null;
let editingPlanId=null;
let careMode='record';
let batchCarePlantIds=[];
let batchPlanPlantIds=[];
let careReturnTo='';
let editingCarePhoto='';
let editingCarePhotoId='';
let activeLastCarePreset=null;
let batchCarePreset=null;

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
  clearFieldError('careRecordedAt');
  clearFieldError('pesticideName');
  clearFieldError('fertilizerName');
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
  careMode=options.mode==='batch-record'?'batch-record':options.mode==='batch-plan'?'batch-plan':options.mode==='plan'?'plan':'record';
  batchCarePlantIds=careMode==='batch-record'?(options.plantIds || []).map(String):[];
  batchPlanPlantIds=careMode==='batch-plan'?(options.plantIds || []).map(String):[];
  careReturnTo=options.returnTo || '';
  const planning=careMode==='plan' || careMode==='batch-plan';
  editingLogIndex=Number.isInteger(options.logIndex)?options.logIndex:null;
  editingPlanId=options.planId===undefined || options.planId===null?null:String(options.planId);
  resetCareForm();
  renderCareTemplates();
  renderCareHistorySuggestions();
  const existing=careMode==='plan'
    ?(p.plans || []).find(plan=>String(plan.id)===editingPlanId)
    :careMode==='batch-plan'?null:(editingLogIndex===null?null:p.logs?.[editingLogIndex]);
  $('recurrenceFields').hidden=!planning;
  $('carePhotoFields').hidden=planning || careMode==='batch-record';
  $('careDateLabel').textContent=planning?'予定日時':'記録日時';
  $('careModeLabel').textContent=planning?'これからのケアを予定':'終えたケアを記録';
  $('careDateHint').textContent=planning
    ?'開始日時と繰り返し間隔を指定してください。月末に存在しない日付は、その月の末日に予定します。'
    :'記録を忘れた場合は、実際にケアした過去の日時へ変更できます。';
  $('careRecordedAt').max=planning?'':toDateTimeLocal();
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
    $('plantHeight').value=measurementValue(existing,'height') ?? '';
    $('trunkWidth').value=measurementValue(existing,'trunkWidth') ?? '';
    $('leafCount').value=measurementValue(existing,'leafCount') ?? '';
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
    $('careTitle').textContent=careMode==='batch-record'
      ?`${batchCarePlantIds.length}株のケア記録`
      :careMode==='batch-plan'?`${batchPlanPlantIds.length}株のケア予定`:careMode==='plan'?`${p.name} のケア予定`:`${p.name} のケア記録`;
    $('saveCare').textContent=planning?'予定を保存':'記録する';
    $('careType').value='水やり';
    if(options.date) $('careRecordedAt').value=toDateTimeLocal(
      careMode==='plan'?scheduleTimeForDate(options.date):careTimeForDate(options.date)
    );
    else if(planning) $('careRecordedAt').value=toDateTimeLocal(Date.now()+60*60*1000);
    if(options.preset) applyCarePreset(options.preset);
  }
  activeLastCarePreset=!planning && careMode==='record' && editingLogIndex===null?lastReusableCare(p):null;
  $('useLastCare').hidden=!activeLastCarePreset;
  updateRecurrenceFields();
  toggleCareFields();
  $('careDialog').showModal();
  markInputPristine($('careDialog'));
};
$('careType').onchange=toggleCareFields;
$('useLastCare').onclick=()=>{
  applyCarePreset(activeLastCarePreset);
  toast('前回の内容を入力しました');
};
$('careTemplateSelect').onchange=()=>{
  const selected=Boolean($('careTemplateSelect').value);
  $('applyCareTemplate').disabled=!selected;
  $('deleteCareTemplate').disabled=!selected;
};
$('applyCareTemplate').onclick=()=>{
  const template=normalizeCareTemplates(data.careTemplates).find(item=>item.id===$('careTemplateSelect').value);
  if(!template) return;
  applyCarePreset(template);
  toast(`「${template.name}」を入力しました`);
};
$('saveCareTemplate').onclick=()=>{
  const name=prompt('テンプレート名を入力してください（40文字まで）',$('careType').value);
  if(!name?.trim()) return;
  if(!Array.isArray(data.careTemplates)) data.careTemplates=[];
  const previous=[...data.careTemplates];
  const preset=carePresetFromForm();
  data.careTemplates.unshift({id:crypto.randomUUID(),name:name.trim().slice(0,40),...preset,updatedAt:Date.now()});
  data.careTemplates=normalizeCareTemplates(data.careTemplates);
  if(save()){
    renderCareTemplates();
    toast('ケアテンプレートを保存しました');
    trackPlantCareEvent('care_template_saved',{care_type:preset.care});
  }else data.careTemplates=previous;
};
$('deleteCareTemplate').onclick=()=>{
  const template=normalizeCareTemplates(data.careTemplates).find(item=>item.id===$('careTemplateSelect').value);
  if(!template || !confirm(`テンプレート「${template.name}」を削除しますか？`)) return;
  const previous=[...data.careTemplates];
  data.careTemplates=data.careTemplates.filter(item=>item.id!==template.id);
  if(save()){
    renderCareTemplates();
    toast('テンプレートを削除しました');
  }else data.careTemplates=previous;
};
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
$('cancelCare').onclick=()=>{
  requestInputDialogClose($('careDialog'),()=>{
    batchCarePlantIds=[];
    batchPlanPlantIds=[];
    careReturnTo='';
  });
};
$('saveCare').onclick=async()=>{
  const p=data.plants.find(x=>String(x.id)===String(currentId));
  const care=$('careType').value;
  const planning=careMode==='plan' || careMode==='batch-plan';
  const recordedAt=planning?planDateTimeValue('careRecordedAt'):recordedAtValue('careRecordedAt');
  if(recordedAt===null) return;
  if(care==='薬剤散布' && !$('pesticideName').value.trim()) return showFieldError('pesticideName','薬剤名を入力してください。');
  if(care==='施肥' && !$('fertilizerName').value.trim()) return showFieldError('fertilizerName','肥料名を入力してください。');

  const preset=carePresetFromForm();
  const details=preset.details;

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
    type:preset.type,
    fertilizer:preset.fertilizer,
    details,
    note:preset.note,
    photo,
    photoId:careMode==='record' && care==='状態・写真記録'?editingCarePhotoId:''
  };
  if(careMode==='batch-record'){
    const targets=data.plants.filter(plant=>batchCarePlantIds.includes(String(plant.id)) && plantManagementStatus(plant)!=='ended');
    if(!targets.length) return alert('ケアを記録する株を選択してください');
    const previousLogs=new Map(targets.map(plant=>[String(plant.id),[...(plant.logs || [])]]));
    targets.forEach(plant=>{
      if(!Array.isArray(plant.logs)) plant.logs=[];
      plant.logs.push({...log,details:{...details},photo:'',photoId:''});
      plant.logs.sort((a,b)=>b.time-a.time);
    });
    if(save()){
      closeInputDialogAfterSave($('careDialog'));
      batchCarePlantIds=[];
      toast(`${targets.length}株にケアを記録しました`);
    }else{
      targets.forEach(plant=>{ plant.logs=previousLogs.get(String(plant.id)) || []; });
      render();
    }
    return;
  }
  if(planning){
    const recurrence={
      unit:$('recurrenceUnit').value,
      interval:Math.max(1,Math.min(365,Number($('recurrenceInterval').value) || 1))
    };
    if(careMode==='batch-plan'){
      const targets=data.plants.filter(plant=>batchPlanPlantIds.includes(String(plant.id)) && plantManagementStatus(plant)!=='ended');
      if(!targets.length) return alert('予定を登録する株を選択してください');
      const previousPlans=new Map(targets.map(plant=>[String(plant.id),[...(plant.plans || [])]]));
      targets.forEach(plant=>{
        if(!Array.isArray(plant.plans)) plant.plans=[];
        const plan={
          ...log,
          id:crypto.randomUUID(),
          startAt:recordedAt,
          recurrence:{...recurrence},
          details:{...details},
          createdAt:Date.now()
        };
        delete plan.time;
        delete plan.photo;
        delete plan.photoId;
        plant.plans.push(plan);
        plant.plans.sort((a,b)=>Number(a.startAt)-Number(b.startAt));
      });
      if(save()){
        closeInputDialogAfterSave($('careDialog'));
        batchPlanPlantIds=[];
        if(!$('calendarView').classList.contains('hidden')) renderCalendar();
        toast(`${targets.length}株にケア予定を登録しました`);
        trackPlantCareEvent('batch_care_plan_created',{care_type:care,recurrence:recurrence.unit,plant_count:targets.length});
      }else{
        targets.forEach(plant=>{ plant.plans=previousPlans.get(String(plant.id)) || []; });
        render();
      }
      return;
    }
    if(!Array.isArray(p.plans)) p.plans=[];
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
      closeInputDialogAfterSave($('careDialog'));
      toast(existingIndex>=0?'予定を変更しました':'予定を登録しました');
      trackPlantCareEvent(existingIndex>=0?'care_plan_edited':'care_plan_created',{care_type:care,recurrence:recurrence.unit});
      if(careReturnTo==='calendar') renderCalendar();
      else showPlans(p.id);
      careReturnTo='';
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
    closeInputDialogAfterSave($('careDialog'));
    trackPlantCareEvent(wasEditing?'care_history_edited':'care_recorded',{care_type:care});
    if(wasEditing){
      if(careReturnTo==='calendar') renderCalendar();
      else showHistory(p.id);
    }
    careReturnTo='';
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
  if(!isStoredPhoto(photo)) return '';
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
      <label class="plan-select-row"><input class="plan-select-check" type="checkbox" value="${esc(String(plan.id))}"><span>一括操作の対象にする</span></label>
      <div class="history-title">${fmtDate(plan.startAt)} ・ ${esc(plan.care || '水やり')}</div>
      <div class="plan-repeat">${esc(recurrenceText(plan.recurrence))}</div>
      <div class="history-note">${careDetailHtml(plan)}</div>
      <div class="history-actions">
        <button class="secondary" type="button" onclick="exportPlantCarePlan('${p.id}','${esc(String(plan.id))}')">カレンダー</button>
        <button class="secondary" type="button" onclick="duplicatePlan('${p.id}','${esc(String(plan.id))}')">複製</button>
        <button class="secondary" type="button" onclick="editPlan('${p.id}','${esc(String(plan.id))}')">編集</button>
        <button class="danger" type="button" onclick="removePlan('${p.id}','${esc(String(plan.id))}')">削除</button>
      </div>
    </div>`).join(''):'<div class="empty">予定はまだありません。</div>';
  if(!$('plansDialog').open) $('plansDialog').showModal();
  updatePlanBatchActions();
}
window.showPlans=showPlans;
$('closePlans').onclick=()=> $('plansDialog').close();
$('addPlan').onclick=()=>{
  const id=currentId;
  $('plansDialog').close();
  openCare(id,{mode:'plan'});
};
window.editPlan=(id,planId,returnTo='plans')=>{
  if($('plansDialog').open) $('plansDialog').close();
  openCare(id,{mode:'plan',planId,returnTo});
};
function updatePlanBatchActions(){
  const count=document.querySelectorAll('.plan-select-check:checked').length;
  $('plansBatchActions').hidden=count===0;
  $('selectedPlansCount').textContent=`${count}件を選択中`;
}
$('plansList').onchange=event=>{if(event.target.classList.contains('plan-select-check')) updatePlanBatchActions();};
window.duplicatePlan=(id,planId)=>{
  const p=data.plants.find(x=>String(x.id)===String(id));
  const source=p?.plans?.find(plan=>String(plan.id)===String(planId));
  if(!p || !source) return;
  const copy={...source,id:crypto.randomUUID(),startAt:Number(source.startAt)+86400000,details:{...(source.details || {})},recurrence:{...(source.recurrence || {unit:'none',interval:1})},createdAt:Date.now(),updatedAt:Date.now()};
  const previous=[...(p.plans || [])];
  p.plans.push(copy);
  p.plans.sort((a,b)=>Number(a.startAt)-Number(b.startAt));
  if(save()){
    showPlans(id);
    toast('予定を翌日へ複製しました');
    trackPlantCareEvent('care_plan_duplicated',{care_type:copy.care || '水やり'});
  }else p.plans=previous;
};
$('completeSelectedPlans').onclick=()=>{
  const selected=new Set([...document.querySelectorAll('.plan-select-check:checked')].map(input=>input.value));
  const p=data.plants.find(x=>String(x.id)===String(currentId));
  if(!p || !selected.size) return;
  const previousLogs=[...(p.logs || [])],previousPlans=[...(p.plans || [])];
  const targets=p.plans.filter(plan=>selected.has(String(plan.id)));
  targets.forEach(plan=>{const care=plan.care || '水やり';p.logs.push({time:Date.now(),care,type:plan.type || (care==='水やり'?'通常':care),fertilizer:plan.fertilizer || 'なし',details:{...(plan.details || {})},note:plan.note || '予定の一括完了から記録',photo:'',photoId:'',sourcePlanId:String(plan.id),sourcePlanDate:dateKey(new Date())});});
  p.logs.sort((a,b)=>Number(b.time)-Number(a.time));
  p.plans=p.plans.filter(plan=>!selected.has(String(plan.id)) || (plan.recurrence?.unit || 'none')!=='none');
  if(save()){
    showPlans(p.id);
    toast(`${targets.length}件の予定を完了しました`);
    trackPlantCareEvent('care_plans_batch_completed',{plan_count:targets.length});
  }else{p.logs=previousLogs;p.plans=previousPlans;render();}
};
$('postponeSelectedPlans').onclick=()=>{
  const selected=new Set([...document.querySelectorAll('.plan-select-check:checked')].map(input=>input.value));
  const p=data.plants.find(x=>String(x.id)===String(currentId));
  if(!p || !selected.size) return;
  const previous=(p.plans || []).map(plan=>({plan,startAt:plan.startAt,updatedAt:plan.updatedAt}));
  const targets=p.plans.filter(plan=>selected.has(String(plan.id)));
  targets.forEach(plan=>{plan.startAt=Number(plan.startAt)+86400000;plan.updatedAt=Date.now();});
  p.plans.sort((a,b)=>Number(a.startAt)-Number(b.startAt));
  if(save()){
    showPlans(p.id);
    toast(`${targets.length}件の予定を1日延期しました`);
    trackPlantCareEvent('care_plans_batch_postponed',{plan_count:targets.length});
  }else{previous.forEach(item=>{item.plan.startAt=item.startAt;item.plan.updatedAt=item.updatedAt;});render();}
};
window.removePlan=(id,planId,returnTo='plans')=>{
  if(!confirm('このケア予定を削除しますか？\n繰り返し予定の場合は、すべての予定が削除されます。')) return;
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p) return;
  const previousPlans=[...(p.plans || [])];
  p.plans=previousPlans.filter(plan=>String(plan.id)!==String(planId));
  if(save()){
    if(returnTo==='calendar') renderCalendar();
    else showPlans(id);
  }else{
    p.plans=previousPlans;
    render();
  }
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

function batchEditChangeEnabled(){
  return ['batchEditTagsEnabled','batchEditLocationEnabled','batchEditStageEnabled','batchEditStatusEnabled']
    .some(id=>$(id).checked);
}

function updateBatchEditControls(){
  const checks=[...document.querySelectorAll('.batch-edit-plant-check')];
  const selected=checks.filter(input=>input.checked).length;
  const hasChange=batchEditChangeEnabled();
  $('saveBatchEdit').disabled=!selected || !hasChange;
  $('saveBatchEdit').textContent=!selected
    ?'株を選択してください'
    :hasChange?`選択した${selected}株を更新`:'変更項目を選択してください';
  $('batchEditSelectAll').textContent=checks.length && selected===checks.length?'選択を解除':'すべて選択';
  $('batchEditTagsFields').hidden=!$('batchEditTagsEnabled').checked;
  $('batchEditLocation').hidden=!$('batchEditLocationEnabled').checked;
  $('batchEditStage').hidden=!$('batchEditStageEnabled').checked;
  $('batchEditStatus').hidden=!$('batchEditStatusEnabled').checked;
}

function openBatchEdit(preselectedIds=[]){
  closeDataMenu();
  if(!data.plants.length) return alert('編集できる植物がありません。');
  const selected=new Set(preselectedIds.map(String));
  $('batchEditPlantList').innerHTML=data.plants.map(plant=>`
    <label class="batch-plant-row">
      <input class="batch-edit-plant-check" type="checkbox" value="${esc(String(plant.id))}" ${selected.has(String(plant.id))?'checked':''}>
      <span>
        <span class="batch-plant-name">${esc(plant.name)}</span>
        <span class="batch-plant-meta">${esc(plant.stage || '成株')}${plant.location?` ・ ${esc(plant.location)}`:''}</span>
        ${plantTagsHtml(plant,{limit:6})}
      </span>
    </label>`).join('');
  ['batchEditTagsEnabled','batchEditLocationEnabled','batchEditStageEnabled','batchEditStatusEnabled']
    .forEach(id=>{ $(id).checked=false; });
  $('batchEditTagsAction').value='add';
  $('batchEditTags').value='';
  $('batchEditLocation').value='';
  $('batchEditStage').value='成株';
  $('batchEditStatus').value='active';
  updateBatchEditControls();
  $('batchEditDialog').showModal();
}

$('batchEditBtn').onclick=()=>openBatchEdit();
$('batchEditPlantList').onchange=updateBatchEditControls;
['batchEditTagsEnabled','batchEditLocationEnabled','batchEditStageEnabled','batchEditStatusEnabled']
  .forEach(id=>$(id).onchange=updateBatchEditControls);
$('batchEditSelectAll').onclick=()=>{
  const checks=[...document.querySelectorAll('.batch-edit-plant-check')];
  const shouldSelect=!checks.every(input=>input.checked);
  checks.forEach(input=>{ input.checked=shouldSelect; });
  updateBatchEditControls();
};
$('cancelBatchEdit').onclick=()=> $('batchEditDialog').close();
$('saveBatchEdit').onclick=()=>{
  const ids=new Set([...document.querySelectorAll('.batch-edit-plant-check:checked')].map(input=>input.value));
  const targets=data.plants.filter(plant=>ids.has(String(plant.id)));
  if(!targets.length) return;
  if(!batchEditChangeEnabled()) return alert('変更する項目を選択してください。');

  const tagsEnabled=$('batchEditTagsEnabled').checked;
  const tagsAction=$('batchEditTagsAction').value;
  const tags=parsePlantTags($('batchEditTags').value);
  if(tagsEnabled && tagsAction!=='replace' && !tags.length) return alert('追加または削除するタグを入力してください。');

  const previous=targets.map(plant=>({
    plant,
    tags:normalizePlantTags(plant.tags),
    location:plant.location || '',
    stage:plant.stage || '成株',
    managementStatus:plantManagementStatus(plant),
    updatedAt:plant.updatedAt
  }));
  const now=Date.now();
  targets.forEach(plant=>{
    if(tagsEnabled){
      const current=normalizePlantTags(plant.tags);
      if(tagsAction==='add') plant.tags=normalizePlantTags([...current,...tags]);
      else if(tagsAction==='remove') plant.tags=current.filter(tag=>!tags.includes(tag));
      else plant.tags=tags;
    }
    if($('batchEditLocationEnabled').checked) plant.location=$('batchEditLocation').value.trim();
    if($('batchEditStageEnabled').checked) plant.stage=$('batchEditStage').value;
    if($('batchEditStatusEnabled').checked) plant.managementStatus=$('batchEditStatus').value;
    plant.updatedAt=now;
  });

  if(save()){
    $('batchEditDialog').close();
    toast(`${targets.length}株をまとめて更新しました`);
    trackPlantCareEvent('plants_batch_updated',{plant_count:targets.length});
  }else{
    previous.forEach(item=>Object.assign(item.plant,{
      tags:item.tags,
      location:item.location,
      stage:item.stage,
      managementStatus:item.managementStatus,
      updatedAt:item.updatedAt
    }));
    render();
  }
};

function updateBatchCareControls(){
  const checks=[...document.querySelectorAll('.batch-care-plant-check')];
  const selected=checks.filter(input=>input.checked).length;
  $('continueBatchCare').disabled=selected===0;
  $('continueBatchCare').textContent=selected?`選択した${selected}株のケアを入力`:'株を選択してください';
  $('batchCareSelectAll').textContent=checks.length && selected===checks.length?'選択を解除':'すべて選択';
}

function openBatchCareRecording(preselectedIds=[],preset=null){
  closeDataMenu();
  batchCarePreset=preset;
  const availablePlants=data.plants.filter(plant=>plantManagementStatus(plant)!=='ended');
  if(!availablePlants.length){
    alert('ケアを記録できる植物がありません。管理終了の状態をご確認ください。');
    return;
  }
  const selected=new Set(preselectedIds.map(String));
  $('batchCarePlantList').innerHTML=availablePlants.map(plant=>`
    <label class="batch-plant-row">
      <input class="batch-care-plant-check" type="checkbox" value="${esc(String(plant.id))}" ${selected.has(String(plant.id))?'checked':''}>
      <span>
        <span class="batch-plant-name">${esc(plant.name)}</span>
        <span class="batch-plant-meta">${esc(plant.stage || '成株')}${plant.type?` ・ ${esc(plant.type)}`:''}</span>
      </span>
    </label>`).join('');
  updateBatchCareControls();
  $('batchCareDialog').showModal();
}

$('batchCarePlantList').onchange=updateBatchCareControls;
$('batchCareSelectAll').onclick=()=>{
  const checks=[...document.querySelectorAll('.batch-care-plant-check')];
  const shouldSelect=!checks.every(input=>input.checked);
  checks.forEach(input=>{ input.checked=shouldSelect; });
  updateBatchCareControls();
};
$('cancelBatchCare').onclick=()=>{batchCarePreset=null;$('batchCareDialog').close();};
$('continueBatchCare').onclick=()=>{
  const ids=[...document.querySelectorAll('.batch-care-plant-check:checked')].map(input=>input.value);
  if(!ids.length) return;
  $('batchCareDialog').close();
  const preset=batchCarePreset;
  batchCarePreset=null;
  openCare(ids[0],{mode:'batch-record',plantIds:ids,preset});
};

function updateBatchPlanControls(){
  const checks=[...document.querySelectorAll('.batch-plan-plant-check')];
  const selected=checks.filter(input=>input.checked).length;
  $('continueBatchPlan').disabled=selected===0;
  $('continueBatchPlan').textContent=selected?`選択した${selected}株の予定を入力`:'株を選択してください';
  $('batchPlanSelectAll').textContent=checks.length && selected===checks.length?'選択を解除':'すべて選択';
}

function openBatchPlanning(preselectedIds=[]){
  closeDataMenu();
  const availablePlants=data.plants.filter(plant=>plantManagementStatus(plant)!=='ended');
  if(!availablePlants.length){
    alert('予定を登録できる植物がありません。管理終了の状態をご確認ください。');
    return;
  }
  const selected=new Set(preselectedIds.map(String));
  $('batchPlanPlantList').innerHTML=availablePlants.map(plant=>`
    <label class="batch-plant-row">
      <input class="batch-plan-plant-check" type="checkbox" value="${esc(String(plant.id))}" ${selected.has(String(plant.id))?'checked':''}>
      <span>
        <span class="batch-plant-name">${esc(plant.name)}</span>
        <span class="batch-plant-meta">${esc(plant.stage || '成株')}${plant.type?` ・ ${esc(plant.type)}`:''}</span>
      </span>
    </label>`).join('');
  updateBatchPlanControls();
  $('batchPlanDialog').showModal();
}

$('batchPlanPlantList').onchange=updateBatchPlanControls;
$('batchPlanSelectAll').onclick=()=>{
  const checks=[...document.querySelectorAll('.batch-plan-plant-check')];
  const shouldSelect=!checks.every(input=>input.checked);
  checks.forEach(input=>{ input.checked=shouldSelect; });
  updateBatchPlanControls();
};
$('cancelBatchPlan').onclick=()=> $('batchPlanDialog').close();
$('continueBatchPlan').onclick=()=>{
  const ids=[...document.querySelectorAll('.batch-plan-plant-check:checked')].map(input=>input.value);
  if(!ids.length) return;
  $('batchPlanDialog').close();
  openCare(ids[0],{mode:'batch-plan',plantIds:ids});
};

function updateBatchWaterControls(){
  const checks=[...document.querySelectorAll('.batch-plant-check')];
  const selected=checks.filter(input=>input.checked).length;
  $('saveBatchWater').disabled=selected===0;
  $('saveBatchWater').textContent=selected?`選択した${selected}株に記録`:'株を選択してください';
  $('batchSelectAll').textContent=checks.length && selected===checks.length?'選択を解除':'すべて選択';
}

let batchWaterContext=null;

function openBatchWatering(context=null,preselectedIds=[]){
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
  const selected=new Set(preselectedIds.map(String));
  $('batchPlantList').innerHTML=availablePlants.map(p=>`
    <label class="batch-plant-row">
      <input class="batch-plant-check" type="checkbox" value="${esc(String(p.id))}" ${selected.has(String(p.id)) || (batchWaterContext && (p.rainExposure || 'rain')==='rain')?'checked':''}>
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
window.editLog=(id,index,returnTo='history')=>{
  if($('historyDialog').open) $('historyDialog').close();
  openCare(id,{logIndex:index,returnTo});
};

window.removeLog=async(id,index,returnTo='history')=>{
  if(!confirm('このケア記録を削除しますか？')) return;
  const p=data.plants.find(x=>String(x.id)===String(id));
  if(!p || !p.logs?.[index]) return;
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
  if(returnTo==='calendar') renderCalendar();
  else showHistory(id);
};

function openMoreMenu(){
  if($('dataMenu').open) return;
  $('dataMenu').showModal();
  $('menuBtn').setAttribute('aria-expanded','true');
  $('navMoreBtn').setAttribute('aria-pressed','true');
  $('navMoreBtn').classList.add('active');
}

$('menuBtn').onclick=openMoreMenu;
$('closeMoreMenu').onclick=closeDataMenu;
$('dataMenu').onclick=event=>{
  if(event.target===$('dataMenu')) closeDataMenu();
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

function openThemeSettings(){
  closeDataMenu();
  $('themeMode').value=savedThemeMode();
  $('themeDialog').showModal();
}
$('themeSettingsBtn').onclick=openThemeSettings;
$('cancelTheme').onclick=()=> $('themeDialog').close();
$('saveTheme').onclick=()=>{
  const mode=$('themeMode').value;
  applyTheme(mode,{persist:true});
  $('themeDialog').close();
  trackPlantCareEvent('theme_changed',{mode});
  toast(`表示テーマを「${THEME_LABELS[mode]}」にしました`);
};

function openAnalyticsSettings(){
  closeDataMenu();
  if($('helpDialog').open) $('helpDialog').close();
  $('analyticsEnabled').checked=window.plantCareAnalyticsEnabled;
  $('analyticsDialog').showModal();
}
$('helpAnalyticsSettingsBtn').onclick=openAnalyticsSettings;
$('analyticsSettingsBtn').onclick=openAnalyticsSettings;
$('cancelAnalytics').onclick=()=> $('analyticsDialog').close();
$('saveAnalytics').onclick=()=>{
  const enabled=$('analyticsEnabled').checked;
  window.setPlantCareAnalytics(enabled);
  $('analyticsDialog').close();
  toast(enabled?'匿名のアクセス解析を有効にしました':'アクセス解析を停止しました');
};

function closeDataMenu(){
  if($('dataMenu').open) $('dataMenu').close();
  $('menuBtn').setAttribute('aria-expanded','false');
  $('navMoreBtn').setAttribute('aria-pressed','false');
  $('navMoreBtn').classList.remove('active');
}

$('dataMenu').addEventListener('close',closeDataMenu);
$('openDataManagementBtn').onclick=()=>{
  closeDataMenu();
  renderBackupStatus();
  updatePhotoStorageStatus();
  $('dataManagementDialog').showModal();
  trackPlantCareEvent('data_management_viewed');
};
$('closeDataManagement').onclick=()=> $('dataManagementDialog').close();
$('dataManagementDialog').onclick=event=>{
  if(event.target===$('dataManagementDialog')) $('dataManagementDialog').close();
};
$('backToMoreMenu').onclick=()=>{
  $('dataManagementDialog').close();
  openMoreMenu();
};

let recentMenuCarePresets=[];
function renderRecentCareMenu(){
  recentMenuCarePresets=recentCarePresets();
  $('recentCareSection').hidden=!recentMenuCarePresets.length;
  $('recentCareActions').innerHTML=recentMenuCarePresets.map((preset,index)=>`<button class="secondary" type="button" onclick="openRecentCare(${index})"><span aria-hidden="true">${timelineIcon(preset.care)}</span><span><strong>${esc(preset.label)}</strong><small>内容を再利用</small></span></button>`).join('');
}
window.openRecentCare=index=>{
  const preset=recentMenuCarePresets[index];
  if(!preset) return;
  $('recordMenuDialog').close();
  openBatchCareRecording([],preset);
};
$('navRecordBtn').onclick=()=>{
  renderRecentCareMenu();
  $('recordMenuDialog').showModal();
  trackPlantCareEvent('record_menu_opened');
};
$('closeRecordMenu').onclick=()=> $('recordMenuDialog').close();
$('recordMenuWater').onclick=()=>{
  $('recordMenuDialog').close();
  openBatchWatering();
};
$('recordMenuCare').onclick=()=>{
  $('recordMenuDialog').close();
  openBatchCareRecording();
};
$('recordMenuPlan').onclick=()=>{
  $('recordMenuDialog').close();
  openBatchPlanning();
};
$('recordMenuReminder').onclick=()=>{
  $('recordMenuDialog').close();
  openReminders();
};

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
