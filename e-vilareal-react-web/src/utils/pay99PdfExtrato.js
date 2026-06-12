/**
 * Parser do extrato em PDF 99 Pay (carteira / conta digital).
 * Layout: `YYYY-MM-DD HH:MM:SS Descrição +R$ 1.234,56` ou `-R$ 1.234,56`
 */

import { parseValorBtgPdfBr } from './btgPdfExtrato.js';

const NOME_BANCO_99_PAY = '99 Pay';

/** Instituições alimentadas por PDF no layout 99 Pay. */
export function isInstituicaoPay99ExtratoPdf(nome) {
  const n = String(nome ?? '').trim();
  if (!n) return false;
  return /^99\s*pay$/i.test(n.replace(/\s+/g, ' '));
}

export function nomeBancoPay99Padrao() {
  return NOME_BANCO_99_PAY;
}

const RE_LINHA =
  /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+?)\s+([+-])R\$\s*([\d.\s]+,\d{2})\s*$/u;

const RE_CABECALHO = /^Data\/Hora\s+Descri/i;
const RE_RODAPE = /^--\s*\d+\s+of\s+\d+\s*--$/i;

function fnv1aHex(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function dataBrDeIso(ano, mes, dia) {
  return `${dia}/${mes}/${ano}`;
}

function parseValor99Pay(valStr, sinal) {
  const core = String(valStr ?? '').replace(/\s/g, '');
  const n = parseValorBtgPdfBr(core);
  if (!Number.isFinite(n) || n === 0) return NaN;
  return sinal === '-' ? -Math.abs(n) : Math.abs(n);
}

/**
 * @param {string} textoBruto
 * @returns {Array<Record<string, unknown>>}
 */
export function parsePay99PdfExtratoText(textoBruto) {
  const linhas = String(textoBruto ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const transacoes = [];
  let seqExtrato = 0;

  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    if (!line || RE_CABECALHO.test(line) || RE_RODAPE.test(line)) continue;

    const m = RE_LINHA.exec(line);
    if (!m) continue;

    const [, ano, mes, dia, hora, descricao, sinal, valStr] = m;
    const valor = parseValor99Pay(valStr, sinal);
    if (!Number.isFinite(valor) || Math.abs(valor) < 1e-9) continue;

    const data = dataBrDeIso(ano, mes, dia);
    const desc = String(descricao ?? '').trim().replace(/\s+/g, ' ');
    if (!desc) continue;

    const numero = `99PAY-PDF-${String(++seqExtrato).padStart(5, '0')}-${fnv1aHex(`${data}|${hora}|${valor}|${desc}`)}`;

    transacoes.push({
      letra: 'N',
      numero,
      data,
      descricao: desc.slice(0, 200),
      valor,
      saldo: 0,
      saldoDesc: '',
      descricaoDetalhada: `${desc} · ${hora}`.slice(0, 500),
      categoria: '',
      codCliente: '',
      proc: '',
      dimensao: '',
      parcela: '',
      ref: '',
      eq: '',
      origemImportacao: 'PDF',
    });
  }

  transacoes.sort((a, b) => {
    const da = (a.data || '').split('/').reverse().join('-');
    const db = (b.data || '').split('/').reverse().join('-');
    const cmp = da.localeCompare(db);
    if (cmp !== 0) return cmp;
    return String(a.numero).localeCompare(String(b.numero));
  });

  let saldo = 0;
  for (const t of transacoes) {
    saldo += Number(t.valor) || 0;
    t.saldo = saldo;
  }

  return transacoes;
}
