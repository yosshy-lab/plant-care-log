import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const storageKey = 'plant-care-log-v1';

async function seed(page, plants = [], reminders = []) {
  await page.addInitScript(({ key, plants: seededPlants, reminders: seededReminders }) => {
    if (!sessionStorage.getItem('playwright-data-seeded')) {
      localStorage.setItem(key, JSON.stringify({ plants: seededPlants, reminders: seededReminders }));
      localStorage.setItem('plant-care-analytics-enabled-v1', 'false');
      sessionStorage.setItem('playwright-data-seeded', 'true');
    }
  }, { key: storageKey, plants, reminders });
}

const plants = [
  { id: 'a', name: 'グラキリス', type: 'Pachypodium gracilius', stage: '実生', managementStatus: 'active', location: '屋外棚', logs: [] },
  { id: 'b', name: '恵比寿大黒', type: 'Pachypodium densicaule', stage: '成株', managementStatus: 'dormant', location: '室内', logs: [] },
  { id: 'c', name: '管理終了株', type: 'テスト株', stage: '播種', managementStatus: 'ended', location: '温室', logs: [] }
];

test('主要画面がJavaScriptエラーなく表示される', async ({ page }) => {
  await seed(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('塊根植物記録');
  await expect(page.locator('#appVersionDisplay')).toHaveText('v1.8.0');
  await expect(page.locator('#addBtn')).toBeVisible();
  await expect(page.locator('#plantSearch')).toBeVisible();
  await expect(page.locator('#calendarViewBtn')).toBeVisible();
  expect(errors).toEqual([]);
});

test('更新案内は新バージョンの初回だけ表示しメニューから再確認できる', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await expect(page.locator('#releaseNotice')).toBeVisible();
  await expect(page.locator('#releaseNotice')).toContainText('v1.8.0 更新');
  await expect(page.locator('#releaseNotice')).toContainText('備忘録・まとめて予定を追加');

  await page.locator('#releaseNoticeDetails').click();
  await expect(page.locator('#releaseNotesDialog')).toBeVisible();
  await expect(page.locator('#releaseNotesList')).toContainText('v1.8.0');
  await expect(page.locator('#releaseNotesList')).not.toContainText('v1.7.0');
  await expect(page.locator('#releaseNotesHint')).toContainText('今回のアップデート内容');
  await page.locator('#closeReleaseNotes').click();

  await page.reload();
  await expect(page.locator('#releaseNotice')).toBeHidden();

  await page.locator('#menuBtn').click();
  await page.locator('#releaseNotesBtn').click();
  await expect(page.locator('#releaseNotesDialog')).toBeVisible();
  await expect(page.locator('#releaseNotesList')).toContainText('v1.8.0');
  await expect(page.locator('#releaseNotesList')).toContainText('v1.7.0');
  await expect(page.locator('#releaseNotesList')).toContainText('隔週・隔月');
  await expect(page.locator('#releaseNotesList')).toContainText('v1.0.0');
});

