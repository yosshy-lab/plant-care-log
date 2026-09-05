import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const storageKey = 'plant-care-log-v1';

async function seed(page, plants = [], reminders = [], careTemplates = []) {
  await page.addInitScript(({ key, plants: seededPlants, reminders: seededReminders, careTemplates: seededTemplates }) => {
    if (!sessionStorage.getItem('playwright-data-seeded')) {
      localStorage.setItem(key, JSON.stringify({ plants: seededPlants, reminders: seededReminders, careTemplates: seededTemplates }));
      localStorage.setItem('plant-care-analytics-enabled-v1', 'false');
      localStorage.setItem('plant-care-view-v1', 'list');
      sessionStorage.setItem('playwright-data-seeded', 'true');
    }
  }, { key: storageKey, plants, reminders, careTemplates });
}

async function openMore(page) {
  await page.locator('#navMoreBtn').click();
  await expect(page.locator('#dataMenu')).toBeVisible();
}

async function openDataManagement(page) {
  await openMore(page);
  await page.locator('#openDataManagementBtn').click();
  await expect(page.locator('#dataManagementDialog')).toBeVisible();
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
  await expect(page.locator('#appVersionDisplay')).toHaveText('v1.16.0');
  await expect(page.locator('#addBtn')).toBeVisible();
  await expect(page.locator('#plantSearch')).toBeVisible();
  await expect(page.locator('#navCalendarBtn')).toBeVisible();
  await expect(page.locator('#navTodayBtn')).toBeVisible();
  await expect(page.locator('#navRecordBtn')).toBeVisible();
  expect(errors).toEqual([]);
});

test('今日画面で期限超過の予定を完了して履歴へ移せる', async ({ page }) => {
  const overdueAt=Date.now()-60_000;
  await seed(page, [{
    ...plants[0],
    logs: [],
    plans: [{
      id:'today-plan',startAt:overdueAt,care:'水やり',type:'たっぷり灌水',fertilizer:'なし',
      details:{waterAmount:'鉢底から流れるまで'},note:'今日の確認',recurrence:{unit:'none',interval:1}
    }]
  }]);
  await page.goto('/');
  await page.locator('#navTodayBtn').click();
  await expect(page.locator('#todayPlanCount')).toHaveText('1件');
  await expect(page.locator('#overduePlanCount')).toHaveText('1件');
  await expect(page.locator('.today-task')).toContainText('グラキリス');
  await page.getByRole('button',{ name:'完了して記録' }).click();

  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  expect(saved.plants[0].plans).toHaveLength(0);
  expect(saved.plants[0].logs).toHaveLength(1);
  expect(saved.plants[0].logs[0].care).toBe('水やり');
  await expect(page.locator('#todayPlanCount')).toHaveText('0件');
});

test('SNS共有用のOGP画像とメタ情報を配信する', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '塊根植物記録｜日々是塊根植物');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://hibikorekaikon.github.io/plant-care-log/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://yosshy-lab.github.io/plant-care-log/og-image.jpg');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

  const response=await page.request.get('/og-image.jpg');
  expect(response.ok()).toBe(true);
  const image=await response.body();
  expect([...image.subarray(0,3)]).toEqual([0xff,0xd8,0xff]);
  expect(image.byteLength).toBeGreaterThan(100_000);
});

test('下部ナビと一覧の一括選択操作を表示する', async ({ page }) => {
  await seed(page, [plants[0], plants[1]]);
  await page.goto('/');
  await expect(page.locator('#addBtn')).toBeVisible();
  await expect(page.locator('#addBtn')).toHaveClass(/list-add-button/);
  await expect(page.locator('.bottom-nav')).toBeVisible();

  await page.locator('#toggleSelectModeBtn').click();
  await expect(page.locator('.plant-select-control input')).toHaveCount(2);
  await page.locator('.plant-card').first().click();
  await expect(page.locator('#selectionCount')).toHaveText('1株を選択中');
  await expect(page.locator('#selectionActionBar')).toBeVisible();
  await page.locator('#selectionPlanBtn').click();
  await expect(page.locator('#batchPlanDialog')).toBeVisible();
  await expect(page.locator('.batch-plan-plant-check:checked')).toHaveCount(1);
  await page.locator('#cancelBatchPlan').click();

  await page.locator('#navRecordBtn').click();
  await expect(page.locator('#recordMenuDialog')).toBeVisible();
  await page.locator('#closeRecordMenu').click();
  if(page.viewportSize().width<=520) await expect(page.locator('#menuBtn')).toBeHidden();
  else await expect(page.locator('#menuBtn')).toBeVisible();
  await page.locator('#navMoreBtn').click();
  await expect(page.locator('#dataMenu')).toBeVisible();
  await expect(page.locator('.menu-sheet-section')).toHaveCount(4);
  await expect(page.locator('#dataMenu')).toContainText('カレンダー・天気');
  await expect(page.locator('#batchWaterBtn')).toHaveCount(0);
  await page.locator('#openDataManagementBtn').click();
  await expect(page.locator('#dataManagementDialog')).toBeVisible();
  await expect(page.locator('.data-management-intro')).toContainText('ブラウザ内に保存');
  await page.locator('#backToMoreMenu').click();
  await expect(page.locator('#dataMenu')).toBeVisible();
  await page.locator('#closeMoreMenu').click();
  await expect(page.locator('#dataMenu')).toBeHidden();
  await page.locator('#navCalendarBtn').click();
  await expect(page.locator('#addBtn')).toBeHidden();
});

