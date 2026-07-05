import { LETRA_TO_CONTA, ORDEM_LETRA_CONTA_BASE } from '../../../data/financeiroData.js';

export const FINANCEIRO_CARTAO_IMPORTADO = 'financeiro:cartao-importado';

export const ETAPAS = {
  IMPORTADO: 'IMPORTADO',
  CLASSIFICADO: 'CLASSIFICADO',
  COMPENSADO: 'COMPENSADO',
  VINCULADO: 'VINCULADO',
  FECHADO: 'FECHADO',
};

export const ETAPA_LABELS = {
  IMPORTADO: 'Pendente',
  CLASSIFICADO: 'Classificado',
  COMPENSADO: 'Compensado',
  VINCULADO: 'Vinculado',
  FECHADO: 'Fechado',
};

/** Etapas do workflow exibidas no filtro de extratos (banco, cartão, consolidado). */
export const ETAPAS_FILTRO_WORKFLOW = [
  ETAPAS.IMPORTADO,
  ETAPAS.CLASSIFICADO,
  ETAPAS.COMPENSADO,
  ETAPAS.VINCULADO,
  ETAPAS.FECHADO,
];

export const CONFIANCA = {
  ALTA: 'ALTA',
  MEDIA: 'MEDIA',
  BAIXA: 'BAIXA',
};

export const INBOX_TIPOS = {
  classificar: 'classificar',
  compensar: 'compensar',
  fatura: 'fatura',
  recorrencia: 'recorrencia',
  semelhantes: 'semelhantes',
  inconsistentes: 'inconsistentes',
  total: 'total',
};

/** Rótulo do filtro unificado (bancos + cartões) no inbox. */
export const INBOX_FILTRO_TODAS_CONTAS = 'Bancos e cartões';

/** Prioridade de exibição no inbox (menor = mais prioritário). */
export const INBOX_PRIORIDADE = {
  recorrencia: 1,
  compensarInterbancario: 2,
  classificarAlta: 3,
  fatura: 4,
  classificarMedia: 5,
  compensarMesmoBanco: 6,
  classificarSemSugestao: 7,
  inconsistentes: 8,
};

export const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000];

const PAGE_SIZE_MIN = PAGE_SIZE_OPTIONS[0];
const PAGE_SIZE_MAX = PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1];

export function clampFinanceiroPageSize(size) {
  const n = Number(size);
  if (!Number.isFinite(n)) return 100;
  return PAGE_SIZE_OPTIONS.includes(n) ? n : Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, Math.round(n)));
}

export const CONTAS_LETRAS = ORDEM_LETRA_CONTA_BASE;

export { LETRA_TO_CONTA };

export function contaCssVar(codigo) {
  const c = String(codigo ?? 'n').trim().toLowerCase();
  return `--fin-conta-${c}`;
}

export function etapaCssVar(etapa) {
  const e = String(etapa ?? 'importado').trim().toLowerCase();
  return `--fin-etapa-${e}`;
}

export function nomeContaPorLetra(letra) {
  return LETRA_TO_CONTA[String(letra ?? '').trim().toUpperCase()] ?? null;
}
