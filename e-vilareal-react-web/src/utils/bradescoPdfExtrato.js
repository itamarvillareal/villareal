/**
 * Parser do extrato em PDF Bradesco Celular (conta corrente / poupança).
 * Layout: bloco «Histórico» + linha «dd/mm/aaaa docto valores…» ou «docto valores…» (mesma data anterior).
 */

import { sanitizarLancamentoImportacaoExtrato } from './ofx.js';
import { parseValorBtgPdfBr } from './btgPdfExtrato.js';

export function isInstituicaoBradescoExtratoPdf(nome) {
  return /^Bradesco|^Poupança Bradesco/i.test(String(nome ?? '').trim());
}

const RE_DATA_COMPLETA = /^(\d{2}\/\d{2}\/\d{4})\b/;
const RE_LINHA_COM_DATA =
  /^(\d{2}\/\d{2}\/\d{4})\s+(\d{5,10})\s+((?:[\d.]+,\d{2})(?:\s+[\d.]+,\d{2}){0,2})\s*$/;
const RE_LINHA_SEM_DATA = /^(\d{5,10})\s+((?:[\d.]+,\d{2})(?:\s+[\d.]+,\d{2}){0,2})\s*$/;
const RE_VALORES = /[\d.]+,\d{2}/g;

const RE_CABECALHO =
  /^(Bradesco|Poupança Bradesco|Data:|Nome:|Extrato de:|Folha:|Data Histórico|Total\b|Extrato inexistente)/i;
const RE_DETALHE = /^(REM:|DES:|REMET\.)/i;
const RE_MAQUINA_ATM = /^(Ag\d|AG\d)/i;
const RE_IGNORAR_HISTORICO = /^COD\.\s*LANC\./i;

const HISTORICOS = [
  'PIX RECEBIDO',
  'PIX ENVIADO',
  'SAQUE DINHEIRO ATM',
  'TED-TRANSF ELET DISPON',
  'DEP DINHEIRO ATM',
  'TRANSF AUTORIZ ENTRE AGS',
  'DEVOLUCAO PIX',
  'TRANSF CP AUTOAT',
];

