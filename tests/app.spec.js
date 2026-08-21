import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const storageKey = 'plant-care-log-v1';

async function seed(page, plants = []) {
  await page.addInitScript(({ key, value }) => {
    if (!sessionStorage.getItem('playwright-data-seeded')) {
      localStorage.setItem(key, JSON.stringify({ plants: value }));
      localStorage.setItem('plant-care-analytics-enabled-v1', 'false');
      sessionStorage.setItem('playwright-data-seeded', 'true');
    }
  }, { key: storageKey, value: plants });
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
  await expect(page.locator('#appVersionDisplay')).toHaveText('v1.4.0');
  await expect(page.locator('#addBtn')).toBeVisible();
  await expect(page.locator('#plantSearch')).toBeVisible();
  await expect(page.locator('#calendarViewBtn')).toBeVisible();
  expect(errors).toEqual([]);
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
  await seed(page, withLogs);
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
    appVersion: '1.4.0'
  });
  expect(payload.plants).toHaveLength(3);

  await page.locator('#menuBtn').click();
  await expect(page.locator('#backupStatus')).toContainText('最終保存');
  await expect(page.locator('#backupStatus')).toContainText('3株・履歴1件・写真1枚');
});

test('復元前に自動退避し、復元を取り消せる', async ({ page }) => {
  await seed(page, [plants[0]]);
  await page.goto('/');
  const incoming = {
    format: 'plant-care-log-backup',
    schemaVersion: 1,
    appVersion: '1.4.0',
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
