/**
 * Parser do extrato em PDF da conta corrente BTG Pactual (texto extraído via pdf.js).
 *
 * Modelos suportados:
 * 1) Conta corrente clássica: Data | Descrição | Débito | Crédito | Saldo
 * 2) App BTG (Data e hora | Categoria | Transação | Descrição | Valor) — um valor com R$ / -R$
 * 3) Texto colapsado: movimento + saldo — heurística por descrição
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
  let neg = false;
  if (/^-R\$/i.test(t)) {
    neg = true;
    t = t.replace(/^-R\$/i, '');
  } else if (t.startsWith('-')) {
    neg = true;
    t = t.slice(1).replace(/^R\$/i, '');
  } else {
    t = t.replace(/^R\$/i, '');
  }
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  let cleaned;
  if (lastDot > lastComma) {
    cleaned = t.replace(/,/g, '');
  } else {
    cleaned = t.replace(/\./g, '').replace(',', '.');
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
  /-R\$\s*\d+(?:\.\d{3})*,\d{2}|R\$\s*\d+(?:\.\d{3})*,\d{2}|-?\d+(?:\.\d{3})*,\d{2}|-?\d{1,3}(?:\s\d{3})+,\d{2}/g;

const RE_LINHA_DATA = /^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/;
const RE_HORA_BTG = /^\d{1,2}h\d{2}\s+/i;

/** Extrato do app BTG: `21/07/2023 23h32 Investimentos Transferência recebida … R$ 683,22` */
export function textoPareceTerLancamentosBtgApp(textoBruto) {
  return /\d{2}\/\d{2}\/\d{4}\s+\d{1,2}h\d{2}\s+(Investimentos|Transfer[eê]ncia|Pagamento|Tarifa|Pix|Recebimento|Envio)/i.test(
    String(textoBruto ?? ''),
  );
}

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
  if (matches.length < 1) return null;

  const nums = matches.map((m) => parseValorBtgPdfBr(m[0]));
  if (nums.some((n) => !Number.isFinite(n))) return null;

  let valor;
  let firstAmtIdx;

  if (matches.length === 1) {
    firstAmtIdx = matches[0].index ?? 0;
    valor = nums[0];
  } else if (nums.length >= 3) {
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

  let descricao = rest.slice(0, firstAmtIdx).trim().replace(RE_HORA_BTG, '').replace(/\s+/g, ' ');
  if (!descricao || descricao.length < 3) return null;
  if (/^saldo\s+(inicial|di[aá]rio)/i.test(descricao)) return null;
  if (/^total\s+de\s+/i.test(descricao)) return null;
  if (/^data\s+e\s+hora\s+categoria/i.test(descricao)) return null;

  if (Math.abs(valor) < 1e-9) return null;

  return { descricao, valor, firstAmtIdx };
}

function normalizarTextoBtgPdf(textoBruto) {
  return String(textoBruto ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})/g, '$1/$2/$3');
}

/**
 * @param {string} textoBruto
 * @returns {Array<Record<string, unknown>>}
 */
export function parseBtgPdfExtratoText(textoBruto) {
  const linhasBrutas = normalizarTextoBtgPdf(textoBruto).split('\n');
  const linhas = mesclarLinhasContinuacaoAposData(linhasBrutas);

  const transacoes = [];
  /** Ordem no PDF — distingue linhas iguais (mesma data/valor/descrição). */
  let seqExtrato = 0;

  for (const raw of linhas) {
    const line = raw.trim();
    if (!line) continue;
    if (RE_EXCLUIR_LINHA.test(line)) continue;
    if (/^Movimentação|^Data\s+Descrição|^Data\s+e\s+hora|^Saldo Inicial|^Total de |^SAC\s|^Ouvidoria|^sac@|^ouvidoria@/i.test(line)) {
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
    seqExtrato += 1;
    const numero = `BTG-PDF-${String(seqExtrato).padStart(5, '0')}-${fnv1aHex(`${data}|${valor}|${descricao}`)}`;
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
