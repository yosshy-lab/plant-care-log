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
  await expect(page.locator('#appVersionDisplay')).toHaveText('v1.3.2');
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