test('更新案内は新バージョンの初回だけ表示しメニューから再確認できる', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await expect(page.locator('#releaseNotice')).toBeVisible();
  await expect(page.locator('#releaseNotice')).toContainText('v1.16.0 更新');
  await expect(page.locator('#releaseNotice')).toContainText('いつものケアをすばやく記録');

  await page.locator('#releaseNoticeDetails').click();
  await expect(page.locator('#releaseNotesDialog')).toBeVisible();
  await expect(page.locator('#releaseNotesList')).toContainText('v1.16.0');
  await expect(page.locator('#releaseNotesList')).not.toContainText('v1.9.0');
  await expect(page.locator('#releaseNotesHint')).toContainText('今回のアップデート内容');
  await page.locator('#closeReleaseNotes').click();

  await page.reload();
  await expect(page.locator('#releaseNotice')).toBeHidden();

  await openMore(page);
  await page.locator('#releaseNotesBtn').click();
  await expect(page.locator('#releaseNotesDialog')).toBeVisible();
  await expect(page.locator('#releaseNotesList')).toContainText('v1.16.0');
  await expect(page.locator('#releaseNotesList')).toContainText('v1.12.0');
  await expect(page.locator('#releaseNotesList')).toContainText('v1.11.0');
  await expect(page.locator('#releaseNotesList')).toContainText('v1.9.0');
  await expect(page.locator('#releaseNotesList')).toContainText('v1.8.1');
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
  await page.locator('#cultivationSection > summary').click();
  await page.locator('#plantTags').fill('実生2026, 要観察');
  await page.locator('#savePlant').click();

  const card = page.locator('.plant-card', { hasText: 'テスト実生' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('休眠中');
  await expect(card).toContainText('実生2026');
  await page.reload();
  await expect(page.locator('.plant-card', { hasText: 'テスト実生' })).toBeVisible();
});

test('植物の必須項目を入力欄の近くへ表示する', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#addBtn').click();
  await page.locator('#savePlant').click();

  await expect(page.locator('#plantDialog')).toBeVisible();
  await expect(page.locator('#plantName')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#plantNameError')).toHaveText('管理名を入力してください。');
  await page.locator('#plantName').fill('入力確認株');
  await expect(page.locator('#plantName')).not.toHaveAttribute('aria-invalid', 'true');
});

test('入力途中のキャンセル時に破棄を確認する', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#addBtn').click();
  await page.locator('#plantName').fill('まだ保存しない株');

  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#cancelPlant').click();
  await expect(page.locator('#plantDialog')).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#cancelPlant').click();
  await expect(page.locator('#plantDialog')).toBeHidden();
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

test('植物詳細で管理指標・成長タイムライン・写真比較を確認できる', async ({ page }) => {
  const now=Date.now();
  const day=24*60*60*1000;
  const photo='data:image/jpeg;base64,AA==';
  await seed(page, [{
    ...plants[0],
    photo,
    logs:[
      {time:now-4*day,care:'水やり',type:'通常',fertilizer:'なし',details:{waterAmount:'100ml'}},
      {time:now-10*day,care:'水やり',type:'通常',fertilizer:'なし',details:{waterAmount:'80ml'}},
      {time:now-20*day,care:'状態・写真記録',details:{height:'12cm'},note:'新芽を確認',photo}
    ],
    plans:[{
      id:'detail-plan',startAt:now+day,care:'施肥',details:{},recurrence:{unit:'none',interval:1}
    }]
  }]);
  await page.goto('/');
  await page.locator('.plant-card').click();

  await expect(page.locator('#plantDetailsDialog')).toBeVisible();
  await expect(page.locator('.detail-vitals')).toContainText('4日');
  await expect(page.locator('.detail-vitals')).toContainText('6.0日');
  await expect(page.locator('.detail-vitals')).toContainText('明日');
  await expect(page.locator('.detail-timeline-item')).toHaveCount(3);
  await expect(page.locator('.detail-timeline')).toContainText('新芽を確認');

  await expect(page.locator('#comparePhotosPlantDetails')).toBeEnabled();
  await page.locator('#comparePhotosPlantDetails').click();
  await expect(page.locator('#photoCompareDialog')).toBeVisible();
  await expect(page.locator('#photoCompareStage figure')).toHaveCount(2);
  await page.locator('#closePhotoCompare').click();
  await expect(page.locator('#plantDetailsDialog')).toBeVisible();

  await page.locator('#quickWaterPlantDetails').click();
  await expect(page.locator('#plantDetailsDialog')).toBeVisible();
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  expect(saved.plants[0].logs).toHaveLength(4);
  expect(saved.plants[0].logs[0].care).toBe('水やり');
});

test('旧形式を含む測定値をグラフ化し成長写真を連続表示・書き出しできる', async ({ page }) => {
  const day=24*60*60*1000;
  const now=Date.now();
  const photo='data:image/jpeg;base64,AA==';
  await seed(page,[{
    ...plants[0],
    logs:[
      {time:now-20*day,care:'状態・写真記録',details:{height:'10cm',trunkWidth:'3.2cm',leafCount:'8枚'},photo},
      {time:now-10*day,care:'状態・写真記録',details:{height:'12cm',trunkWidth:'4cm',leafCount:'12枚',measurements:{height:12,trunkWidth:4,leafCount:12}},photo},
      {time:now-day,care:'水やり',type:'通常',fertilizer:'なし',details:{}}
    ]
  }]);
  await page.goto('/');
  await page.locator('.plant-card').click();

  await expect(page.locator('.growth-chart-card')).toHaveCount(3);
  await expect(page.locator('.growth-chart-section')).toContainText('12cm');
  await expect(page.locator('.growth-chart-section')).toContainText('+2cm');
  await page.getByRole('button',{name:'測定',exact:true}).click();
  await expect(page.locator('#plantTimelineList .detail-timeline-item')).toHaveCount(2);
  await page.getByRole('button',{name:'ケア',exact:true}).click();
  await expect(page.locator('#plantTimelineList .detail-timeline-item')).toHaveCount(1);

  await page.locator('#growthPhotoSequencePlantDetails').click();
  await expect(page.locator('#growthPhotoSequenceDialog')).toBeVisible();
  await expect(page.locator('#growthPhotoSequenceCount')).toHaveText('1 / 2');
  await page.locator('#nextGrowthPhoto').click();
  await expect(page.locator('#growthPhotoSequenceElapsed')).toContainText('10日');
  await page.locator('#closeGrowthPhotoSequence').click();

  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportGrowthPhotosPlantDetails').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^plant-growth-\d{4}-\d{2}-\d{2}\.html$/);
  const html=await readFile(await download.path(),'utf8');
  expect(html).toContain('グラキリスの成長写真');
  expect(html).toContain('最初の写真から10日');
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

  await openDataManagement(page);
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

test('タグで株を整理し、選択した株だけをまとめて編集できる', async ({ page }) => {
  const taggedPlants = [
    { ...plants[0], tags: ['屋外', '実生2026'] },
    { ...plants[1], tags: ['室内'] },
    { ...plants[2], tags: [] }
  ];
  await seed(page, taggedPlants);
  await page.goto('/');

  await page.locator('#plantTagFilter').selectOption({ label: '屋外' });
  await expect(page.locator('.plant-card')).toHaveCount(1);
  await expect(page.locator('.plant-card')).toContainText('グラキリス');
  await page.locator('#plantTagFilter').selectOption('');

  await openMore(page);
  await page.locator('#batchEditBtn').click();
  await expect(page.locator('#batchEditDialog')).toBeVisible();
  await page.locator('.batch-edit-plant-check[value="a"]').check();
  await page.locator('.batch-edit-plant-check[value="b"]').check();
  await page.locator('#batchEditTagsEnabled').check();
  await page.locator('#batchEditTagsAction').selectOption('add');
  await page.locator('#batchEditTags').fill('要観察, 屋外');
  await page.locator('#batchEditLocationEnabled').check();
  await page.locator('#batchEditLocation').fill('温室棚');
  await page.locator('#saveBatchEdit').click();

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].tags).toEqual(['屋外', '実生2026', '要観察']);
  expect(saved.plants[1].tags).toEqual(['室内', '要観察', '屋外']);
  expect(saved.plants[0].location).toBe('温室棚');
  expect(saved.plants[1].location).toBe('温室棚');
  expect(saved.plants[2].location).toBe('温室');
  expect(saved.plants[2].tags).toEqual([]);

  await page.locator('#plantStatusFilter').selectOption('all');
  await page.locator('#plantTagFilter').selectOption({ label: '要観察' });
  await expect(page.locator('.plant-card')).toHaveCount(2);
});

test('株の並び順を変更して保持できる', async ({ page }) => {
  await seed(page, plants.map(plant => ({ ...plant, managementStatus: 'active' })));
  await page.goto('/');
  await openMore(page);
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
  await page.locator('#navCalendarBtn').click();
  await expect(page.locator('.calendar-day')).toHaveCount(42);
  await expect(page.locator('.calendar-day.sunday')).toHaveCount(6);
  await expect(page.locator('.calendar-day.saturday')).toHaveCount(6);
  await expect(page.locator('.calendar-day.sunday:not(.selected):not(.today)').first()).toHaveCSS('background-color', 'rgb(255, 247, 247)');
  await expect(page.locator('.calendar-day.saturday:not(.selected):not(.today)').first()).toHaveCSS('background-color', 'rgb(245, 249, 255)');
});

test('今日へ戻るを年月の横へ小さく表示する', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#navCalendarBtn').click();

  const todayButton=page.locator('#todayBtn');
  const title=page.locator('#calendarTitle');
  await expect(todayButton).toBeVisible();
  await expect(todayButton).toHaveText('今日へ戻る');
  expect(await todayButton.evaluate(element=>element.parentElement?.classList.contains('calendar-title-group'))).toBe(true);

  const [todayBox,titleBox,previousBox]=await Promise.all([
    todayButton.boundingBox(),title.boundingBox(),page.locator('#prevMonth').boundingBox()
  ]);
  expect(todayBox && titleBox && previousBox).toBeTruthy();
  expect(Math.abs((todayBox.y+todayBox.height/2)-(titleBox.y+titleBox.height/2))).toBeLessThanOrEqual(2);
  expect(todayBox.height).toBeLessThan(previousBox.height);
  const [todayFont,previousFont]=await Promise.all([
    todayButton.evaluate(element=>parseFloat(getComputedStyle(element).fontSize)),
    page.locator('#prevMonth').evaluate(element=>parseFloat(getComputedStyle(element).fontSize))
  ]);
  expect(todayFont).toBeLessThan(previousFont);
});

test('カレンダーを種類別に絞り込み選択日の詳細を確認できる', async ({ page }) => {
  const selected=new Date();
  selected.setHours(9,0,0,0);
  const key=`${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,'0')}-${String(selected.getDate()).padStart(2,'0')}`;
  const planAt=new Date(selected); planAt.setHours(11);
  const reminderAt=new Date(selected); reminderAt.setHours(13);
  const calendarPlant={
    ...plants[0],
    logs:[
      {time:selected.getTime(),care:'水やり',type:'通常',fertilizer:'なし'},
      {time:selected.getTime()+60_000,care:'薬剤散布',details:{name:'ベニカ',target:'ハダニ'}}
    ],
    plans:[{id:'calendar-ui-plan',startAt:planAt.getTime(),care:'施肥',details:{fertilizerName:'ハイポネックス'},recurrence:{unit:'none',interval:1}}]
  };
  const reminder={id:'calendar-ui-reminder',title:'遮光を確認',startAt:reminderAt.getTime(),recurrence:{unit:'none',interval:1}};
  await seed(page,[calendarPlant],[reminder]);
  await page.goto('/');
  await page.locator('#navCalendarBtn').click();

  await expect(page.locator('[data-calendar-filter]')).toHaveCount(6);
  await expect(page.locator('.calendar-day.today .calendar-event-count')).toHaveCount(3);
  await expect(page.locator('.calendar-day.today .more-mark')).toHaveText('+1');
  await page.locator('#calendarLegendDetails > summary').click();
  await expect(page.locator('#calendarLegendDetails')).toHaveAttribute('open','');

  await page.locator('[data-calendar-filter="water"]').click();
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・水やり');
  await expect(page.locator('#calendarDayDetails')).not.toContainText('薬剤散布');
  await page.locator('[data-calendar-filter="care"]').click();
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・薬剤散布');
  await expect(page.locator('#calendarDayDetails')).not.toContainText('施肥予定');
  await page.locator('[data-calendar-filter="planned"]').click();
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・施肥予定');
  await page.locator('[data-calendar-filter="reminder"]').click();
  await expect(page.locator('#calendarDayDetails')).toContainText('遮光を確認');

  await page.evaluate(date=>window.selectCalendarDate(date),key);
  await expect(page.locator('#calendarDayPanelTitle')).not.toBeEmpty();
  if(page.viewportSize().width<=640){
    await expect(page.locator('#calendarDayPanel')).toHaveClass(/open/);
    await expect(page.locator('#calendarDayBackdrop')).toBeVisible();
    await page.locator('#closeCalendarDayPanel').click();
    await expect(page.locator('#calendarDayBackdrop')).toBeHidden();
  }else{
    await expect(page.locator('#calendarDayPanel')).toBeVisible();
    await expect(page.locator('#calendarDayBackdrop')).toBeHidden();
  }
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
  const careTemplate = {
    id: 'backup-template',
    name: '定番の液肥',
    care: '施肥',
    type: '施肥',
    fertilizer: 'なし',
    details: { name: 'ハイポネックス', form: '液肥', amount: '2000倍' },
    note: '',
    updatedAt: Date.now()
  };
  await seed(page, withLogs, [reminder], [careTemplate]);
  await page.goto('/');
  await openDataManagement(page);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^plant-care-log-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const payload = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(payload).toMatchObject({
    format: 'plant-care-log-backup',
    schemaVersion: 1,
    appVersion: '1.16.0'
  });
  expect(payload.plants).toHaveLength(3);
  expect(payload.reminders).toEqual([reminder]);
  expect(payload.careTemplates).toEqual([careTemplate]);
  expect(payload.plants[0].photo).toBe('data:image/jpeg;base64,AA==');

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

  await openDataManagement(page);
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
  await expect(page.locator('#navMoreBtn')).toHaveAttribute('aria-label', 'その他（バックアップをおすすめします）');
  await openDataManagement(page);
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

  await page.locator('#navCalendarBtn').click();
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

test('カレンダーからケア済み記録を編集・削除できる', async ({ page }) => {
  const log = {
    time: new Date('2026-08-25T08:00').getTime(),
    care: '水やり',
    type: '通常',
    fertilizer: 'なし',
    details: { waterAmount: '100ml' },
    note: '編集前'
  };
  await seed(page, [{ ...plants[0], logs: [log] }]);
  await page.goto('/');
  await page.locator('#navCalendarBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2026-08-25'));

  const entry=page.locator('.calendar-care-entry');
  await expect(entry).toContainText('グラキリス・水やり');
  await entry.locator('.calendar-entry-edit').click();
  await expect(page.locator('#careTitle')).toContainText('ケア記録を編集');
  await page.locator('#waterAmount').fill('250ml');
  await page.locator('#waterNote').fill('カレンダーから修正');
  await page.locator('#saveCare').click();

  await expect(page.locator('#careDialog')).toBeHidden();
  await expect(page.locator('#historyDialog')).toBeHidden();
  await expect(page.locator('.calendar-care-entry')).toContainText('250ml');
  await expect(page.locator('.calendar-care-entry')).toContainText('カレンダーから修正');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('.calendar-care-entry .calendar-entry-delete').click();
  await expect(page.locator('.calendar-care-entry')).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs).toHaveLength(0);
});

test('カレンダーからケア予定を編集・削除できる', async ({ page }) => {
  const plan = {
    id: 'calendar-plan',
    startAt: new Date('2099-01-15T09:00').getTime(),
    care: '施肥',
    type: '施肥',
    fertilizer: 'なし',
    details: { name: 'ハイポネックス', form: '液肥', amount: '2000倍' },
    note: '編集前',
    recurrence: { unit: 'none', interval: 1 }
  };
  await seed(page, [{ ...plants[0], plans: [plan], logs: [] }]);
  await page.goto('/');
  await page.locator('#navCalendarBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-01-15'));

  const entry=page.locator('.calendar-plan-entry');
  await expect(entry).toContainText('グラキリス・施肥予定');
  await entry.locator('.calendar-entry-edit').click();
  await expect(page.locator('#careTitle')).toContainText('ケア予定を編集');
  await page.locator('#waterNote').fill('カレンダーから予定を修正');
  await page.locator('#saveCare').click();

  await expect(page.locator('#careDialog')).toBeHidden();
  await expect(page.locator('#plansDialog')).toBeHidden();
  await expect(page.locator('.calendar-plan-entry')).toContainText('カレンダーから予定を修正');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('.calendar-plan-entry .calendar-entry-delete').click();
  await expect(page.locator('.calendar-plan-entry')).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].plans).toHaveLength(0);
});

