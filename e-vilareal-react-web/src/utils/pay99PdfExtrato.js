/**
 * Parser do extrato em PDF 99 Pay (carteira / conta digital).
 *
 * Layouts suportados:
 * 1) Linha única: `YYYY-MM-DD HH:MM:SS Descrição +R$ 1.234,56`
 * 2) Exportação em blocos (pdf-parse): data em linha + `HH:MM:SS Descrição +R$1.234,56`
 * 3) Exportação multilinha (pdf.js): data, hora, descrição e valor em linhas separadas
 * 4) Tabela legada: `Nº DD/MM/YYYY HH:MM:SS Descrição` + blocos `+R$1.234,56 [ID]`
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

const RE_LINHA_UNICA =
  /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+?)\s+([+-])R\$\s*([\d.\s]+,\d{2})(?:\s*[*]?\s*[—–-])?\s*$/u;

const RE_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const RE_HORA = /^(\d{2}:\d{2}:\d{2})$/;
const RE_DETALHE_BLOCO =
  /^(\d{2}:\d{2}:\d{2})\s+(.+?)\s+([+-])R\$([\d.\s]+,\d{2})(?:\s*[*]?\s*[—–-])?\s*$/u;

const RE_TX_TABELA = /^(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(.+)$/;
const RE_VALOR = /^([+-])R\$([\d.\s]+,\d{2})(?:\s+(\d+))?\s*$/;

const RE_CABECALHO =
  /^(Data\/Hora|Data e hora|Nº\s+Data|Valor(\s+ID)?|Extrato$|Filtro:|Maio de|Junho de|Julho de|Subtotal|Resumo geral|Notas$|Mês\s)/i;
const RE_RODAPE = /^--\s*\d+\s+of\s+\d+\s*--$/i;
const RE_IGNORAR =
  /^(Parcialmente|reembolsado|\(R\$|TOTAL\s|•\s|Julho\/|Junho\/|Maio\/|\d+\s+[+−-]R\$)/i;

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

function criarLancamento({ data, hora, descricao, valor, seqExtrato, tableSeq = null }) {
  const desc = String(descricao ?? '').trim().replace(/\s+/g, ' ');
  if (!desc || !Number.isFinite(valor) || Math.abs(valor) < 1e-9) return null;

  const seqPart = tableSeq != null ? String(tableSeq) : String(seqExtrato);
  const numero = `99PAY-PDF-${String(seqExtrato).padStart(5, '0')}-${fnv1aHex(`${data}|${hora}|${valor}|${desc}|${seqPart}`)}`;

  return {
    letra: 'N',
    numero,
    data,
    descricao: desc.slice(0, 200),
    valor,
    saldo: 0,
    saldoDesc: '',
    descricaoDetalhada: `${desc}${hora ? ` · ${hora}` : ''}`.slice(0, 500),
    categoria: '',
    codCliente: '',
    proc: '',
    dimensao: '',
    parcela: '',
    ref: '',
    eq: '',
    origemImportacao: 'PDF',
    _dedupeKey: `${data}|${hora}|${desc}|${Math.round(valor * 100)}|${tableSeq ?? ''}`,
  };
}

function deveIgnorarLinha(line) {
  if (!line) return true;
  if (RE_CABECALHO.test(line) || RE_RODAPE.test(line) || RE_IGNORAR.test(line)) return true;
  if (/^Descrição\s+Valor/i.test(line)) return true;
  if (line === '—' || line === '-' || line === '—' || line === '–') return true;
  return false;
}

function parseLayoutLinhaUnica(linhas, out, nextSeq) {
  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    if (deveIgnorarLinha(line)) continue;

    const m = RE_LINHA_UNICA.exec(line);
    if (!m) continue;

    const [, ano, mes, dia, hora, descricao, sinal, valStr] = m;
    const valor = parseValor99Pay(valStr, sinal);
    const row = criarLancamento(
      { data: dataBrDeIso(ano, mes, dia), hora, descricao, valor, seqExtrato: nextSeq() },
    );
    if (row) out.push(row);
  }
}

function parseLayoutBlocoDataHora(linhas, out, nextSeq) {
  let pendingDate = null;

  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    if (deveIgnorarLinha(line)) continue;

    const d = RE_DATA_ISO.exec(line);
    if (d) {
      pendingDate = dataBrDeIso(d[1], d[2], d[3]);
      continue;
    }

    const det = RE_DETALHE_BLOCO.exec(line);
    if (det && pendingDate) {
      const [, hora, descricao, sinal, valStr] = det;
      const valor = parseValor99Pay(valStr, sinal);
      const row = criarLancamento(
        { data: pendingDate, hora, descricao, valor, seqExtrato: nextSeq() },
      );
      if (row) out.push(row);
      continue;
    }

    if (!RE_DATA_ISO.test(line) && !RE_DETALHE_BLOCO.test(line)) {
      pendingDate = null;
    }
  }
}

/** pdf.js costuma emitir data, hora, descrição e valor em linhas separadas. */
function parseLayoutMultilinhaDesacoplado(linhas, out, nextSeq) {
  let pendingDate = null;
  let pendingTime = null;
  let pendingDesc = null;

  const flush = (sinal, valStr) => {
    if (!pendingDate || !pendingTime || !pendingDesc) return;
    const valor = parseValor99Pay(valStr, sinal);
    const row = criarLancamento({
      data: pendingDate,
      hora: pendingTime,
      descricao: pendingDesc,
      valor,
      seqExtrato: nextSeq(),
    });
    if (row) out.push(row);
    pendingTime = null;
    pendingDesc = null;
  };

  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    if (deveIgnorarLinha(line)) continue;

    const iso = RE_DATA_ISO.exec(line);
    if (iso) {
      pendingDate = dataBrDeIso(iso[1], iso[2], iso[3]);
      pendingTime = null;
      pendingDesc = null;
      continue;
    }

    const horaOnly = RE_HORA.exec(line);
    if (horaOnly && pendingDate) {
      pendingTime = horaOnly[1];
      pendingDesc = null;
      continue;
    }

    const val = RE_VALOR.exec(line);
    if (val && pendingDate && pendingTime && pendingDesc) {
      flush(val[1], val[2]);
      continue;
    }

    if (pendingDate && pendingTime && !RE_VALOR.test(line) && !RE_HORA.test(line)) {
      pendingDesc = line;
    }
  }
}