function fnv1aHex(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function normalizarLinhas(textoBruto) {
  return String(textoBruto ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function extrairValoresMonetarios(s) {
  return String(s ?? '').match(RE_VALORES)?.map((v) => parseValorBtgPdfBr(v)) ?? [];
}

function historicoEhCredito(historico) {
  const h = String(historico ?? '').toUpperCase();
  if (/PIX ENVIADO|SAQUE/.test(h)) return false;
  if (/RECEBIDO|DEP DINHEIRO|DEVOLUCAO|TED-TRANSF|TRANSF AUTORIZ|TRANSF CP AUTOAT/.test(h)) return true;
  return false;
}

function montarValor(historico, valores) {
  const nums = valores.filter((n) => Number.isFinite(n));
  if (!nums.length) return { valor: NaN, saldo: 0 };
  const movimento = nums[0];
  const saldo = nums.length > 1 ? nums[nums.length - 1] : 0;
  if (!Number.isFinite(movimento) || Math.abs(movimento) < 1e-9) {
    return { valor: NaN, saldo };
  }
  const credito = historicoEhCredito(historico);
  return { valor: credito ? Math.abs(movimento) : -Math.abs(movimento), saldo };
}

function pareceRotuloHistorico(line) {
  const u = line.toUpperCase();
  return HISTORICOS.some((h) => u === h || u.startsWith(`${h} `));
}

/** @param {string} textoBruto */
export function textoPareceExtratoBradescoCelular(textoBruto) {
  const t = String(textoBruto ?? '');
  return /Bradesco Celular/i.test(t) && /Cr[eé]dito \(R\$\).*D[eé]bito \(R\$\)/i.test(t.replace(/\s+/g, ' '));
}

/**
 * @param {string} textoBruto
 * @returns {Array<Record<string, unknown>>}
 */
export function parseBradescoPdfExtratoText(textoBruto) {
  const linhas = normalizarLinhas(textoBruto);
  const transacoes = [];
  let historicoAtual = '';
  let ultimaData = '';
  let seqExtrato = 0;
  let ultimoIdx = -1;

  const registrar = ({ data, docto, historico, valor, saldo, extra = '' }) => {
    if (!data || !Number.isFinite(valor) || Math.abs(valor) < 1e-9) return;
    const descricao = String(historico || 'Lançamento Bradesco').trim().replace(/\s+/g, ' ');
    seqExtrato += 1;
    const numero = `BRAD-PDF-${String(seqExtrato).padStart(5, '0')}-${fnv1aHex(`${data}|${docto}|${valor}|${descricao}`)}`;
    transacoes.push({
      letra: 'N',
      numero,
      data,
      descricao: descricao.slice(0, 200),
      valor,
      saldo: Number.isFinite(saldo) ? saldo : 0,
      saldoDesc: '',
      descricaoDetalhada: [descricao, extra, docto ? `Docto ${docto}` : '']
        .filter(Boolean)
        .join(' · ')
        .slice(0, 500),
      categoria: '',
      codCliente: '',
      proc: '',
      dimensao: '',
      parcela: '',
      ref: '',
      eq: '',
      origemImportacao: 'PDF',
    });
    ultimoIdx = transacoes.length - 1;
  };

  const parseLinhaValores = (docto, valoresStr, dataExplicita) => {
    const data = dataExplicita || ultimaData;
    const valores = extrairValoresMonetarios(valoresStr);
    const { valor, saldo } = montarValor(historicoAtual, valores);
    registrar({
      data,
      docto,
      historico: historicoAtual,
      valor,
      saldo,
    });
  };

  for (const line of linhas) {
    if (RE_CABECALHO.test(line)) continue;
    if (RE_MAQUINA_ATM.test(line)) continue;
    if (RE_IGNORAR_HISTORICO.test(line)) continue;

    const dataNoInicio = line.match(RE_DATA_COMPLETA);
    if (dataNoInicio && !RE_LINHA_COM_DATA.test(line) && !pareceRotuloHistorico(line)) {
      if (ultimoIdx >= 0 && !RE_DETALHE.test(line)) {
        const extra = transacoes[ultimoIdx].descricaoDetalhada || '';
        transacoes[ultimoIdx].descricaoDetalhada = extra ? `${extra} · ${line}` : line;
      }
    }

    if (RE_DETALHE.test(line)) {
      if (ultimoIdx >= 0) {
        const extra = transacoes[ultimoIdx].descricaoDetalhada || '';
        transacoes[ultimoIdx].descricaoDetalhada = extra ? `${extra} · ${line}` : line;
      }
      continue;
    }

    if (pareceRotuloHistorico(line)) {
      historicoAtual = line;
      continue;
    }

    const comData = line.match(RE_LINHA_COM_DATA);
    if (comData) {
      ultimaData = comData[1];
      parseLinhaValores(comData[2], comData[3], comData[1]);
      continue;
    }

    const semData = line.match(RE_LINHA_SEM_DATA);
    if (semData) {
      parseLinhaValores(semData[1], semData[2], ultimaData);
      continue;
    }

    if (ultimoIdx >= 0 && historicoAtual && !pareceRotuloHistorico(line)) {
      const extra = transacoes[ultimoIdx].descricaoDetalhada || '';
      transacoes[ultimoIdx].descricaoDetalhada = extra ? `${extra} · ${line}` : line;
    }
  }

  transacoes.sort((a, b) => {
    const da = a.data.split('/').reverse().join('-');
    const db = b.data.split('/').reverse().join('-');
    const c = da.localeCompare(db);
    if (c !== 0) return c;
    return String(a.numero).localeCompare(String(b.numero));
  });

  return transacoes.map(sanitizarLancamentoImportacaoExtrato);
}
