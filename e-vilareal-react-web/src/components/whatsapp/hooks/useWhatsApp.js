import {
  cancelWhatsAppSchedule,
  createWhatsAppSchedule,
  getWhatsAppConversations,
  getWhatsAppMessages,
  getWhatsAppMessagesByCliente,
  getWhatsAppScheduled,
  getWhatsAppStats,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  sendWhatsAppMedia,
} from '../../../repositories/whatsappRepository.js';

/** Camada fina sobre o repositório — mesmo contrato pedido no prompt. */
export function useWhatsApp() {
  return {
    getStats: getWhatsAppStats,
    getConversations: getWhatsAppConversations,
    getMessages: getWhatsAppMessages,
    getMessagesByCliente: getWhatsAppMessagesByCliente,
    getScheduled: getWhatsAppScheduled,
    sendText: sendWhatsAppText,
    sendMedia: sendWhatsAppMedia,
    sendTemplate: sendWhatsAppTemplate,
    createSchedule: createWhatsAppSchedule,
    cancelSchedule: cancelWhatsAppSchedule,
  };
}
