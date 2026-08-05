import { test, expect } from '@playwright/test';

const viewports = [
  { width: 320, height: 800, name: 'Mobile Mini' },
  { width: 390, height: 844, name: 'iPhone 12/13' },
  { width: 768, height: 1024, name: 'iPad' },
  { width: 1440, height: 900, name: 'Desktop' },
];

test.describe('Responsiveness', () => {
  for (const vp of viewports) {
    test(`should render correctly on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:8080/');

      // Check for horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(overflow).toBe(false);

      // Check visibility of key elements
      if (vp.width < 768) {
        // Mobile menu should be available
        const menuBtn = page.locator('button[aria-label="Menu"]');
        await expect(menuBtn).toBeVisible();
      } else {
        // Desktop nav
        const logo = page.locator('img[alt="GreenFutebol"]');
        await expect(logo).toBeVisible();
      }
    });
  }
});
