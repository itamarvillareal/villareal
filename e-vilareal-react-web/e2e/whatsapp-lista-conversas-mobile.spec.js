import { test, expect, devices } from '@playwright/test';

/**
 * Regressão mobile: rolar a lista de conversas do WhatsApp no celular.
 *
 * Cenário real relatado: no celular, a lista mostrava só as primeiras
 * conversas e a tela não rolava para ver as mais antigas. Causa: no layout
 * mobile o <aside> crescia com o conteúdo (sem altura definida) e o painel
 * pai (overflow-hidden) cortava o excesso — a lista interna (overflow-y-auto)
 * nunca rolava, e nenhum ancestral rolava no lugar dela.
 */

test.use({ ...devices['Pixel 7'] });

const CONVERSATIONS_PAGE_SIZE = 50;
const TOTAL_CONVERSAS = 60;

function conversa(i) {
  const base = Date.UTC(2026, 5, 30, 12, 0, 0);
  const phone = `55629${String(90000000 + i)}`;
  return {
    phoneNumber: phone,
    contactName: `Contato ${String(i).padStart(2, '0')}`,
    lastMessagePreview: `Última mensagem da conversa ${i}`,
    lastMessageType: 'TEXT',
    lastMessageDirection: 'INBOUND',
    // i menor = conversa mais recente (backend ordena por recência desc)
    lastMessageAt: new Date(base - i * 3_600_000).toISOString(),
    unreadCount: 0,
    pinned: false,
  };
}

/** Página de conversas como o backend: mais recentes primeiro. */
function paginaConversas(page) {
  const start = page * CONVERSATIONS_PAGE_SIZE + 1;
  const content = [];
  for (let i = start; i <= Math.min(start + CONVERSATIONS_PAGE_SIZE - 1, TOTAL_CONVERSAS); i += 1) {
    content.push(conversa(i));
  }
  return {
    content,
    totalPages: Math.ceil(TOTAL_CONVERSAS / CONVERSATIONS_PAGE_SIZE),
    totalElements: TOTAL_CONVERSAS,
    number: page,
    size: CONVERSATIONS_PAGE_SIZE,
  };
}

async function instalarMocksApi(page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/whatsapp/conversations') {
      const pageNum = Number(url.searchParams.get('page') ?? 0);
      await route.fulfill({ json: paginaConversas(pageNum) });
      return;
    }

    if (path === '/api/whatsapp/grupos') {
      await route.fulfill({ json: [] });
      return;
    }

    if (path === '/api/whatsapp/conversations/unread-total') {
      await route.fulfill({ json: { unreadConversations: 0 } });
      return;
    }

    if (path === '/api/whatsapp/notifications/stream') {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': ok\n\n' });
      return;
    }

    // Demais endpoints: resposta neutra.
    await route.fulfill({ json: {} });
  });
}

async function abrirLista(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('vilareal.accessToken', 'token-teste-e2e');
    window.localStorage.setItem('vilareal.auth.lastActivity.v1', String(Date.now()));
  });
  await page.goto('/whatsapp/conversas', { waitUntil: 'domcontentloaded' });
}

function itemConversa(page, i) {
  return page.getByText(`Contato ${String(i).padStart(2, '0')}`, { exact: true });
}

async function visivelNoViewport(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1;
  });
}

/**
 * Rola como o usuário (gesto de wheel sobre a região das conversas) até o alvo
 * ficar visível. NÃO usa scrollIntoViewIfNeeded: scroll programático move até
 * containers overflow-hidden, mascarando exatamente o bug relatado (o dedo
 * não rolava nada).
 */
async function rolarComGestoAte(page, locator, { maxGestos = 40 } = {}) {
  // Ponto do gesto: meio da janela VISÍVEL do container da lista (pai do ul),
  // interseccionada com o viewport — o ul em si cresce além do recorte.
  const containerLista = page.locator('ul.divide-y').first().locator('..');
  const viewport = page.viewportSize();
  for (let i = 0; i < maxGestos; i += 1) {
    if ((await locator.count()) > 0 && (await visivelNoViewport(locator))) return true;
    const box = await containerLista.boundingBox();
    const top = Math.max(box.y, 0);
    const bottom = Math.min(box.y + box.height, viewport.height);
    if (bottom <= top) return false;
    await page.mouse.move(box.x + box.width / 2, (top + bottom) / 2);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(50);
  }
  return (await locator.count()) > 0 && (await visivelNoViewport(locator));
}

test('celular: lista de conversas rola até as mais antigas e carrega a próxima página', async ({ page }) => {
  await instalarMocksApi(page);
  await abrirLista(page);

  // 1º acesso em dev: Vite ainda compila o chunk do WhatsApp.
  await expect(itemConversa(page, 1)).toBeVisible({ timeout: 90000 });
  await expect(itemConversa(page, CONVERSATIONS_PAGE_SIZE)).toBeAttached();

  // A última conversa da página 0 precisa ser alcançável com gesto de rolagem.
  expect(
    await rolarComGestoAte(page, itemConversa(page, CONVERSATIONS_PAGE_SIZE)),
    'a conversa mais antiga da página deve ficar visível ao rolar — antes, a lista era cortada e o gesto não rolava nada',
  ).toBe(true);

  // O botão de paginação também precisa ser alcançável e funcionar.
  const loadMore = page.getByRole('button', { name: /carregar conversas anteriores/i });
  expect(await rolarComGestoAte(page, loadMore), 'botão «Carregar conversas anteriores» alcançável').toBe(true);
  await loadMore.click();

  await expect(itemConversa(page, TOTAL_CONVERSAS)).toBeAttached({ timeout: 15000 });
  expect(
    await rolarComGestoAte(page, itemConversa(page, TOTAL_CONVERSAS)),
    'após carregar a página anterior, a conversa mais antiga deve ficar visível',
  ).toBe(true);
});
