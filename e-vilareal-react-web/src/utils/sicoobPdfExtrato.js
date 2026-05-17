/**
 * Parser do extrato em PDF Sicoob (SISBR / conta corrente — texto selecionável).
 * Modelo: DATA | HISTÓRICO | VALOR (sufixo C=crédito, D=débito; * = saldo bloqueado, ignorado).
 */

import { sanitizarLancamentoImportacaoExtrato } from './ofx.js';
import { parseValorBtgPdfBr } from './btgPdfExtrato.js';

export function isInstituicaoSicoobExtratoPdf(nome) {
  return /^Sicoob/i.test(String(nome ?? '').trim());
}

const RE_PERIODO =
  /PER[IÍ]ODO:\s*\d{2}\/\d{2}\/(\d{4})\s*-\s*\d{2}\/\d{2}\/\d{4}/i;

/** Linha de movimento: dd/mm + histórico + valor com C/D no fim. */
const RE_LINHA_MOV = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d.]+,\d{2})([CD])(?:\s*)$/i;

const RE_EXCLUIR_LINHA =
  /^(SICOOB|SISTEMA DE COOPERATIVAS|PLATAFORMA DE SERVI|EXTRATO CONTA CORRENTE|COOP\.:|CONTA:|PER[IÍ]ODO:|HIST[ÓO]RICO DE MOVIMENTA|DATA\s+HIST[ÓO]RICO|^\d{2}\/\d{2}\/\d{4}\s|^\d+ de \d+$|^--\s*\d+)/i;

const RE_IGNORAR_HISTORICO =
  /^SALDO(\s|$)|^RESUMO$|^\(\+\)|^\(-\)|^\(=\)|^ENCARGOS|^OUTRAS INFORMA|^VENCIMENTO|^TAXA |^CUSTO |^SAC:|^OUVIDORIA/i;

function extrairAnoReferencia(texto) {
  const m = String(texto ?? '').match(RE_PERIODO);
  if (m?.[1]) return m[1];
  const m2 = String(texto ?? '').match(/\b(\d{2}\/\d{2}\/(\d{4}))\b/);
  if (m2?.[2]) return m2[2];
  return String(new Date().getFullYear());
}

function dataBrComAno(ddMm, ano) {
  const m = String(ddMm ?? '').match(/^(\d{2})\/(\d{2})$/);
  if (!m) return '';
  return `${m[1]}/${m[2]}/${ano}`;
}

function fnv1aHex(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function valorDeLinhaSicoob(valStr, tipo) {
  const n = parseValorBtgPdfBr(valStr);
  if (!Number.isFinite(n) || n === 0) return NaN;
  if (tipo === 'D') return -Math.abs(n);
  if (tipo === 'C') return Math.abs(n);
  return NaN;
}

/**
 * @param {string} textoBruto
 * @returns {Array<Record<string, unknown>>}
 */
export function parseSicoobPdfExtratoText(textoBruto) {
  const texto = String(textoBruto ?? '');
  const ano = extrairAnoReferencia(texto);
  const linhas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const transacoes = [];
  let emResumo = false;
  let ultimo = null;

  const flushUltimo = () => {
    if (!ultimo) return;
    const desc = ultimo.descricao.trim().replace(/\s+/g, ' ');
    if (!desc || RE_IGNORAR_HISTORICO.test(desc)) {
      ultimo = null;
      return;
    }
    const valor = ultimo.valor;
    if (!Number.isFinite(valor) || Math.abs(valor) < 1e-9) {
      ultimo = null;
      return;
    }
    const data = dataBrComAno(ultimo.ddMm, ano);
    if (!data) {
      ultimo = null;
      return;
    }
    const numero = `SICOOB-PDF-${fnv1aHex(`${data}|${valor}|${desc}|${ultimo.extra || ''}`)}`;
    transacoes.push({
      letra: 'N',
      numero,
      data,
      descricao: desc.slice(0, 200),
      valor,
      saldo: 0,
      saldoDesc: '',
      descricaoDetalhada: [desc, ultimo.extra].filter(Boolean).join(' · ').slice(0, 500),
      categoria: '',
      codCliente: '',
      proc: '',
      dimensao: '',
      parcela: '',
      ref: '',
      eq: '',
      origemImportacao: 'PDF',
    });
    ultimo = null;
  };

  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    if (!line) continue;
    if (/^RESUMO\b/i.test(line)) {
      flushUltimo();
      emResumo = true;
      continue;
    }
    if (emResumo) continue;
    if (RE_EXCLUIR_LINHA.test(line)) continue;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue;

    const mov = line.match(RE_LINHA_MOV);
    if (mov) {
      flushUltimo();
      const ddMm = mov[1];
      const historico = mov[2].trim();
      const tipo = mov[4].toUpperCase();
      if (RE_IGNORAR_HISTORICO.test(historico)) continue;
      const valor = valorDeLinhaSicoob(mov[3], tipo);
      if (!Number.isFinite(valor)) continue;
      ultimo = { ddMm, descricao: historico, valor, extra: '' };
      continue;
    }

    if (ultimo && !RE_LINHA_MOV.test(line) && !/^DOC\.:\s*$/i.test(line)) {
      const extra = line.replace(/\s+/g, ' ').trim();
      if (extra && !RE_EXCLUIR_LINHA.test(extra)) {
        ultimo.extra = ultimo.extra ? `${ultimo.extra} · ${extra}` : extra;
        if (/^DOC\.:/i.test(extra) && ultimo.descricao && !/DOC\./i.test(ultimo.descricao)) {
          ultimo.descricao = `${ultimo.descricao} (${extra})`;
        }
      }
    }
  }
  flushUltimo();

  transacoes.sort((a, b) => {
    const da = a.data.split('/').reverse().join('-');
    const db = b.data.split('/').reverse().join('-');
    const c = da.localeCompare(db);
    if (c !== 0) return c;
    return String(a.numero).localeCompare(String(b.numero));
  });

  let saldoAcum = 0;
  for (const t of transacoes) {
    saldoAcum += Number(t.valor) || 0;
    t.saldo = saldoAcum;
  }

  return transacoes.map(sanitizarLancamentoImportacaoExtrato);
}
