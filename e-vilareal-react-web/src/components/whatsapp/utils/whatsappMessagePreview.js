import { resumoContactCardContent } from './whatsappContactCard.js';
import { resumoInteractiveReplyContent } from './whatsappInteractiveReply.js';
import { resumoLocationContent } from './whatsappLocation.js';
import { resumoReactionContent } from './whatsappReaction.js';

/**
 * Resumo legível de uma mensagem WhatsApp para listas, toasts e notificações.
 *
 * @param {string|undefined|null} messageType
 * @param {string|undefined|null} content
 * @returns {string}
 */
export function resumoWhatsAppMessageContent(messageType, content) {
  const type = String(messageType ?? '').toUpperCase();
  switch (type) {
    case 'IMAGE':
      return '📷 Imagem';
    case 'DOCUMENT':
      return '📎 Documento';
    case 'AUDIO':
      return '🎤 Áudio';
    case 'VIDEO':
      return '🎬 Vídeo';
    case 'CONTACT':
      return `👤 ${resumoContactCardContent(content)}`;
    case 'LOCATION':
      return resumoLocationContent(content);
    case 'INTERACTIVE':
    case 'BUTTON':
      return resumoInteractiveReplyContent(content);
    case 'REACTION':
      return resumoReactionContent(content);
    default: {
      const raw = String(content ?? '').trim();
      return raw || 'Nova mensagem';
    }
  }
}
