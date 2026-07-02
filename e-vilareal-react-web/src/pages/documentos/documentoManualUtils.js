/** Texto visível dentro de HTML de seção (ignora tags vazias). */
export function htmlSecaoTemTexto(html) {
  const plain = String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0;
}

function aplicarEditoresDom(base, root) {
  if (!base) return base;
  const container =
    root ??
    (typeof document !== 'undefined' ? document.querySelector('[data-documento-editores]') : null);
  if (!container) return base;

  let next = { ...base };
  const editors = container.querySelectorAll('[data-html-editor]');

  for (const el of editors) {
    const key = el.getAttribute('data-html-editor');
    if (!key) continue;
    const html = el.innerHTML;

    if (key === 'preambulo') {
      next = { ...next, preambulo: html };
      continue;
    }

    const secaoMatch = key.match(/^secao-(\d+)-conteudo$/);
    if (secaoMatch) {
      const index = Number(secaoMatch[1]);
      const secoes = [...(next.secoes || [])];
      if (secoes[index]) {
        secoes[index] = { ...secoes[index], conteudo: html };
        next = { ...next, secoes };
      }
    }
  }

  return next;
}

/** Lê HTML direto dos editores antes de montar payload (formulário manual). */
export function sincronizarFormManualComEditores(formManual, root) {
  return aplicarEditoresDom(formManual, root);
}

export function normalizarPayloadManualPdf(payload) {
  if (!payload) return payload;
  const secoes = (payload.secoes || [])
    .map((s) => ({
      titulo: String(s?.titulo ?? '').trim(),
      conteudo: String(s?.conteudo ?? '').trim(),
    }))
    .filter((s) => s.titulo && htmlSecaoTemTexto(s.conteudo));

  const pedidos = (payload.pedidos || [])
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);

  return {
    ...payload,
    enderecamento: String(payload.enderecamento ?? '').trim(),
    numeroProcesso: payload.numeroProcesso ? String(payload.numeroProcesso).trim() : null,
    preambulo: String(payload.preambulo ?? '').trim(),
    secoes,
    pedidos,
  };
}

/** Garante que editores contentEditable gravem o HTML antes de gerar PDF. */
export function flushEditoresAtivosDocumento() {
  if (typeof document === 'undefined') return;
  const ae = document.activeElement;
  if (ae instanceof HTMLElement) {
    ae.blur();
  }
}

/** Mescla HTML dos editores visíveis no payload e normaliza para PDF. */
export function coletarPayloadManualParaPdf(payload, root) {
  const merged = aplicarEditoresDom(payload, root);
  flushEditoresAtivosDocumento();
  return normalizarPayloadManualPdf(merged);
}

/** @internal exposto para testes unitários */
export function aplicarEditoresDomParaTeste(base, root) {
  return aplicarEditoresDom(base, root);
}