test('端末設定に合わせてダークモードへ切り替わる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await seed(page, [plants[0]]);
  await page.goto('/');

  await expect.poll(() => page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(15, 23, 42)');
  await expect(page.locator('.plant-card')).toHaveCSS('background-color', 'rgb(17, 24, 39)');
  await expect(page.locator('.plant-card')).toHaveCSS('border-top-color', 'rgb(51, 65, 85)');
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(243, 244, 246)');
  await expect(page.locator('#addBtn')).toHaveCSS('border-top-color', 'rgb(71, 85, 105)');
  await expect(page.locator('.bottom-nav')).toHaveCSS('border-top-color', 'rgb(55, 65, 81)');
  await expect(page.locator('.list-layout-switch')).toHaveCSS('border-top-color', 'rgb(100, 116, 139)');

  await openMore(page);
  await expect(page.locator('#helpBtn')).toHaveCSS('border-top-style', 'none');
  await expect(page.locator('#helpBtn')).toHaveCSS('border-bottom-color', 'rgb(55, 65, 81)');
  await expect(page.locator('#themeSettingsBtn')).toHaveCSS('border-top-style', 'none');
  await expect(page.locator('#themeSettingsBtn')).toHaveCSS('border-bottom-color', 'rgb(55, 65, 81)');
  await page.locator('#closeMoreMenu').click();

  await page.locator('#addBtn').click();
  await expect(page.locator('#plantDialog')).toHaveCSS('background-color', 'rgb(17, 24, 39)');
  await expect(page.locator('#plantDialog')).toHaveCSS('border-top-color', 'rgb(51, 65, 85)');
  await expect(page.locator('#plantName')).toHaveCSS('background-color', 'rgb(17, 24, 39)');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 244, 246)');
});

