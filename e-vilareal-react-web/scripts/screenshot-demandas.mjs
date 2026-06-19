import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', '..', 'screenshots-test');
mkdirSync(outDir, { recursive: true });

const base = process.env.VITE_URL || 'http://localhost:5174';
const api = 'http://localhost:8080';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  const loginRes = await fetch(`${api}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'itamar', senha: '123456' }),
  });
  const { accessToken } = await loginRes.json();

  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.evaluate((token) => {
    localStorage.setItem('vilareal.accessToken', token);
    sessionStorage.setItem(
      'vilareal.auth.usuarioLogado.v1',
      JSON.stringify({ id: '1', nome: 'Itamar', login: 'itamar', perfilId: 1 }),
    );
  }, accessToken);

  await page.goto(`${base}/imoveis/demandas`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1:has-text("Demandas")', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const path = join(outDir, 'demandas-tela.png');
  await page.screenshot({ path, fullPage: true });
  console.log('SCREENSHOT:', path);
} finally {
  await browser.close();
}