test('植物を登録し、保存後も表示できる', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#addBtn').click();
  await page.locator('#plantName').fill('テスト実生');
  await page.locator('#plantType').fill('Pachypodium test');
  await page.locator('#plantStage').selectOption({ label: '実生' });
  await page.locator('#plantManagementStatus').selectOption('dormant');
  await page.locator('#savePlant').click();

  const card = page.locator('.plant-card', { hasText: 'テスト実生' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('休眠中');
  await page.reload();
  await expect(page.locator('.plant-card', { hasText: 'テスト実生' })).toBeVisible();
});

test('株登録写真をIndexedDBへ保存しLocalStorageには画像本体を残さない', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#addBtn').click();
  await page.locator('#plantName').fill('写真テスト株');
  await page.locator('#cultivationSection > summary').click();
  await page.locator('#plantPhoto').setInputFiles('apple-touch-icon.png');
  await expect(page.locator('#plantPhotoPreview')).toBeVisible();
  await page.locator('#savePlant').click();
  await expect(page.locator('#plantDialog')).toBeHidden();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].photo).toBe('');
  expect(saved.plants[0].photoId).toBeTruthy();
  const photo = await page.evaluate(async id => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('plant-care-log-media-v1', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise((resolve, reject) => {
      const request = db.transaction('photos', 'readonly').objectStore('photos').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, saved.plants[0].photoId);
  expect(photo.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  expect(photo.byteSize).toBeGreaterThan(0);

  await page.reload();
  await page.locator('.plant-card').click();
  await expect(page.locator('.detail-photo')).toBeVisible();
});

test('LocalStorage内の既存写真を初回起動時にIndexedDBへ自動移行する', async ({ page }) => {
  const legacyPhoto = 'data:image/jpeg;base64,AA==';
  await seed(page, [{
    ...plants[0],
    photo: legacyPhoto,
    logs: [{ time: Date.now() - 1000, care: '状態・写真記録', photo: legacyPhoto }]
  }]);
  await page.goto('/');
  await expect(page.locator('.plant-card')).toBeVisible();

  const result = await page.evaluate(async key => {
    const saved = JSON.parse(localStorage.getItem(key));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('plant-care-log-media-v1', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction('photos', 'readonly').objectStore('photos').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return { saved, records };
  }, storageKey);

  expect(result.saved.plants[0].photo).toBe('');
  expect(result.saved.plants[0].logs[0].photo).toBe('');
  expect(result.saved.plants[0].photoId).toBeTruthy();
  expect(result.saved.plants[0].logs[0].photoId).toBeTruthy();
  expect(result.records).toHaveLength(2);

  await page.locator('#menuBtn').click();
  await expect(page.locator('#photoStorageStatus')).toContainText('写真 2枚');
});

test('状態・写真記録の写真もIndexedDBへ保存する', async ({ page }) => {
  await seed(page, [{ ...plants[0], logs: [] }]);
  await page.goto('/');
  await page.locator('.care').click();
  await page.locator('#careType').selectOption({ label: '状態・写真記録' });
  await page.locator('#carePhoto').setInputFiles('apple-touch-icon.png');
  await page.locator('#waterNote').fill('発葉を確認');
  await page.locator('#saveCare').click();
  await expect(page.locator('#careDialog')).toBeHidden();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs[0].photo).toBe('');
  expect(saved.plants[0].logs[0].photoId).toBeTruthy();
  const stored = await page.evaluate(async id => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('plant-care-log-media-v1', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise((resolve, reject) => {
      const request = db.transaction('photos', 'readonly').objectStore('photos').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, saved.plants[0].logs[0].photoId);
  expect(stored.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
});

test('検索・生育区分・管理状態で絞り込める', async ({ page }) => {
  await seed(page, plants);
  await page.goto('/');
  await expect(page.locator('.plant-card')).toHaveCount(2);
  await expect(page.locator('#filterResultCount')).toHaveText('2株を表示／登録 3株');

  await page.locator('#plantSearch').fill('グラキリス');
  await expect(page.locator('.plant-card')).toHaveCount(1);
  await expect(page.locator('.plant-card')).toContainText('グラキリス');

  await page.locator('#plantSearch').clear();
  await page.locator('#plantStatusFilter').selectOption('ended');
  await expect(page.locator('.plant-card')).toHaveCount(1);
  await expect(page.locator('.plant-card')).toContainText('管理終了した株です');

  await page.locator('#plantStatusFilter').selectOption('all');
  await page.locator('#plantStageFilter').selectOption({ label: '播種' });
  await expect(page.locator('.plant-card')).toHaveCount(1);
  await expect(page.locator('.plant-card')).toContainText('管理終了株');
});

test('株の並び順を変更して保持できる', async ({ page }) => {
  await seed(page, plants.map(plant => ({ ...plant, managementStatus: 'active' })));
  await page.goto('/');
  await page.locator('#menuBtn').click();
  await page.locator('#reorderPlantsBtn').click();
  await page.getByRole('button', { name: '恵比寿大黒を上へ' }).click();
  await page.locator('#saveReorderPlants').click();

  await expect(page.locator('.plant-card .name')).toHaveText(['恵比寿大黒', 'グラキリス', '管理終了株']);
  await page.reload();
  await expect(page.locator('.plant-card .name')).toHaveText(['恵比寿大黒', 'グラキリス', '管理終了株']);
});

test('カレンダーは日曜・土曜を区別して表示する', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#calendarViewBtn').click();
  await expect(page.locator('.calendar-day')).toHaveCount(42);
  await expect(page.locator('.calendar-day.sunday')).toHaveCount(6);
  await expect(page.locator('.calendar-day.saturday')).toHaveCount(6);
  await expect(page.locator('.calendar-day.sunday').first()).toHaveCSS('background-color', 'rgb(255, 247, 247)');
  await expect(page.locator('.calendar-day.saturday').first()).toHaveCSS('background-color', 'rgb(245, 249, 255)');
});


test('一覧の水やりは1件だけ記録し、連打時の重複を防ぐ', async ({ page }) => {
  await seed(page, [plants[0]]);
  await page.goto('/');
  await page.locator('.quick-water').click();
  await expect(page.locator('#toast')).toContainText('水やりを記録しました');

  await page.locator('.quick-water').click();
  await expect(page.locator('#toast')).toContainText('重複を防止しました');

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs).toHaveLength(1);
  expect(saved.plants[0].logs[0]).toMatchObject({
    care: '水やり',
    type: '通常',
    fertilizer: 'なし'
  });
});

test('株情報を編集して管理終了へ変更できる', async ({ page }) => {
  await seed(page, [plants[0]]);
  await page.goto('/');
  await page.locator('.plant-card').click();
  await page.locator('#editPlantDetails').click();
  await page.locator('#plantName').fill('編集後グラキリス');
  await page.locator('#plantManagementStatus').selectOption('ended');
  await page.locator('#savePlant').click();

  await expect(page.locator('.plant-card')).toHaveCount(0);
  await page.locator('#plantStatusFilter').selectOption('ended');
  const card = page.locator('.plant-card');
  await expect(card).toContainText('編集後グラキリス');
  await expect(card).toContainText('管理終了した株です');

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].managementStatus).toBe('ended');
  expect(saved.plants[0].name).toBe('編集後グラキリス');
});

test('管理終了した株はショートカットURLからも水やりできない', async ({ page }) => {
  await seed(page, [plants[2]]);
  await page.goto('/?water=c');
  await expect(page.locator('#toast')).toContainText('管理終了した株には記録できません');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs).toHaveLength(0);
});

test('バックアップに件数とバージョン情報を含めて保存する', async ({ page }) => {
  const withLogs = plants.map((plant, index) => ({
    ...plant,
    photo: index === 0 ? 'data:image/jpeg;base64,AA==' : '',
    logs: index === 0 ? [{ time: Date.now() - 60_000, care: '水やり', photo: '' }] : []
  }));
  const reminder = {
    id: 'backup-reminder',
    title: '液肥',
    startAt: new Date('2099-01-01T09:00').getTime(),
    memo: '2000倍',
    recurrence: { unit: 'week', interval: 2 }
  };
  await seed(page, withLogs, [reminder]);
  await page.goto('/');
  await page.locator('#menuBtn').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^plant-care-log-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const payload = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(payload).toMatchObject({
    format: 'plant-care-log-backup',
    schemaVersion: 1,
    appVersion: '1.8.0'
  });
  expect(payload.plants).toHaveLength(3);
  expect(payload.reminders).toEqual([reminder]);
  expect(payload.plants[0].photo).toBe('data:image/jpeg;base64,AA==');

  await page.locator('#menuBtn').click();
  await expect(page.locator('#backupStatus')).toContainText('最終保存');
  await expect(page.locator('#backupStatus')).toContainText('3株・履歴1件・予定1件・写真1枚');
});

test('復元前に自動退避し、復元を取り消せる', async ({ page }) => {
  await seed(page, [plants[0]]);
  await page.goto('/');
  const incoming = {
    format: 'plant-care-log-backup',
    schemaVersion: 1,
    appVersion: '1.5.1',
    exportedAt: Date.now(),
    plants: [{ ...plants[1], managementStatus: 'active' }]
  };

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#importFile').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(incoming))
  });
  await expect(page.locator('.plant-card')).toContainText('恵比寿大黒');

  const restorePoint = await page.evaluate(() => localStorage.getItem('plant-care-pre-restore-v1'));
  expect(restorePoint).toBeTruthy();

  await page.locator('#menuBtn').click();
  await expect(page.locator('#restorePreImportBtn')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#restorePreImportBtn').click();
  await expect(page.locator('.plant-card')).toContainText('グラキリス');
});


