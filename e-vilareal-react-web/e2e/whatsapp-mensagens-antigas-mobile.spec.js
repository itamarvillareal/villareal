import { test, expect, devices } from '@playwright/test';

/**
 * Regressão mobile: «Carregar mensagens anteriores» na inbox WhatsApp.
 *
 * Cenário real relatado: no celular, ao tocar em «Carregar mensagens
 * anteriores», um efeito disparava scrollToBottom() assim que o load-more
 * terminava, devolvendo a tela ao fim da conversa — parecia que as mensagens
 * antigas nunca carregavam. A correção preserva a posição de leitura após o
 * prepend e só rola para o fim quando a ÚLTIMA mensagem muda.
 */

test.use({ ...devices['Pixel 7'] });

const PHONE = '5562999990000';
const PAGE_SIZE = 20;
const TOTAL = 40;

function mensagem(i) {
  const base = Date.UTC(2026, 5, 1, 12, 0, 0);
  return {
    id: i,
    phoneNumber: PHONE,
    contactName: 'Contato Teste',
    direction: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND',
    messageType: 'TEXT',
    content: `Mensagem numero ${i}`,
    createdAt: new Date(base + i * 60_000).toISOString(),
  };
}

/** Backend devolve mais recentes primeiro (createdAt DESC). */
function paginaMensagens(page) {
  const start = TOTAL - page * PAGE_SIZE; // page 0 → 40..21; page 1 → 20..1
  const content = [];
  for (let i = start; i > Math.max(start - PAGE_SIZE, 0); i -= 1) {
    content.push(mensagem(i));
  }
  return {
    content,
    totalPages: Math.ceil(TOTAL / PAGE_SIZE),
    totalElements: TOTAL,
    number: page,
    size: PAGE_SIZE,
  };
}

async function instalarMocksApi(page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;

    if (path === '/api/whatsapp/messages') {
      const pageNum = Number(url.searchParams.get('page') ?? 0);
      await route.fulfill({ json: paginaMensagens(pageNum) });
      return;
    }

    if (path === '/api/whatsapp/conversations') {
      await route.fulfill({
        json: {
          content: [
            {
              phoneNumber: PHONE,
              contactName: 'Contato Teste',
              lastMessagePreview: `Mensagem numero ${TOTAL}`,
              lastMessageType: 'TEXT',
              lastMessageDirection: 'INBOUND',
              lastMessageAt: mensagem(TOTAL).createdAt,
              unreadCount: 0,
              pinned: false,
            },
          ],
          totalPages: 1,
          totalElements: 1,
        },
      });
      return;
    }

    if (path === '/api/whatsapp/conversations/context') {
      await route.fulfill({ json: [] });
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
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': ok\n\n',
      });
      return;
    }

    // Demais endpoints: resposta neutra.
    await route.fulfill({ json: {} });
  });
}

async function abrirConversa(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('vilareal.accessToken', 'token-teste-e2e');
    window.localStorage.setItem('vilareal.auth.lastActivity.v1', String(Date.now()));
  });
  await page.goto('/whatsapp/conversas', { waitUntil: 'domcontentloaded' });
  // 1º acesso em dev: Vite ainda compila o chunk do WhatsApp.
  const item = page.getByRole('button', { name: /Contato Teste/ });
  await expect(item).toBeVisible({ timeout: 90000 });
  await item.click();
}

/** Bolha na thread (id msg-N do ChatBubble) — não confunde com o preview da lista. */
function bolha(page, i) {
  return page.locator(`#msg-${i}`);
}

async function estaNoViewport(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });
}

test('celular: carregar mensagens anteriores mantém a posição de leitura (sem pular para o fim)', async ({ page }) => {
  await instalarMocksApi(page);
  await abrirConversa(page);

  await expect(bolha(page, TOTAL)).toBeVisible({ timeout: 30000 });
  // Página 1 (antigas) ainda não carregada.
  await expect(bolha(page, PAGE_SIZE)).toHaveCount(0);

  const loadMore = page.getByRole('button', { name: /carregar mensagens anteriores/i });
  // O botão fica no topo do histórico: rola até ele (gesto do usuário no celular).
  await loadMore.scrollIntoViewIfNeeded();
  await expect(loadMore).toBeVisible();
  await loadMore.click();

  // As mensagens antigas entram no DOM…
  await expect(bolha(page, 1)).toBeAttached({ timeout: 15000 });

  // …e a tela NÃO pode saltar para o fim da conversa (bug original: um
  // scrollToBottom disparava após o load-more). Espera cobrir o smooth scroll.
  await page.waitForTimeout(1500);

  expect(
    await estaNoViewport(bolha(page, TOTAL)),
    'a última mensagem não pode estar visível — a tela saltou para o fim',
  ).toBe(false);

  // A posição de leitura foi preservada: a mensagem mais antiga da página 0
  // (que estava logo abaixo do botão) continua no viewport.
  expect(
    await estaNoViewport(bolha(page, PAGE_SIZE + 1)),
    'a posição de leitura deve ser preservada após o prepend',
  ).toBe(true);

  // Sem mais páginas: botão some.
  await expect(loadMore).toHaveCount(0);
});
