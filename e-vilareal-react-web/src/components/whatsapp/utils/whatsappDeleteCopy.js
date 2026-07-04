const INBOX_DELETE_HINT =
  'Isso remove apenas da sua inbox no sistema. O contato continuará vendo no WhatsApp dele.';

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