test('不正なバックアップを拒否して現在データを保持する', async ({ page }) => {
  await seed(page, [plants[0]]);
  await page.goto('/');
  const dialogPromise = new Promise(resolve => {
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('検証できませんでした');
      await dialog.dismiss();
      resolve();
    });
  });
  await page.locator('#importFile').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ plants: [{ id: 'broken', logs: 'invalid' }] }))
  });
  await dialogPromise;
  await expect(page.locator('.plant-card')).toContainText('グラキリス');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants).toHaveLength(1);
});

test('未バックアップ期間が7日を超えるとメニュー内で通知する', async ({ page }) => {
  await seed(page, [plants[0]]);
  await page.addInitScript(() => {
    localStorage.setItem('plant-care-backup-meta-v1', JSON.stringify({
      firstDataSeenAt: Date.now() - 8 * 24 * 60 * 60 * 1000
    }));
  });
  await page.goto('/');
  await expect(page.locator('#menuBtn')).toHaveAttribute('aria-label', 'メニュー（バックアップをおすすめします）');
  await page.locator('#menuBtn').click();
  await expect(page.locator('#backupStatus')).toHaveClass(/due/);
  await expect(page.locator('#backupStatus')).toContainText('未バックアップ');
});


test('過去日時を指定してケアを記録しカレンダーへ反映する', async ({ page }) => {
  await seed(page, [{ ...plants[0], logs: [] }]);
  await page.goto('/');
  await page.locator('.care').click();
  await expect(page.locator('#careRecordedAt')).toHaveValue(/T/);
  await page.locator('#careRecordedAt').fill('2026-08-20T08:30');
  await page.locator('#waterAmount').fill('150ml');
  await page.locator('#waterNote').fill('昨日分を追記');
  await page.locator('#saveCare').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs[0].time).toBe(new Date('2026-08-20T08:30').getTime());
  expect(saved.plants[0].logs[0].note).toBe('昨日分を追記');

  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2026-08-20'));
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・水やり');
  await expect(page.locator('#calendarDayDetails')).toContainText('150ml');
});

