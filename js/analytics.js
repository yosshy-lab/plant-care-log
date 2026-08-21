(function(){
  const measurementIds=Object.freeze({
    'yosshy-lab.github.io':'G-1V4R4PFM9Y',
    'hibikorekaikon.github.io':'G-4Y25TEVD60'
  });
  const measurementId=measurementIds[location.hostname] || '';
  const analyticsAvailable=Boolean(measurementId);
  const settingKey='plant-care-analytics-enabled-v1';

  function readEnabled(){
    try{ return localStorage.getItem(settingKey)!=='false'; }
    catch(e){ return true; }
  }

  window.plantCareAnalyticsEnabled=analyticsAvailable && readEnabled();
  window.dataLayer=window.dataLayer || [];
  window.gtag=function(){ window.dataLayer.push(arguments); };

  function loadAnalytics(){
    if(document.querySelector('script[data-plant-care-analytics]')) return;
    window.gtag('consent','default',{
      analytics_storage:'granted',
      ad_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied'
    });
    const script=document.createElement('script');
    script.async=true;
    script.dataset.plantCareAnalytics='';
    script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(measurementId);
    document.head.appendChild(script);
    window.gtag('js',new Date());
    window.gtag('config',measurementId,{
      allow_google_signals:false,
      allow_ad_personalization_signals:false
    });
  }

  window.setPlantCareAnalytics=function(enabled){
    const effectiveEnabled=analyticsAvailable && Boolean(enabled);
    window.plantCareAnalyticsEnabled=effectiveEnabled;
    try{ localStorage.setItem(settingKey,enabled?'true':'false'); }catch(e){}
    window.gtag('consent','update',{
      analytics_storage:effectiveEnabled?'granted':'denied',
      ad_storage:'denied',
      ad_user_data:'denied',
      ad_personalization:'denied'
    });
    if(effectiveEnabled) loadAnalytics();
  };

  window.trackPlantCareEvent=function(name,params){
    if(!window.plantCareAnalyticsEnabled) return;
    window.gtag('event',name,params || {});
  };

  if(window.plantCareAnalyticsEnabled) loadAnalytics();
})();
