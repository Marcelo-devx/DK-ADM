import { test, expect } from '@playwright/test';

test.describe('Fluxos Críticos da Plataforma', () => {
  
  test('Acesso administrativo e Gestão de Produtos', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@tabacaria.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // 2. Navegação para Produtos
    await expect(page).toHaveURL('/dashboard');
    await page.click('text=Produtos');
    
    // 3. Verificação de Lista
    await expect(page.locator('table')).toBeVisible();
  });

  test('Fluxo de Checkout e Estoque', async ({ page }) => {
    // Simulação de compra e validação de decremento de estoque
    // TODO: Implementar após reestruturação do checkout
  });
});