/**
 * Lançamentos de teste no extrato CEF para Administração de Imóveis × Conta Corrente.
 * Usa o mesmo Cod. cliente / Proc. do `getImovelMock(1)` (código 901, proc. 21).
 */

import { getImovelMock } from './imoveisMockData.js';
import { TAG_ADM_ALUGUEL, TAG_ADM_REPASSE, TAG_ADM_DESPESA } from './imoveisAdministracaoFinanceiro.js';

export const PREFIXO_LANC_ADM_IMOVEL = 'admimovel-';

function lancBase({
  numero,
  data,
  descricao,
  valor,
  codCliente,
  proc,
  letra = 'I',
  descricaoDetalhada = '',
}) {
  return {
    letra,
    numero: String(numero),
    data,
    descricao,
    valor,
    saldo: 0,
    saldoDesc: '',
    descricaoDetalhada,
    categoria: '',
    codCliente: String(codCliente ?? ''),
    proc: String(proc ?? ''),
    dimensao: '',
    parcela: '',
    ref: '',
    eq: '',
  };
}

function parseDataSort(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBr ?? '').trim());
  if (!m) return 0;
  return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
}

function ordenarCef(list) {
  return [...list].sort((a, b) => {
    const da = parseDataSort(a.data);
    const db = parseDataSort(b.data);
    if (da !== db) return da - db;
    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
  });
}

function recomputeSaldoCef(list) {
  let saldo = 0;
  return list.map((t) => {
    saldo += Number(t.valor) || 0;
    return { ...t, saldo };
  });
}

export function removerLancamentosAdministracaoImoveisDeCef(cefList) {
  if (!Array.isArray(cefList)) return [];
  return cefList.filter((t) => !String(t?.numero ?? '').startsWith(PREFIXO_LANC_ADM_IMOVEL));
}

/**
 * Gera linhas demo alinhadas ao imóvel 1 (vínculo cliente/proc do mock).
 */
export function criarLancamentosAdministracaoImoveisDemo() {
  const m = getImovelMock(1);
  if (!m) return [];
  const cod = String(m.codigo);
  const proc = String(m.proc);
  const valorAluguel = Number(String(m.valorLocacao ?? '1200').replace(',', '.')) || 1200;
  const repasse = Math.max(0, valorAluguel - 200);
  const despesa = 150;

  return [
    lancBase({
      numero: `${PREFIXO_LANC_ADM_IMOVEL}001`,
      data: '05/01/2026',
      descricao: 'Crédito aluguel — inquilino',
      valor: valorAluguel,
      codCliente: cod,
      proc,
      descricaoDetalhada: `${TAG_ADM_ALUGUEL} Referência 01/2026`,
    }),
    lancBase({
      numero: `${PREFIXO_LANC_ADM_IMOVEL}002`,
      data: '12/01/2026',
      descricao: 'PIX repasse ao locador',
      valor: -repasse,
      codCliente: cod,
      proc,
      descricaoDetalhada: `${TAG_ADM_REPASSE}`,
    }),
    lancBase({
      numero: `${PREFIXO_LANC_ADM_IMOVEL}003`,
      data: '18/01/2026',
      descricao: 'Manutenção — unidade',
      valor: -despesa,
      codCliente: cod,
      proc,
      descricaoDetalhada: `${TAG_ADM_DESPESA} Hidráulica`,
    }),
    lancBase({
      numero: `${PREFIXO_LANC_ADM_IMOVEL}004`,
      data: '04/02/2026',
      descricao: 'Crédito aluguel — inquilino',
      valor: valorAluguel,
      codCliente: cod,
      proc,
      descricaoDetalhada: `${TAG_ADM_ALUGUEL} Referência 02/2026`,
    }),
  ];
}

export function mergeCefComAdministracaoImoveisDemo(cefList) {
  const limpo = removerLancamentosAdministracaoImoveisDeCef(Array.isArray(cefList) ? cefList : []);
  const novos = criarLancamentosAdministracaoImoveisDemo();
  return recomputeSaldoCef(ordenarCef([...limpo, ...novos]));
}
