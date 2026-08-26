(async()=>{
  initializeTheme();
  await initializePhotoStorage();
  autoRecordFromUrl();
  render();
  renderBackupStatus();
  initializeReleaseNotes();
  updatePhotoStorageStatus();
  notifyBackupDue();
  refreshStoredMunicipality();
  refreshWeather();
})();
