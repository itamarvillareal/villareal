/**
 * Parser do extrato em PDF da conta corrente BTG Pactual (texto extraído via pdf.js).
 *
 * Modelo atual (tabela 5 colunas): Data | Descrição | Débito | Crédito | Saldo
 * — usa os dois valores monetários antes do saldo (crédito − débito) e ignora o saldo do PDF
 * (a aplicação recalcula o saldo em ordem cronológica).
 *
 * Modelo antigo / texto colapsado: só dois valores (movimento + saldo) — heurística por descrição.
 */

import { sanitizarLancamentoImportacaoExtrato } from './ofx.js';

/** Instituições cujo extrato oficial é importado por PDF, não OFX. */
export function isInstituicaoBtgExtratoPdf(nome) {
  return /^BTG/i.test(String(nome ?? '').trim());
}

export function parseValorBtgPdfBr(s) {
  let t = String(s ?? '')
    .trim()
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\s+/g, '');
  if (!t) return NaN;
  const neg = t.startsWith('-');
  const core = neg ? t.slice(1) : t;
  const lastDot = core.lastIndexOf('.');
  const lastComma = core.lastIndexOf(',');
  let cleaned;
  if (lastDot > lastComma) {
    cleaned = core.replace(/,/g, '');
  } else {
    cleaned = core.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return neg ? -n : n;
}

/**
 * Valores em formato BR: vírgula decimal; milhares opcionais com ponto ou espaço.
 * Evita casar `49.99` dentro de `49.999,99` (padrão “US” parcial) e `9,99` como sufixo.
 */
const RE_VALOR_BR =
  /-?\d+(?:\.\d{3})*,\d{2}|-?\d{1,3}(?:\s\d{3})+,\d{2}/g;

const RE_LINHA_DATA = /^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/;

const RE_EXCLUIR_LINHA =
  /^(Extrato de|Conta Corrente:|Período de|Emitido em|ITAMAR |Conta Corrente:|CPF:|Informações de Conta|Agência:|Banco:|^\d+ de \d+$|^--\s*\d+)/i;

/** Palavras-chave para saída de numerário (layout com só 2 valores: movimento + saldo). */
function descricaoIndicaDebito(descNorm) {
  return (
    /\bENVIO\b/.test(descNorm) ||
    /\bCOMPRA\b/.test(descNorm) ||
    /\bEMISSA(O|ÃO)\b/.test(descNorm) ||
    /\bIRRF\b/.test(descNorm) ||
    /\bIOF\b/.test(descNorm) ||
    /TED\s+ENVIADA/i.test(descNorm) ||
    /\bVENCIMENTO\b/.test(descNorm) ||
    /\bCUPOM\b/.test(descNorm)
  );
}

function normalizarDescricaoParaRegra(s) {
  return String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Interpreta o trecho após a data: últimos 3 números = débito, crédito, saldo (PDF);
 * ou 2 números = layout compacto (movimento + saldo ou 0 + crédito + saldo colapsado).
 * @returns {{ descricao: string, valor: number, firstAmtIdx: number } | null}
 */
/**
 * Junta linhas que o pdf.js separou por coluna: a data fica na primeira linha e
 * débito/crédito/saldo na linha seguinte (sem começar por DD/MM/AAAA).
 */
function mesclarLinhasContinuacaoAposData(linhas) {
  const out = [];
  let carry = '';
  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    if (!line) continue;
    if (RE_LINHA_DATA.test(line)) {
      if (carry && RE_LINHA_DATA.test(carry)) {
        out.push(carry);
      }
      carry = line;
    } else {
      carry = carry ? `${carry} ${line}` : line;
    }
  }
  if (carry && RE_LINHA_DATA.test(carry)) {
    out.push(carry);
  }
  return out;
}

function extrairDescricaoEValorBtg(rest) {
  const matches = [...rest.matchAll(RE_VALOR_BR)];
  if (matches.length < 2) return null;

  const nums = matches.map((m) => parseValorBtgPdfBr(m[0]));
  if (nums.some((n) => !Number.isFinite(n))) return null;

  let valor;
  let firstAmtIdx;

  if (nums.length >= 3) {
    const deb = nums[nums.length - 3];
    const cred = nums[nums.length - 2];
    firstAmtIdx = matches[nums.length - 3].index;
    valor = cred - deb;
  } else {
    const x = nums[0];
    const y = nums[1];
    firstAmtIdx = matches[0].index;
    const descParcial = rest.slice(0, firstAmtIdx).trim();
    const descNorm = normalizarDescricaoParaRegra(descParcial);

    if (x < 0) {
      valor = x;
    } else if (x === 0 && y !== 0) {
      valor = y;
    } else if (descricaoIndicaDebito(descNorm)) {
      valor = -x;
    } else if (Math.abs(x - y) < 0.02) {
      valor = x;
    } else {
      valor = x;
    }
  }

  const descricao = rest.slice(0, firstAmtIdx).trim().replace(/\s+/g, ' ');
  if (!descricao || descricao.length < 3) return null;
  if (/^saldo\s+inicial/i.test(descricao)) return null;
  if (/^total\s+de\s+/i.test(descricao)) return null;

  if (Math.abs(valor) < 1e-9) return null;

  return { descricao, valor, firstAmtIdx };
}

/**
 * @param {string} textoBruto
 * @returns {Array<Record<string, unknown>>}
 */
export function parseBtgPdfExtratoText(textoBruto) {
  const linhasBrutas = String(textoBruto ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  const linhas = mesclarLinhasContinuacaoAposData(linhasBrutas);

  const transacoes = [];

  for (const raw of linhas) {
    const line = raw.trim();
    if (!line) continue;
    if (RE_EXCLUIR_LINHA.test(line)) continue;
    if (/^Movimentação|^Data\s+Descrição|^Saldo Inicial|^Total de |^SAC\s|^Ouvidoria|^sac@|^ouvidoria@/i.test(line)) {
      continue;
    }
    const m = line.match(RE_LINHA_DATA);
    if (!m) continue;
    const data = m[1];
    const rest = m[2].trim();
    if (!rest) continue;

    const parsed = extrairDescricaoEValorBtg(rest);
    if (!parsed) continue;

    const { descricao, valor } = parsed;
    const numero = `BTG-PDF-${fnv1aHex(`${data}|${valor}|${descricao}`)}`;
    transacoes.push({
      letra: 'N',
      numero,
      data,
      descricao,
      valor,
      saldo: 0,
      saldoDesc: '',
      descricaoDetalhada: descricao,
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

function fnv1aHex(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