test('未来日時のケア記録を拒否する', async ({ page }) => {
  await seed(page, [{ ...plants[0], logs: [] }]);
  await page.goto('/');
  await page.locator('.care').click();
  await page.locator('#careRecordedAt').fill('2099-01-01T00:00');
  const alertPromise = new Promise(resolve => {
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('未来の日時');
      await dialog.dismiss();
      resolve();
    });
  });
  await page.locator('#saveCare').click();
  await alertPromise;
  await expect(page.locator('#careDialog')).toBeVisible();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs).toHaveLength(0);
});

test('既存のケア履歴を日時と内容ごと編集する', async ({ page }) => {
  const log = {
    time: new Date('2026-08-19T08:00').getTime(),
    care: '水やり',
    type: '通常',
    fertilizer: 'なし',
    details: { waterAmount: '100ml' },
    note: '旧メモ'
  };
  await seed(page, [{ ...plants[0], logs: [log] }]);
  await page.goto('/');
  await page.evaluate(() => window.showHistory('a'));
  await page.locator('.history-actions .secondary').click();
  await expect(page.locator('#saveCare')).toHaveText('変更を保存');
  await page.locator('#careRecordedAt').fill('2026-08-18T07:15');
  await page.locator('#waterAmount').fill('200ml');
  await page.locator('#waterNote').fill('修正メモ');
  await page.locator('#saveCare').click();

  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyList')).toContainText('修正メモ');
  await expect(page.locator('#historyList')).toContainText('200ml');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs).toHaveLength(1);
  expect(saved.plants[0].logs[0].time).toBe(new Date('2026-08-18T07:15').getTime());
});

