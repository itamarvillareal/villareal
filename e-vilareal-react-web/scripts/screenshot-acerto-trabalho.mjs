/**
 * Valida a tela de trabalho "Acerto do Cliente" (Etapas 5/5b) com o cliente 729 (SE77E):
 * visão por processo, aba lançamentos paginada e Ficha do Acerto.
 * Uso: node scripts/screenshot-acerto-trabalho.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const OUT = '../screenshots-test';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text());
});

await page.goto(`${BASE}/login`);
await page.fill('input[placeholder="Digite o usuário"]', 'itamar');
await page.fill('input[placeholder="Digite a senha"]', '123456');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 20000 });

const t0 = Date.now();
await page.goto(`${BASE}/financeiro/acerto-cliente`);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/acerto5-1-inicial.png` });

const card = page.getByText('SE77E TELECOM', { exact: false }).first();
if (!(await card.count())) {
  console.log('FALHA: cliente SE77E não encontrado na lista');
  await browser.close();
  process.exit(1);
}
const t1 = Date.now();
await card.click();
// espera a visão por processo renderizar linhas
await page.waitForSelector('table tbody tr', { timeout: 30000 });
console.log(`tempo até render da visão por processo: ${Date.now() - t1}ms (página total ${Date.now() - t0}ms)`);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/acerto5-2-processos.png`, fullPage: false });

// expande o primeiro processo
const primeiraLinha = page.locator('main table tbody tr').first();
await primeiraLinha.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/acerto5-3-processo-expandido.png` });

// aba Lançamentos
await page.getByRole('button', { name: 'Lançamentos', exact: true }).click();
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/acerto5-4-lancamentos.png` });

// filtro só pendentes
const chk = page.getByText('só pendentes', { exact: true });
if (await chk.count()) {
  await chk.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/acerto5-5-so-pendentes.png` });
}

// modo de impressão (visão do cliente)
await page.getByRole('button', { name: /imprimir \(cliente\)/i }).click();
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/acerto5-6-impressao.png` });
await page.getByRole('button', { name: 'Fechar', exact: true }).click();
await page.waitForTimeout(1000);

console.log('screenshots salvos em', OUT);
await browser.close();
