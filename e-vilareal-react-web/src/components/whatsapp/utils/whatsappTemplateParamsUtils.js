import { findWhatsAppTemplate } from '../../../data/whatsappTemplates.js';

/** Última mensagem de saída enviada como template na thread. */
export function findLastOutboundTemplateMessage(messages) {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (String(msg?.direction ?? '').toUpperCase() === 'OUTBOUND' && msg?.templateName) {
      return msg;
    }
  }
  return null;
}

/**
 * Converte o `content` persistido no backend (parâmetros unidos por ", ")
 * de volta para o array enviado à Meta.
 */
export function parseStoredTemplateParams(content, template) {
  const raw = String(content ?? '').trim();
  const count = template?.params?.length ?? 0;
  if (!raw) return Array.from({ length: count }, () => '');
  if (count <= 1) return [raw];

  const parts = raw.split(', ').map((part) => part.trim());
  if (parts.length === count) return parts;
  if (parts.length > count) {
    return [...parts.slice(0, count - 1), parts.slice(count - 1).join(', ')];
  }
  const padded = [...parts];
  while (padded.length < count) padded.push('');
  return padded.slice(0, count);
}

export function resolveTemplateDefinition(templateName, templates) {
  const name = String(templateName ?? '').trim();
  if (!name) return null;
  return (templates ?? []).find((t) => t.value === name) ?? findWhatsAppTemplate(name);
}

export function buildTemplateParamsFromMessage(message, templates) {
  const templateName = String(message?.templateName ?? '').trim();
  if (!templateName) return { templateName: '', params: [] };
  const template = resolveTemplateDefinition(templateName, templates);
  const params = parseStoredTemplateParams(message?.content, template);
  return { templateName, params };
}