test('株カードを余白の少ないレイアウトで表示する', async ({ page }) => {
  const recentLog={id:'log-1',type:'水やり',time:Date.now()-3*60*60*1000,note:''};
  await seed(page, plants.slice(0,2).map(plant=>({...plant,logs:[recentLog]})));
  await page.goto('/');

  const listCard=page.locator('.plant-card').first();
  const listLayout=await listCard.evaluate(card=>{
    const elapsed=card.querySelector('.elapsed');
    const label=elapsed.querySelector('span');
    const cardStyle=getComputedStyle(card);
    const elapsedStyle=getComputedStyle(elapsed);
    return {
      cardPaddingTop:parseFloat(cardStyle.paddingTop),
      elapsedFontSize:parseFloat(elapsedStyle.fontSize),
      elapsedDisplay:elapsedStyle.display,
      elapsedLeft:elapsed.getBoundingClientRect().left,
      elapsedBottom:elapsed.getBoundingClientRect().bottom,
      labelLeft:label.getBoundingClientRect().left,
      labelTop:label.getBoundingClientRect().top
    };
  });
  expect(listLayout.cardPaddingTop).toBeLessThanOrEqual(12);
  expect(listLayout.elapsedFontSize).toBeLessThanOrEqual(22);
  expect(listLayout.elapsedDisplay).toBe('flex');
  expect(listLayout.labelLeft).toBeGreaterThan(listLayout.elapsedLeft);
  expect(listLayout.labelTop).toBeLessThan(listLayout.elapsedBottom);

  await page.locator('#gridLayoutBtn').click();
  const gridLayout=await page.locator('.plant-card').first().evaluate(card=>{
    const elapsed=card.querySelector('.elapsed');
    const actionButtons=[...card.querySelectorAll('.care-actions button')];
    const style=getComputedStyle(card);
    return {
      cardPaddingTop:parseFloat(style.paddingTop),
      elapsedFontSize:parseFloat(getComputedStyle(elapsed).fontSize),
      nameMinHeight:getComputedStyle(card.querySelector('.name')).minHeight,
      actionFontSizes:actionButtons.map(button=>parseFloat(getComputedStyle(button).fontSize)),
      actionLabelsFit:actionButtons.every(button=>button.scrollWidth<=button.clientWidth+1 && button.scrollHeight<=button.clientHeight+1)
    };
  });
  expect(gridLayout.cardPaddingTop).toBeLessThanOrEqual(10);
  expect(gridLayout.elapsedFontSize).toBeLessThanOrEqual(18);
  expect(gridLayout.nameMinHeight).toBe('0px');
  expect(gridLayout.actionFontSizes).toEqual([13,13]);
  expect(gridLayout.actionLabelsFit).toBe(true);
});