test('まとめて水やりを過去日時で複数株へ記録する', async ({ page }) => {
  await seed(page, plants.slice(0, 2).map(plant => ({ ...plant, managementStatus: 'active', logs: [] })));
  await page.goto('/');
  await page.locator('#topBatchWaterBtn').click();
  await page.locator('#batchSelectAll').click();
  await page.locator('#batchWaterTime').fill('2026-08-20T09:45');
  await page.locator('#saveBatchWater').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  const expected = new Date('2026-08-20T09:45').getTime();
  expect(saved.plants.map(plant => plant.logs[0].time)).toEqual([expected, expected]);
});

test('カレンダーで選択した過去日にケアを追加する', async ({ page }) => {
  await seed(page, [{ ...plants[0], logs: [] }]);
  await page.goto('/');
  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2026-08-20'));
  await page.locator('#addCareForDateBtn').click();
  await expect(page.locator('#careRecordedAt')).toHaveValue(/^2026-08-20T/);
  await page.locator('#saveCare').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  const recorded = new Date(saved.plants[0].logs[0].time);
  expect(recorded.getFullYear()).toBe(2026);
  expect(recorded.getMonth()).toBe(7);
  expect(recorded.getDate()).toBe(20);
});

test('当日の降水予報を注意表示付きで水やりとして記録する', async ({ page }) => {
  await seed(page, [{ ...plants[0], rainExposure: 'rain', logs: [] }]);
  await page.addInitScript(() => {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    localStorage.setItem('plant-care-weather-v1', JSON.stringify({
      latitude: null,
      longitude: null,
      cityName: '藤沢市',
      displayThreshold: 1,
      equivalentThreshold: 10,
      days: { [today]: 12.4 },
      lastUpdated: Date.now()
    }));
  });
  await page.goto('/');
  await page.locator('#calendarViewBtn').click();
  await expect(page.locator('#calendarDayDetails')).toContainText('降水予報 12.4mm（藤沢市）');
  await expect(page.locator('#calendarDayDetails')).toContainText('予報が含まれる可能性');
  await page.getByRole('button', { name: '現在までの雨を水やり扱いにする' }).click();
  await expect(page.locator('#batchWaterHint')).toContainText('実際に雨が当たった株だけ');
  await page.locator('#saveBatchWater').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs).toHaveLength(1);
  expect(saved.plants[0].logs[0].note).toContain('当日降水 12.4mm');
  expect(saved.plants[0].logs[0].note).toContain('予報を含む可能性あり');
});

