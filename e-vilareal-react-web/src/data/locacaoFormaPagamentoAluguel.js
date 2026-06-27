/** Forma de pagamento do aluguel na Cláusula 3ª do contrato de locação. */
export const FORMA_PAGAMENTO_ALUGUEL_DEPOSITO_TED = 'DEPOSITO_TED';
export const FORMA_PAGAMENTO_ALUGUEL_BOLETO = 'BOLETO';

export const FORMA_PAGAMENTO_ALUGUEL_PADRAO = FORMA_PAGAMENTO_ALUGUEL_DEPOSITO_TED;

export const FORMAS_PAGAMENTO_ALUGUEL = [
  {
    id: FORMA_PAGAMENTO_ALUGUEL_DEPOSITO_TED,
    label: 'Depósito, TED ou transferência',
    descricao: 'Conta do administrador do locador (Itaú / PIX)',
  },
  {
    id: FORMA_PAGAMENTO_ALUGUEL_BOLETO,
    label: 'Boletos',
    descricao: 'Boletos já disponibilizados aos locatários',
  },
];

export function normalizarFormaPagamentoAluguel(valor) {
  const v = String(valor ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (v === FORMA_PAGAMENTO_ALUGUEL_BOLETO || v === 'BOLETO' || v === 'BOLETOS') {
    return FORMA_PAGAMENTO_ALUGUEL_BOLETO;
  }
  return FORMA_PAGAMENTO_ALUGUEL_DEPOSITO_TED;
}
