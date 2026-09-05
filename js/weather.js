function loadWeather(){
  const defaults={latitude:null,longitude:null,accuracy:null,cityName:'',municipalityCode:'',cityLookupAttemptedAt:0,displayThreshold:1,equivalentThreshold:10,days:{},maxTemps:{},minTemps:{},lastUpdated:0};
  try{
    const saved=JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null');
    if(!saved || typeof saved!=='object') return defaults;
    return {...defaults,...saved,days:saved.days && typeof saved.days==='object'?saved.days:{},maxTemps:saved.maxTemps && typeof saved.maxTemps==='object'?saved.maxTemps:{},minTemps:saved.minTemps && typeof saved.minTemps==='object'?saved.minTemps:{}};
  }catch(e){ return defaults; }
}

let weather=loadWeather();
function saveWeatherLocal(){ localStorage.setItem(WEATHER_KEY,JSON.stringify(weather)); }
function hasWeatherLocation(settings){
  return typeof settings.latitude==='number' && Number.isFinite(settings.latitude) && Math.abs(settings.latitude)<=90 &&
    typeof settings.longitude==='number' && Number.isFinite(settings.longitude) && Math.abs(settings.longitude)<=180;
}

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
    daily:'precipitation_sum,temperature_2m_max,temperature_2m_min',timezone:'auto',past_days:'92',forecast_days:'16'
  });
  try{
    const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if(!response.ok) throw new Error(`weather ${response.status}`);
    const json=await response.json();
    const times=json.daily?.time;
    const amounts=json.daily?.precipitation_sum,maxValues=json.daily?.temperature_2m_max,minValues=json.daily?.temperature_2m_min;
    if(!Array.isArray(times) || !Array.isArray(amounts) || !Array.isArray(maxValues) || !Array.isArray(minValues)) throw new Error('invalid weather data');
    const days={},maxTemps={},minTemps={};
    times.forEach((date,index)=>{
      const amount=Number(amounts[index]),max=Number(maxValues[index]),min=Number(minValues[index]);
      if(/^\d{4}-\d{2}-\d{2}$/.test(date) && amounts[index]!==null && Number.isFinite(amount)) days[date]=amount;
      if(/^\d{4}-\d{2}-\d{2}$/.test(date) && maxValues[index]!==null && Number.isFinite(max)) maxTemps[date]=max;
      if(/^\d{4}-\d{2}-\d{2}$/.test(date) && minValues[index]!==null && Number.isFinite(min)) minTemps[date]=min;
    });
    weather={...weather,days,maxTemps,minTemps,lastUpdated:Date.now()};
    saveWeatherLocal();
    if(typeof renderToday==='function') renderToday();
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