test('未来の単発ケア予定を登録してカレンダーに表示する', async ({ page }) => {
  await seed(page, [{ ...plants[0], plans: [], logs: [] }]);
  await page.goto('/');
  await page.locator('.plant-card').click();
  await page.locator('#plansPlantDetails').click();
  await page.locator('#addPlan').click();
  await expect(page.locator('#careTitle')).toContainText('ケア予定');
  await page.locator('#careType').selectOption({ label: '施肥' });
  await page.locator('#careRecordedAt').fill('2099-01-15T09:00');
  await page.locator('#fertilizerName').fill('ハイポネックス');
  await page.locator('#saveCare').click();

  await expect(page.locator('#plansDialog')).toBeVisible();
  await expect(page.locator('#plansList')).toContainText('1回のみ');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].plans).toHaveLength(1);
  expect(saved.plants[0].plans[0]).toMatchObject({
    care: '施肥',
    recurrence: { unit: 'none', interval: 1 }
  });

  await page.locator('#closePlans').click();
  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-01-15'));
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・施肥予定');
  await expect(page.locator('#calendarDayDetails')).toContainText('ハイポネックス');
});

test('隔週の予定を該当日だけカレンダーに表示する', async ({ page }) => {
  const plan = {
    id: 'biweekly',
    startAt: new Date('2099-01-01T09:00').getTime(),
    care: '水やり',
    type: '通常',
    fertilizer: 'なし',
    details: {},
    note: '',
    recurrence: { unit: 'week', interval: 2 }
  };
  await seed(page, [{ ...plants[0], plans: [plan], logs: [] }]);
  await page.goto('/');
  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-01-15'));
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・水やり予定');
  await expect(page.locator('#calendarDayDetails')).toContainText('隔週');

  await page.evaluate(() => window.selectCalendarDate('2099-01-08'));
  await expect(page.locator('#calendarDayDetails')).not.toContainText('グラキリス・水やり予定');
});

test('隔月の予定を該当月だけカレンダーに表示する', async ({ page }) => {
  const plan = {
    id: 'bimonthly',
    startAt: new Date('2099-01-31T09:00').getTime(),
    care: '薬剤散布',
    type: '薬剤散布',
    fertilizer: 'なし',
    details: { name: 'テスト薬剤' },
    note: '',
    recurrence: { unit: 'month', interval: 2 }
  };
  await seed(page, [{ ...plants[0], plans: [plan], logs: [] }]);
  await page.goto('/');
  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-03-31'));
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・薬剤散布予定');
  await expect(page.locator('#calendarDayDetails')).toContainText('隔月');

  await page.evaluate(() => window.selectCalendarDate('2099-02-28'));
  await expect(page.locator('#calendarDayDetails')).not.toContainText('グラキリス・薬剤散布予定');
});

test('未来日のカレンダーから予定登録画面を開ける', async ({ page }) => {
  await seed(page, [{ ...plants[0], plans: [], logs: [] }]);
  await page.goto('/');
  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-05-10'));
  await expect(page.locator('#addCareForDateBtn')).toHaveText('＋ この日の予定を追加');
  await page.locator('#addCareForDateBtn').click();
  await expect(page.locator('#careTitle')).toContainText('ケア予定');
  await expect(page.locator('#careRecordedAt')).toHaveValue(/^2099-05-10T/);
  await expect(page.locator('#recurrenceFields')).toBeVisible();
});

test('選択した複数株へ同じケア予定をまとめて登録する', async ({ page }) => {
  await seed(page, plants.map(plant => ({ ...plant, plans: [], logs: [] })));
  await page.goto('/');
  await page.locator('#menuBtn').click();
  await page.locator('#batchPlanBtn').click();
  await expect(page.locator('#batchPlanDialog')).toBeVisible();
  await expect(page.locator('.batch-plan-plant-check')).toHaveCount(2);
  await page.locator('#batchPlanSelectAll').click();
  await page.locator('#continueBatchPlan').click();

  await expect(page.locator('#careTitle')).toContainText('2株のケア予定');
  await page.locator('#careType').selectOption({ label: '施肥' });
  await page.locator('#careRecordedAt').fill('2099-01-01T09:00');
  await page.locator('#fertilizerName').fill('ハイポネックス');
  await page.locator('#fertilizerAmount').fill('2000倍');
  await page.locator('#recurrenceUnit').selectOption('month');
  await page.locator('#recurrenceInterval').fill('2');
  await page.locator('#waterNote').fill('生育期のみ実施');
  await page.locator('#saveCare').click();
  await expect(page.locator('#careDialog')).toBeHidden();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].plans).toHaveLength(1);
  expect(saved.plants[1].plans).toHaveLength(1);
  expect(saved.plants[2].plans).toHaveLength(0);
  expect(saved.plants[0].plans[0]).toMatchObject({
    care: '施肥',
    note: '生育期のみ実施',
    recurrence: { unit: 'month', interval: 2 },
    details: { name: 'ハイポネックス', amount: '2000倍' }
  });
  expect(saved.plants[0].plans[0].id).not.toBe(saved.plants[1].plans[0].id);

  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-03-01'));
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・施肥予定');
  await expect(page.locator('#calendarDayDetails')).toContainText('恵比寿大黒・施肥予定');
  await expect(page.locator('#calendarDayDetails')).toContainText('隔月');
});

