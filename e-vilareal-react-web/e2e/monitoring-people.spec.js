import { test, expect } from '@playwright/test';

test.describe('Monitoramento de Pessoas', () => {
  test('carrega título, abas e Atualizar sem banner de Erro 500', async ({ page }) => {
    await page.goto('/processos/monitoramento');

    await expect(page.getByRole('heading', { name: /Monitoramento de Pessoas/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: /Monitorados/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Candidatos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Atualizar/i })).toBeVisible();

    await page.getByRole('button', { name: /Atualizar/i }).click();
    await expect(page.getByText(/Erro 500/i)).toHaveCount(0);

    await page.getByRole('button', { name: /^Candidatos/i }).click();
    await page.getByRole('button', { name: /^Monitorados/i }).click();
    await expect(page.getByText(/Erro 500/i)).toHaveCount(0);
  });
});
