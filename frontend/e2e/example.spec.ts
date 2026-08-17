import { test, expect } from '@playwright/test';

test('página inicial carrega e exibe o título Wave Burger', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Wave Burger' })).toBeVisible();
});