test('株を選ばず隔週の備忘録を登録してカレンダーに表示する', async ({ page }) => {
  await seed(page, [plants[0]]);
  await page.goto('/');
  await page.locator('#menuBtn').click();
  await page.locator('#remindersBtn').click();
  await expect(page.locator('#remindersDialog')).toBeVisible();
  await page.locator('#addReminder').click();
  await page.locator('#reminderTitle').fill('液肥');
  await page.locator('#reminderStartAt').fill('2099-01-01T09:00');
  await page.locator('#reminderRecurrenceUnit').selectOption('week');
  await page.locator('#reminderRecurrenceInterval').fill('2');
  await page.locator('#reminderMemo').fill('ハイポネックスを2000倍で使用');
  await page.locator('#saveReminder').click();
  await expect(page.locator('#reminderDialog')).toBeHidden();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.reminders).toHaveLength(1);
  expect(saved.reminders[0]).toMatchObject({
    title: '液肥',
    memo: 'ハイポネックスを2000倍で使用',
    recurrence: { unit: 'week', interval: 2 }
  });

  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-01-15'));
  await expect(page.locator('#calendarDayDetails')).toContainText('液肥');
  await expect(page.locator('#calendarDayDetails')).toContainText('隔週');
  await expect(page.locator('#calendarDayDetails')).toContainText('ハイポネックスを2000倍で使用');

  await page.evaluate(() => window.selectCalendarDate('2099-01-08'));
  await expect(page.locator('#calendarDayDetails')).not.toContainText('液肥');
});

test('備忘録を編集・削除できる', async ({ page }) => {
  const reminder = {
    id: 'reminder-edit',
    title: '液肥',
    startAt: new Date('2099-02-01T09:00').getTime(),
    memo: '1000倍',
    recurrence: { unit: 'month', interval: 1 }
  };
  await seed(page, [], [reminder]);
  await page.goto('/');
  await page.locator('#menuBtn').click();
  await page.locator('#remindersBtn').click();
  await page.getByRole('button', { name: '編集' }).click();
  await page.locator('#reminderTitle').fill('液肥・追肥');
  await page.locator('#reminderMemo').fill('2000倍へ変更');
  await page.locator('#saveReminder').click();
  await expect(page.locator('#reminderDialog')).toBeHidden();

  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.reminders[0].title).toBe('液肥・追肥');
  expect(saved.reminders[0].memo).toBe('2000倍へ変更');

  await page.locator('#menuBtn').click();
  await page.locator('#remindersBtn').click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '削除' }).click();
  await expect(page.locator('#remindersList')).toContainText('備忘録はまだありません');
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.reminders).toHaveLength(0);
});

test('未来日のカレンダーから株を選ばず備忘録を追加できる', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#calendarViewBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-05-10'));
  await page.locator('#addReminderForDateBtn').click();
  await expect(page.locator('#reminderDialog')).toBeVisible();
  await expect(page.locator('#reminderStartAt')).toHaveValue(/^2099-05-10T/);
});
