/**
 * Cruza parcelas esperadas (aba Parcelamento em Cálculos) com lançamentos dos extratos bancários.
 */

import { normalizarCodigoClienteFinanceiro, normalizarProcFinanceiro } from './financeiroData';
import { parseBRLToCentavos } from '../utils/moneyBr';

/** Mesma convenção de Calculos.jsx: cliente 8 dígitos, proc numérico, dimensão. */
export function buildRodadaKeyCalculos(codCliente, proc, dimensao) {
  const codNum = Number(String(codCliente ?? '').replace(/\D/g, '')) || 1;
  const cod8 = String(codNum).padStart(8, '0');
  const procN = normalizarProcFinanceiro(proc) || '1';
  const dim = Math.max(0, Math.floor(Number(dimensao) || 0));
  return `${cod8}:${procN}:${dim}`;
}

function parseQuantidadeParcelasNumero(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (!d) return 0;
  return Math.min(9999, Math.max(0, Number(d)));
}

/** Normaliza data dd/mm/aaaa; inválido → ''. */
function normalizarDataBRLeve(s) {
  const t = String(s ?? '').trim();
  if (t.length < 8) return '';
  const parts = t.split(/[/\-]/).map((p) => String(p).trim());
  if (parts.length !== 3) return '';
  const dd = String(Math.min(31, Math.max(1, Number(parts[0]) || 0))).padStart(2, '0');
  const mm = String(Math.min(12, Math.max(1, Number(parts[1]) || 0))).padStart(2, '0');
  let yyyy = String(parts[2] ?? '').replace(/\D/g, '');
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  if (yyyy.length !== 4) return '';
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Extrai parcelas com data e valor preenchidos a partir do estado da rodada em Cálculos.
 * @param {object} rodada - rodada.parcelas, quantidadeParcelasInformada
 * @returns {Array<{ indice: number, data: string, valorCentavos: number, valorLabel: string }>}
 */
export function extrairParcelasEsperadasDaRodada(rodada) {
  if (!rodada || !Array.isArray(rodada.parcelas)) return [];
  const nQ = parseQuantidadeParcelasNumero(rodada.quantidadeParcelasInformada);
  const lista = nQ > 0 ? rodada.parcelas.slice(0, nQ) : rodada.parcelas;
  const out = [];
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    const data = normalizarDataBRLeve(p?.dataVencimento);
    const vc = parseBRLToCentavos(p?.valorParcela);
    if (!data || vc == null || vc <= 0) continue;
    out.push({
      indice: i + 1,
      data,
      valorCentavos: vc,
      valorLabel: String(p?.valorParcela ?? '').trim() || `${(vc / 100).toFixed(2)}`,
    });
  }
  return out;
}

/**
 * Para cada parcela esperada, lista lançamentos em qualquer extrato com mesma data e valor absoluto (centavos).
 */
export function encontrarCandidatosExtratoPorParcelas(extratosPorBanco, parcelasEsperadas) {
  const flat = [];
  for (const [nomeBanco, list] of Object.entries(extratosPorBanco || {})) {
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      flat.push({ ...t, nomeBanco });
    }
  }
  return parcelasEsperadas.map((exp) => {
    const candidatos = flat
      .filter((tx) => {
        if (String(tx.data ?? '').trim() !== exp.data) return false;
        const tv = Math.abs(Math.round(Number(tx.valor) * 100));
        return tv === exp.valorCentavos;
      })
      .map((tx) => ({
        nomeBanco: tx.nomeBanco,
        numero: tx.numero,
        data: tx.data,
        valor: tx.valor,
        letra: tx.letra,
        codCliente: tx.codCliente,
        proc: tx.proc,
      }));
    return { esperada: exp, candidatos };
  });
}

export function lancamentoJaVinculadoAoProcesso(tx, codCliente, proc) {
  const c = normalizarCodigoClienteFinanceiro(codCliente);
  const p = normalizarProcFinanceiro(proc);
  if (!c || !p) return false;
  return (
    normalizarCodigoClienteFinanceiro(tx.codCliente) === c && normalizarProcFinanceiro(tx.proc) === p
  );
}

/** Lançamento ainda sem cliente e processo (extrato não classificado). */
export function lancamentoExtratoNaoClassificado(tx) {
  const c = normalizarCodigoClienteFinanceiro(tx.codCliente);
  const p = normalizarProcFinanceiro(tx.proc);
  return !c && !p;
}

/** Só rodadas em que o usuário marcou "Aceitar Pagamento" no Cálculos (persistido). */
export function rodadaParcelamentoAceita(rodada) {
  return Boolean(rodada?.parcelamentoAceito);
}

/** Chave `00000728:45:0` → exibição e vínculo. */
export function parseRodadaKeyParaDisplay(rodadaKey) {
  const parts = String(rodadaKey).split(':');
  if (parts.length < 3) return { codCliente: '', proc: '', dimensao: '0' };
  const codNum = parseInt(parts[0], 10);
  const codCliente = Number.isFinite(codNum) ? String(codNum) : '';
  return {
    codCliente,
    proc: String(parts[1] ?? ''),
    dimensao: String(parts[2] ?? '0'),
  };
}

/**
 * Para cada lançamento não classificado do extrato, procura parcelas (data + valor) em **todas** as rodadas
 * com parcelamento aceito. O usuário aprova depois no Financeiro.
 * @returns {Array<{ nomeBanco, numero, data, valor, matches: Array<{ rodadaKey, parcelaIndice, parcelaData, valorCentavos }> }>}
 */
export function procurarSugestoesVinculoAutomatico(extratosPorBanco, rodadas) {
  const sugestoes = [];
  for (const [nomeBanco, list] of Object.entries(extratosPorBanco || {})) {
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      const tx = { ...t, nomeBanco };
      if (!lancamentoExtratoNaoClassificado(tx)) continue;
      const data = String(tx.data ?? '').trim();
      const vc = Math.abs(Math.round(Number(tx.valor) * 100));
      if (!data || !Number.isFinite(vc) || vc === 0) continue;
      const matches = [];
      for (const [rodadaKey, rodada] of Object.entries(rodadas || {})) {
        if (!rodadaParcelamentoAceita(rodada)) continue;
        const parcelas = extrairParcelasEsperadasDaRodada(rodada);
        for (const p of parcelas) {
          if (p.data === data && p.valorCentavos === vc) {
            matches.push({
              rodadaKey,
              parcelaIndice: p.indice,
              parcelaData: p.data,
              valorCentavos: p.valorCentavos,
            });
          }
        }
      }
      if (matches.length > 0) {
        sugestoes.push({
          nomeBanco: tx.nomeBanco,
          numero: tx.numero,
          data: tx.data,
          valor: tx.valor,
          matches,
        });
      }
    }
  }
  return sugestoes;
}
