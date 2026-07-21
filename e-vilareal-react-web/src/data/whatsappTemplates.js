export const WHATSAPP_TEMPLATES = [
  {
    value: 'lembrete_audiencia',
    label: 'Lembrete de Audiência',
    params: ['Nome do destinatário', 'Processo + cliente + parte autora', 'Data/hora'],
  },
  {
    value: 'lembrete_audiencia_link',
    label: 'Lembrete de Audiência (com link)',
    params: ['Nome do destinatário', 'Processo + cliente + parte autora', 'Data/hora', 'Link da reunião'],
  },
  {
    value: 'atualizacao_processo',
    label: 'Atualização de Processo',
    params: ['Nome do cliente', 'Nº do processo', 'Movimentação'],
  },
  {
    value: 'boas_vindas_cliente',
    label: 'Boas-vindas',
    params: ['Nome do cliente'],
  },
  {
    value: 'cobranca_pagamento',
    label: 'Cobrança de pagamento',
    params: ['Nome', 'Unidade', 'Condomínio'],
  },
];

export function findWhatsAppTemplate(value) {
  return WHATSAPP_TEMPLATES.find((t) => t.value === value) ?? null;
}
