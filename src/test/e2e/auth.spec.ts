import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const testPhone = `679${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPass = 'Test123456';

  test('should fail with invalid phone', async ({ page }) => {
    await page.goto('http://localhost:8080/cadastro');
    await page.fill('input[name="phone"]', '123');
    await page.fill('input[name="password"]', testPass);
    await page.fill('input[name="confirmPassword"]', testPass);
    await page.click('button[type="submit"]');
    
    // Check for validation error - assuming it uses standard HTML validation or custom message
    const error = page.locator('text=Telefone inválido');
    await expect(error).toBeVisible();
  });

  test('should fail with short password', async ({ page }) => {
    await page.goto('http://localhost:8080/cadastro');
    await page.fill('input[name="phone"]', testPhone);
    await page.fill('input[name="password"]', '123');
    await page.fill('input[name="confirmPassword"]', '123');
    await page.click('button[type="submit"]');
    
    const error = page.locator('text=Senha deve ter no mínimo 6 caracteres');
    await expect(error).toBeVisible();
  });

  test('should fail if passwords do not match', async ({ page }) => {
    await page.goto('http://localhost:8080/cadastro');
    await page.fill('input[name="phone"]', testPhone);
    await page.fill('input[name="password"]', testPass);
    await page.fill('input[name="confirmPassword"]', 'different');
    await page.click('button[type="submit"]');
    
    const error = page.locator('text=As senhas não coincidem');
    await expect(error).toBeVisible();
  });

  // Note: Real registration/login would require a running Supabase instance or mock
  // We'll skip real auth in E2E unless it's a test environment with a clean DB
});

test.describe('Protected Routes and Navigation', () => {
  test('should redirect unauthenticated user to login from /meus-bilhetes', async ({ page }) => {
    await page.goto('http://localhost:8080/meus-bilhetes');
    await expect(page).toHaveURL(/.*\/auth|.*\/login/);
  });

  test('admin route should be inaccessible to anonymous', async ({ page }) => {
    await page.goto('http://localhost:8080/admin');
    // Depending on implementation, might redirect to home or login
    await expect(page.url()).not.toContain('/admin');
  });
});
