import { test, expect } from '@playwright/test';

/**
 * Pré-requisito local: `npm run test:e2e:install` (Chromium).
 *
 * Fumaça: rotas principais montam sem erro de consola crítico.
 * Com `VITE_REQUIRE_API_AUTH=true`, a raiz pode redirecionar para /login — ambos são válidos.
 */
test.describe('Smoke rotas', () => {
  const rotas = ['/', '/pessoas', '/processos', '/financeiro', '/configuracoes', '/agenda'];

  for (const path of rotas) {
    test(`carrega ${path}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
      });

      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      await expect(page.locator('body')).toBeVisible();

      const noCrash =
        (await page.getByRole('heading', { name: /VilaReal/i }).count()) > 0 ||
        (await page.getByRole('navigation').count()) > 0 ||
        (await page.locator('main').count()) > 0;
      expect(noCrash).toBeTruthy();

      const fatal = errors.filter(
        (m) =>
          /ChunkLoadError|Failed to fetch dynamically imported module|Loading chunk \d+ failed/i.test(m)
      );
      expect(fatal, `Erros fatais: ${fatal.join('; ')}`).toHaveLength(0);
    });
  }
});
