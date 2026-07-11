/**
 * Captura telas da CONTA ZERO (conta 19) para validação visual:
 * extrato com alerta de pendências e relatório Acerto do Cliente.
 * Uso: node scripts/screenshot-conta-zero.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const OUT = '../screenshots-test';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

// login
await page.goto(`${BASE}/login`);
await page.fill('input[placeholder="Digite o usuário"]', 'itamar');
await page.fill('input[placeholder="Digite a senha"]', '123456');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 20000 });

// extrato da conta 19
await page.goto(`${BASE}/financeiro/extrato?banco=19`);
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/conta-zero-1-extrato.png`, fullPage: false });

// relatório Acerto do Cliente
await page.goto(`${BASE}/financeiro/acerto-cliente`);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/conta-zero-2-acerto-inicial.png`, fullPage: false });

// clica no card do cliente SE77E
const card = page.getByText('SE77E TELECOM', { exact: false }).first();
if (await card.count()) {
  await card.click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${OUT}/conta-zero-3-acerto-interno.png`, fullPage: false });

  // alterna para visão do cliente
  const toggle = page.getByRole('button', { name: /visão do cliente/i }).first();
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/conta-zero-4-acerto-visao-cliente.png`, fullPage: false });
  }
}

console.log('screenshots salvos em', OUT);
await browser.close();