test('メニューで表示テーマを選択して保存できる', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await seed(page, [plants[0]]);
  await page.goto('/');

  await openMore(page);
  await expect(page.locator('#themeSettingsBtn')).toHaveText('表示テーマ：自動');
  await page.locator('#themeSettingsBtn').click();
  await page.locator('#themeMode').selectOption('dark');
  await page.locator('#saveTheme').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(15, 23, 42)');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('plant-care-theme-v1'))).toBe('dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openMore(page);
  await expect(page.locator('#themeSettingsBtn')).toHaveText('表示テーマ：ダーク');
  await page.locator('#themeSettingsBtn').click();
  await page.locator('#themeMode').selectOption('auto');
  await page.locator('#saveTheme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('まとめて水やりを過去日時で複数株へ記録する', async ({ page }) => {
  await seed(page, plants.slice(0, 2).map(plant => ({ ...plant, managementStatus: 'active', logs: [] })));
  await page.goto('/');
  await page.locator('#navRecordBtn').click();
  await page.locator('#recordMenuWater').click();
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
  await page.locator('#navCalendarBtn').click();
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
  await page.locator('#navCalendarBtn').click();
  await page.locator('.calendar-day.today').click();
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
  await page.locator('#navCalendarBtn').click();
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
  await page.locator('#navCalendarBtn').click();
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
  await page.locator('#navCalendarBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-03-31'));
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・薬剤散布予定');
  await expect(page.locator('#calendarDayDetails')).toContainText('隔月');

  await page.evaluate(() => window.selectCalendarDate('2099-02-28'));
  await expect(page.locator('#calendarDayDetails')).not.toContainText('グラキリス・薬剤散布予定');
});