function parseLayoutTabelaDesacoplada(linhas, out, nextSeq) {
  const txs = [];
  const vals = [];

  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    if (deveIgnorarLinha(line)) continue;

    const tx = RE_TX_TABELA.exec(line);
    if (tx) {
      txs.push({
        seq: tx[1],
        data: tx[2],
        hora: tx[3],
        descricao: tx[4],
      });
      continue;
    }

    const v = RE_VALOR.exec(line);
    if (v) {
      vals.push({ sinal: v[1], valStr: v[2], idTransacao: v[3] || null });
    }
  }

  if (!txs.length || txs.length !== vals.length) return;

  for (let i = 0; i < txs.length; i += 1) {
    const t = txs[i];
    const v = vals[i];
    const valor = parseValor99Pay(v.valStr, v.sinal);
    const row = criarLancamento({
      data: t.data,
      hora: t.hora,
      descricao: t.descricao,
      valor,
      seqExtrato: nextSeq(),
      tableSeq: t.seq,
    });
    if (row) out.push(row);
  }
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

  let seq = 0;
  const nextSeq = () => {
    seq += 1;
    return seq;
  };

  /** @type {Array<Record<string, unknown>>} */
  const candidatos = [];

  parseLayoutLinhaUnica(linhas, candidatos, nextSeq);
  parseLayoutBlocoDataHora(linhas, candidatos, nextSeq);
  parseLayoutMultilinhaDesacoplado(linhas, candidatos, nextSeq);
  parseLayoutTabelaDesacoplada(linhas, candidatos, nextSeq);

  /** Dedupe só quando o mesmo lançamento foi parseado por layouts diferentes. */
  const vistos = new Set();
  const transacoes = [];
  for (const row of candidatos) {
    const chave = row._dedupeKey || row.numero;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const { _dedupeKey, ...clean } = row;
    transacoes.push(clean);
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
