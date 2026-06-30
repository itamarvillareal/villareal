/** Detecta índices de parâmetros {{1}}, {{2}}, … no corpo do template. */
export function detectTemplateParameters(bodyText) {
  if (!bodyText) return [];
  const matches = [...String(bodyText).matchAll(/\{\{(\d+)\}\}/g)];
  const indices = [...new Set(matches.map((m) => Number(m[1])))].sort((a, b) => a - b);
  return indices;
}

/** Substitui {{N}} pelos valores de exemplo para preview. */
export function fillTemplatePreview(bodyText, exampleValues) {
  if (!bodyText) return '';
  let result = bodyText;
  detectTemplateParameters(bodyText).forEach((index, i) => {
    const value = exampleValues[i] ?? `{{${index}}}`;
    result = result.replaceAll(`{{${index}}}`, value);
  });
  return result;
}

/** Valida nome de template Meta (minúsculas, números, underscore). */
export function isValidTemplateName(name) {
  return /^[a-z0-9_]+$/.test(String(name ?? '').trim());
}

/** Templates padrão da Meta que não podem ser excluídos. */
export function isProtectedWhatsAppTemplate(name) {
  return String(name ?? '').trim().toLowerCase() === 'hello_world';
}

/** Converte DTO da API para formato usado nos selects locais. */
export function mapApiTemplateToLocal(dto) {
  const count = Number(dto?.parameterCount ?? 0);
  const params = Array.from({ length: count }, (_, i) => `Parâmetro {{${i + 1}}}`);
  const name = dto?.name ?? '';
  return {
    value: name,
    label: name.replace(/_/g, ' '),
    params,
    bodyText: dto?.bodyText ?? '',
    status: dto?.status ?? '',
    category: dto?.category ?? '',
    id: dto?.id ?? '',
    exampleValues: dto?.exampleValues ?? [],
  };
}

export const FREE_TEXT_WINDOW_HINT =
  'Texto livre: funciona apenas dentro da janela de 24h do cliente';

export const FREE_TEXT_WINDOW_BANNER =
  'Mensagens de texto livre só são entregues se o cliente já enviou mensagem nas últimas 24 horas. Para iniciar uma conversa, use a aba Template.';

export const FREE_TEXT_DELIVERY_ERROR =
  'Mensagem não entregue. O cliente não tem janela de conversa aberta. Envie um template para iniciar a conversa.';