test('未来日のカレンダーから予定登録画面を開ける', async ({ page }) => {
  await seed(page, [{ ...plants[0], plans: [], logs: [] }]);
  await page.goto('/');
  await page.locator('#navCalendarBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-05-10'));
  await expect(page.locator('#addCareForDateBtn')).toHaveText('＋ この日の予定を追加');
  await page.locator('#addCareForDateBtn').click();
  await expect(page.locator('#careTitle')).toContainText('ケア予定');
  await expect(page.locator('#careRecordedAt')).toHaveValue(/^2099-05-10T/);
  await expect(page.locator('#recurrenceFields')).toBeVisible();
});

test('選択した複数株へ同じケア記録をまとめて登録する', async ({ page }) => {
  await seed(page, plants.map(plant => ({ ...plant, plans: [], logs: [] })));
  await page.goto('/');
  await page.locator('#navRecordBtn').click();
  await page.locator('#recordMenuCare').click();
  await expect(page.locator('#batchCareDialog')).toBeVisible();
  await expect(page.locator('.batch-care-plant-check')).toHaveCount(2);
  await page.locator('#batchCareSelectAll').click();
  await page.locator('#continueBatchCare').click();

  await expect(page.locator('#careTitle')).toContainText('2株のケア記録');
  await expect(page.locator('#recurrenceFields')).toBeHidden();
  await expect(page.locator('#carePhotoFields')).toBeHidden();
  await page.locator('#careType').selectOption({ label: '薬剤散布' });
  await page.locator('#careRecordedAt').fill('2026-08-31T09:00');
  await page.locator('#pesticideName').fill('ベニカXファイン');
  await page.locator('#pesticideTarget').fill('ハダニ');
  await page.locator('#waterNote').fill('屋外棚の株へ散布');
  await page.locator('#saveCare').click();
  await expect(page.locator('#careDialog')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('2株にケアを記録しました');

  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs).toHaveLength(1);
  expect(saved.plants[1].logs).toHaveLength(1);
  expect(saved.plants[2].logs).toHaveLength(0);
  expect(saved.plants[0].logs[0]).toMatchObject({
    care: '薬剤散布',
    note: '屋外棚の株へ散布',
    details: { name: 'ベニカXファイン', target: 'ハダニ' }
  });
  expect(saved.plants[1].logs[0]).toMatchObject(saved.plants[0].logs[0]);
});

