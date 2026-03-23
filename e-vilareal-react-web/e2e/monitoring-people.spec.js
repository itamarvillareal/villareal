import { test, expect } from '@playwright/test';

const MOCK_KEY = 'vilareal:cadastro-pessoas:mock-marcado-monitoramento:v1';

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

  test('lista mock: Remover após confirmar', async ({ page }) => {
    await page.addInitScript((key) => {
      try {
        const o = {};
        o['1'] = true;
        o['2'] = true;
        localStorage.setItem(key, JSON.stringify(o));
      } catch {
        /* ignore */
      }
    }, MOCK_KEY);

    await page.goto('/processos/monitoramento');
    await expect(page.getByRole('heading', { name: /Monitoramento de Pessoas/i })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByText(/A C COMERCIO DE PISCINAS LTDA/i)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /^Remover$/ }).first().click();

    await expect(page.getByText(/A C COMERCIO DE PISCINAS LTDA/i)).not.toBeVisible();
  });
});
