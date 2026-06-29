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
    sendTemplate: sendWhatsAppTemplate,
    createSchedule: createWhatsAppSchedule,
    cancelSchedule: cancelWhatsAppSchedule,
  };
}
