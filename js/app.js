(async()=>{
  initializeTheme();
  await initializePhotoStorage();
  autoRecordFromUrl();
  render();
  setView(savedAppView(),{persist:false});
  renderBackupStatus();
  initializeReleaseNotes();
  updatePhotoStorageStatus();
  notifyBackupDue();
  refreshStoredMunicipality();
  refreshWeather();
})();