test('選択した複数株へ同じケア予定をまとめて登録する', async ({ page }) => {
  await seed(page, plants.map(plant => ({ ...plant, plans: [], logs: [] })));
  await page.goto('/');
  await page.locator('#navRecordBtn').click();
  await page.locator('#recordMenuPlan').click();
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

  await page.locator('#navCalendarBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-03-01'));
  await expect(page.locator('#calendarDayDetails')).toContainText('グラキリス・施肥予定');
  await expect(page.locator('#calendarDayDetails')).toContainText('恵比寿大黒・施肥予定');
  await expect(page.locator('#calendarDayDetails')).toContainText('隔月');
});

test('株を選ばず隔週の備忘録を登録してカレンダーに表示する', async ({ page }) => {
  await seed(page, [plants[0]]);
  await page.goto('/');
  await page.locator('#navRecordBtn').click();
  await page.locator('#recordMenuReminder').click();
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

  await page.locator('#navCalendarBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-01-15'));
  await expect(page.locator('#calendarDayDetails')).toContainText('液肥');
  await expect(page.locator('#calendarDayDetails')).toContainText('隔週');
  await expect(page.locator('#calendarDayDetails')).toContainText('ハイポネックスを2000倍で使用');

  await page.evaluate(() => window.selectCalendarDate('2099-01-08'));
  await expect(page.locator('#calendarDayDetails')).not.toContainText('液肥');
});

test('ケア予定と備忘録を繰り返し設定付きのiCalendar形式で書き出す', async ({ page }) => {
  const plan = {
    id: 'calendar-export-plan',
    startAt: new Date('2099-01-01T09:00').getTime(),
    care: '水やり',
    type: '通常',
    fertilizer: 'なし',
    details: {},
    note: '乾き具合を確認',
    recurrence: { unit: 'week', interval: 2 }
  };
  const reminder = {
    id: 'calendar-export-reminder',
    title: '液肥の日',
    startAt: new Date('2099-01-05T10:30').getTime(),
    memo: '2000倍',
    recurrence: { unit: 'month', interval: 2 }
  };
  await seed(page, [{ ...plants[0], plans: [plan], logs: [] }], [reminder]);
  await page.goto('/');
  await openMore(page);
  await page.locator('#calendarExportBtn').click();
  await expect(page.locator('#calendarExportSummary')).toContainText('ケア予定 1件・備忘録 1件');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveCalendarExport').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^plant-care-plans-\d{4}-\d{2}-\d{2}\.ics$/);
  const calendar = await readFile(await download.path(), 'utf8');
  expect(calendar).toContain('BEGIN:VCALENDAR');
  expect(calendar).toContain('SUMMARY:[塊根植物記録] グラキリス・水やり');
  expect(calendar).toContain('SUMMARY:[塊根植物記録] 液肥の日');
  expect(calendar).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2');
  expect(calendar).toContain('RRULE:FREQ=MONTHLY;INTERVAL=2');
  expect(calendar).toContain('END:VCALENDAR');
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
  await page.locator('#navRecordBtn').click();
  await page.locator('#recordMenuReminder').click();
  await page.getByRole('button', { name: '編集' }).click();
  await page.locator('#reminderTitle').fill('液肥・追肥');
  await page.locator('#reminderMemo').fill('2000倍へ変更');
  await page.locator('#saveReminder').click();
  await expect(page.locator('#reminderDialog')).toBeHidden();

  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.reminders[0].title).toBe('液肥・追肥');
  expect(saved.reminders[0].memo).toBe('2000倍へ変更');

  await page.locator('#navRecordBtn').click();
  await page.locator('#recordMenuReminder').click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '削除' }).click();
  await expect(page.locator('#remindersList')).toContainText('備忘録はまだありません');
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.reminders).toHaveLength(0);
});

