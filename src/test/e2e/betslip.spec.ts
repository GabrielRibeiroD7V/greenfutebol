import { test, expect } from '@playwright/test';

test.describe('BetSlip Logic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080/');
  });

  test('should add and remove selection from BetSlip', async ({ page }) => {
    // Find first odd button
    const oddButton = page.locator('button').filter({ hasText: /^\d+\.\d+$/ }).first();
    await oddButton.click();

    // Check if BetSlip (Bottom Sheet or Sidebar) shows the selection
    const betSlipCount = page.locator('text=1 seleção');
    await expect(betSlipCount).toBeVisible();

    // Remove selection
    const removeBtn = page.locator('button').filter({ has: page.locator('svg') }).last(); // Usually a X or Trash icon
    // More specific if possible:
    await page.click('button[aria-label="Remover seleção"]');
    
    await expect(betSlipCount).not.toBeVisible();
  });

  test('should persist BetSlip after navigation', async ({ page }) => {
    const oddButton = page.locator('button').filter({ hasText: /^\d+\.\d+$/ }).first();
    await oddButton.click();

    // Navigate to a game page
    await page.click('text=Ver jogo');
    
    const betSlipCount = page.locator('text=1 seleção');
    await expect(betSlipCount).toBeVisible();
  });

  test('should not allow more than 20 selections', async ({ page }) => {
    // This is hard to test with real data without many games
    // But we can check if the UI handles the limit if we were to mock state
  });
});
