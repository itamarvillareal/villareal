import { test, expect, devices } from '@playwright/test';

/**
 * Regressão mobile: marcar «Aceitar pagamento» em Cálculos no celular.
 *
 * Cenário real relatado: no celular (rede mais lenta), o utilizador toca no
 * checkbox antes de o GET individual da rodada terminar. O patch de aceite era
 * descartado (rodada ainda não existia no estado) e, quando o GET chegava com
 * `parcelamentoAceito=false` do servidor, o checkbox desmarcava sozinho.
 */

test.use({ ...devices['Pixel 7'] });

const CHAVE = '00000001:35:0';

function rodadaServidor() {
  const linhaVazia = {
    dataVencimento: '',
    valorInicial: '',
    atualizacaoMonetaria: '',
    diasAtraso: '',
    juros: '',
    multa: '',
    honorarios: '',
    total: '',
    descricaoValor: '',
  };
  const titulos = Array.from({ length: 60 }, () => ({ ...linhaVazia }));
  titulos[0] = {
    ...linhaVazia,
    dataVencimento: '15/02/2026',
    valorInicial: '100,00',
    total: '110,00',
  };
  titulos[1] = {
    ...linhaVazia,
    dataVencimento: '15/03/2026',
    valorInicial: '218,48',
    total: '245,54',
  };
  return {
    pagina: 1,
    paginaParcelamento: 1,
    titulos,
    parcelas: [],
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    entradaParcelamentoModo: 'nenhuma',
    entradaParcelamentoValor: '',
    entradaParcelamentoPercentual: '',
    entradaParcelamentoDataVenc: '',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: { autor: 'CONDOMINIO TESTE', reu: 'FULANO', unidade: '' },
    honorariosDataRecebimento: {},
    parcelamentoAceito: false,
    panelConfig: null,
  };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ atrasoRodadaMs?: number }} opts
 * @returns {{ puts: Array<{ url: string, body: any }> }}
 */
async function instalarMocksApi(page, { atrasoRodadaMs = 0 } = {}) {
  const puts = [];

  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path === '/api/calculos/rodadas/resumo') {
      await route.fulfill({
        json: { rodadas: [{ chave: CHAVE, parcelamentoAceito: false }] },
      });
      return;
    }

    if (path === '/api/calculos/rodadas/00000001/35/0') {
      if (method === 'GET') {
        if (atrasoRodadaMs > 0) await new Promise((r) => setTimeout(r, atrasoRodadaMs));
        await route.fulfill({ json: rodadaServidor() });
        return;
      }
      if (method === 'PUT') {
        const body = req.postDataJSON();
        puts.push({ url: req.url(), body });
        await route.fulfill({ json: body });
        return;
      }
    }

    // Demais endpoints: resposta neutra.
    await route.fulfill({ json: {} });
  });

  return { puts };
}

async function abrirCalculos(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('vilareal.accessToken', 'token-teste-e2e');
    window.localStorage.setItem('vilareal.auth.lastActivity.v1', String(Date.now()));
  });

  const dialogs = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.accept();
  });

  await page.goto('/calculos', { waitUntil: 'domcontentloaded' });
  return dialogs;
}

test('celular: aceitar pagamento com rodada já carregada persiste (PUT) e mantém o checkbox', async ({ page }) => {
  const { puts } = await instalarMocksApi(page, { atrasoRodadaMs: 0 });
  const dialogs = await abrirCalculos(page);

  const checkbox = page.getByRole('checkbox', { name: /aceitar pagamento/i });
  // 1º acesso em dev: Vite ainda compila o chunk de Cálculos.
  await expect(checkbox).toBeVisible({ timeout: 90000 });

  // Espera a rodada do servidor estar refletida na grade (soma dos valores iniciais).
  await expect(page.locator('body')).toContainText('R$ 318,48', { timeout: 15000 });
  await page.waitForTimeout(800);

  await checkbox.check();
  expect(dialogs.length, 'confirm() deve ter sido mostrado').toBeGreaterThan(0);

  await expect(checkbox).toBeChecked();
  await page.waitForTimeout(2500);
  await expect(checkbox, 'checkbox não pode desmarcar sozinho').toBeChecked();

  expect(
    puts.some((p) => p.body?.parcelamentoAceito === true),
    `deve haver PUT com parcelamentoAceito=true (PUTs: ${JSON.stringify(puts.map((p) => p.body?.parcelamentoAceito))})`
  ).toBeTruthy();
});

test('celular (rede lenta): aceitar pagamento antes do GET da rodada terminar não pode ser perdido', async ({ page }) => {
  const { puts } = await instalarMocksApi(page, { atrasoRodadaMs: 4000 });
  const dialogs = await abrirCalculos(page);

  const checkbox = page.getByRole('checkbox', { name: /aceitar pagamento/i });
  // 1º acesso em dev: Vite ainda compila o chunk de Cálculos.
  await expect(checkbox).toBeVisible({ timeout: 90000 });

  // Enquanto o GET individual da rodada não responde (rede lenta de celular),
  // o checkbox fica desativado — o toque não pode ser engolido silenciosamente.
  await expect(checkbox).toBeDisabled();

  // `check()` espera o checkbox ficar acionável (GET concluído) e então marca.
  await checkbox.check({ timeout: 15000 });
  expect(dialogs.length, 'confirm() deve ter sido mostrado').toBeGreaterThan(0);
  await expect(checkbox).toBeChecked();

  // Depois de o aceite ser aplicado, nada pode desmarcá-lo sozinho.
  await page.waitForTimeout(3000);

  await expect(checkbox, 'checkbox não pode desmarcar sozinho').toBeChecked();
  expect(
    puts.some((p) => p.body?.parcelamentoAceito === true),
    `deve haver PUT com parcelamentoAceito=true (PUTs: ${JSON.stringify(puts.map((p) => p.body?.parcelamentoAceito))})`
  ).toBeTruthy();
});