test('未来日のカレンダーから株を選ばず備忘録を追加できる', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('#navCalendarBtn').click();
  await page.evaluate(() => window.selectCalendarDate('2099-05-10'));
  await page.locator('#addReminderForDateBtn').click();
  await expect(page.locator('#reminderDialog')).toBeVisible();
  await expect(page.locator('#reminderStartAt')).toHaveValue(/^2099-05-10T/);
});

test('前回のケアを再利用しテンプレートと入力候補を保存できる', async ({ page }) => {
  const pesticideLog = {
    time: new Date('2026-09-01T08:00').getTime(),
    care: '薬剤散布',
    type: '薬剤散布',
    fertilizer: 'なし',
    details: { name: 'ベニカX', target: 'ハダニ', dilution: '1000倍', method: '散布' },
    note: '葉裏まで散布'
  };
  await seed(page, [{ ...plants[0], logs: [pesticideLog] }]);
  await page.goto('/');
  await page.locator('.care').click();
  await expect(page.locator('#useLastCare')).toBeVisible();
  await page.locator('#useLastCare').click();
  await expect(page.locator('#careType')).toHaveValue('薬剤散布');
  await expect(page.locator('#pesticideName')).toHaveValue('ベニカX');
  await expect(page.locator('#pesticideDilution')).toHaveValue('1000倍');
  await expect(page.locator('#waterNote')).toHaveValue('葉裏まで散布');

  page.once('dialog', dialog => dialog.accept('害虫対策'));
  await page.locator('#saveCareTemplate').click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.careTemplates).toHaveLength(1);
  expect(saved.careTemplates[0]).toMatchObject({
    name: '害虫対策',
    care: '薬剤散布',
    details: { name: 'ベニカX', dilution: '1000倍' }
  });

  await page.reload();
  await page.locator('.care').click();
  await expect(page.locator('#careTemplateSelect option')).toContainText(['テンプレートを選択', '害虫対策（薬剤散布）']);
  await expect(page.locator('#pesticideNameHistory option[value="ベニカX"]')).toHaveCount(1);
  await expect(page.locator('#dilutionHistory option[value="1000倍"]')).toHaveCount(1);

  await page.reload();
  await page.locator('#navRecordBtn').click();
  await expect(page.locator('#recentCareSection')).toBeVisible();
  await expect(page.locator('#recentCareActions')).toContainText('薬剤散布・ベニカX');
});

test('ケア予定を複製し選択した予定を延期・一括完了できる', async ({ page }) => {
  const firstAt = new Date('2099-03-01T09:00').getTime();
  const secondAt = new Date('2099-03-02T09:00').getTime();
  const plansForBatch = [
    { id: 'plan-1', startAt: firstAt, care: '水やり', type: '通常', fertilizer: 'なし', details: {}, note: '', recurrence: { unit: 'none', interval: 1 } },
    { id: 'plan-2', startAt: secondAt, care: '施肥', type: '施肥', fertilizer: 'なし', details: { name: '液肥' }, note: '', recurrence: { unit: 'none', interval: 1 } }
  ];
  await seed(page, [{ ...plants[0], plans: plansForBatch, logs: [] }]);
  await page.goto('/');
  await page.evaluate(() => window.showPlans('a'));

  await page.getByRole('button', { name: '複製' }).first().click();
  await expect(page.locator('.plan-item')).toHaveCount(3);
  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  const copy = saved.plants[0].plans.find(plan => !['plan-1', 'plan-2'].includes(String(plan.id)));
  expect(copy.startAt).toBe(firstAt + 86_400_000);

  await page.locator('.plan-select-check[value="plan-1"]').check();
  await page.locator('.plan-select-check[value="plan-2"]').check();
  await expect(page.locator('#selectedPlansCount')).toHaveText('2件を選択中');
  await page.locator('#postponeSelectedPlans').click();
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].plans.find(plan => plan.id === 'plan-1').startAt).toBe(firstAt + 86_400_000);
  expect(saved.plants[0].plans.find(plan => plan.id === 'plan-2').startAt).toBe(secondAt + 86_400_000);

  await page.locator('.plan-select-check[value="plan-1"]').check();
  await page.locator('.plan-select-check[value="plan-2"]').check();
  await page.locator('#completeSelectedPlans').click();
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.plants[0].logs).toHaveLength(2);
  expect(saved.plants[0].plans).toHaveLength(1);
  expect(saved.plants[0].plans[0].id).toBe(copy.id);
});
