const INBOX_DELETE_HINT =
  'Isso remove apenas da sua inbox no sistema. O contato continuará vendo no WhatsApp dele.';

export const WHATSAPP_DELETE_MESSAGE_CHOICE = {
  title: 'Apagar mensagem?',
  message:
    'Escolha se a mensagem some só da sua inbox no sistema ou também no WhatsApp do contato (apenas mensagens enviadas por você, até 48 horas).',
  cancelLabel: 'Cancelar',
  inboxLabel: 'Apagar da inbox',
  everyoneLabel: 'Apagar para todos',
  everyoneHint: 'Remove no histórico do sistema e tenta apagar no WhatsApp do contato.',
  everyoneDisabledHint:
    'Disponível só para mensagens enviadas por você (outbound), com ID do WhatsApp e dentro de 48 horas.',
};

/** @deprecated Preferir WHATSAPP_DELETE_MESSAGE_CHOICE no diálogo de escolha. */
export const WHATSAPP_DELETE_MESSAGE_CONFIRM = {
  title: 'Apagar da sua inbox?',
  message: `A mensagem sumirá do histórico aqui no sistema. ${INBOX_DELETE_HINT}`,
  confirmLabel: 'Apagar da inbox',
};

export const WHATSAPP_DELETE_CONVERSATION_CONFIRM = {
  title: 'Apagar conversa da inbox?',
  message: `Todo o histórico deste telefone sumirá da sua lista e do thread. ${INBOX_DELETE_HINT} Se chegar mensagem nova, a conversa volta a aparecer.`,
  confirmLabel: 'Apagar conversa',
};
