/** Letra na planilha → nome da conta contábil (paridade VBA / financeiroData.js). */
export const LETRA_PARA_CONTA = {
  A: 'Conta Escritório',
  B: 'Conta Trabalhos Extras',
  C: 'Conta Pessoal',
  D: 'Conta Veredas',
  N: 'Conta Não Identificados',
  E: 'Conta Compensação',
  F: 'Conta Fundos Investimentos',
  M: 'Conta Marcenaria',
  R: 'Conta Rachel',
  P: 'Conta Pessoa Jurídica',
  I: 'Conta Imóveis',
  J: 'Conta Julio',
  G: 'Geral',
};

/** Nº no consolidado → conta bancária (sem cartões). */
export const NUMERO_PARA_BANCO = {
  1: 'Itaú',
  2: 'Bradesco',
  3: 'BB',
  4: 'Sicoob',
  5: 'CEF',
  6: 'Itaú Poupança',
  9: 'LANÇ MANUAIS',
  18: 'LANÇ MANUAIS (2)',
  17: 'LANÇ EM DINHEIRO',
  10: 'Poupança Bradesco',
  11: 'Mercado Pago',
  12: 'CEF Poupança',
  13: 'Nubank',
  14: 'PicPay',
  15: 'PicPay Rachel',
  21: 'BTG',
  22: 'ITI',
  23: 'Itaú Empresas',
  24: 'BTG Banking',
  25: 'BTG (2)',
  26: 'CORA',
  27: 'BTG JA',
  28: 'BTG RACHEL',
  29: 'Sicoob VRV',
};

/**
 * Contas com extrato/elos na API ausentes da aba Conta Compensação da planilha legada.
 * BB (3) existe no consolidado mas não na Comp; 99 Pay (30) só na API.
 */
export const BANCOS_API_SEM_PLANILHA_COMP = {
  3: 'BB',
  30: '99 pay',
};

/** Nº no consolidado → cartão de crédito (extrato fatura). */
export const NUMERO_PARA_CARTAO = {
  7: 'Mastercard',
  8: 'Visa',
  16: 'Mastercard Sicoob',
  19: 'Mastercard Black',
  20: 'BTG Cartão',
};

export const BANCOS_IMPORT_PLANILHA = Object.values(NUMERO_PARA_BANCO);

export const CARTOES_IMPORT_PLANILHA = Object.values(NUMERO_PARA_CARTAO);

/** Nome da aba Excel (quando coincide) → banco. */
export const NOME_ABA_PARA_BANCO = Object.fromEntries(
  Object.values(NUMERO_PARA_BANCO).map((nome) => [nome, nome]),
);

export const NOME_ABA_PARA_CARTAO = Object.fromEntries(
  Object.values(NUMERO_PARA_CARTAO).map((nome) => [nome, nome]),
);

/** União legado (relatórios que ainda usam número único). */
export const NUMERO_PARA_INSTITUICAO = { ...NUMERO_PARA_BANCO, ...NUMERO_PARA_CARTAO };
