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

// `\s*`: o pdf.js às vezes cola a data ao texto seguinte (ex.: "01/03/2026Saldo Inicial …").
const RE_LINHA_DATA = /^(\d{2}\/\d{2}\/\d{4})\s*(.+)$/;
const RE_HORA_BTG = /^\d{1,2}h\d{2}\s+/i;

/** Extrato do app BTG: `21/07/2023 23h32 Investimentos Transferência recebida … R$ 683,22` */
export function textoPareceTerLancamentosBtgApp(textoBruto) {
  return /\d{2}\/\d{2}\/\d{4}\s+\d{1,2}h\d{2}\s+(Investimentos|Transfer[eê]ncia|Pagamento|Tarifa|Pix|Recebimento|Envio)/i.test(
    String(textoBruto ?? ''),
  );
}

const RE_EXCLUIR_LINHA =
  /^(Extrato de|Conta Corrente:|Período de|Emitido em|ITAMAR |Conta Corrente:|CPF:|Informações de Conta|Agência:|Banco:|^\d+ de \d+$|^--\s*\d+)/i;

/**
 * Rodapé/totais do extrato. Estas linhas encerram o bloco de lançamentos: não podem ser
 * mescladas como “continuação” do último lançamento (senão o saldo final/totais vira valor
 * fantasma no último movimento).
 */
const RE_TERMINADOR_RODAPE =
  /^(Total\s+de\b|Saldo\s+Final\b|Saldo\s+Inicial\b|Saldo\s+Di[aá]rio\b|Saldo\s+Anterior\b|SAC\b|Ouvidoria\b|sac@|ouvidoria@|\d+\s+de\s+\d+$|--\s*\d+)/i;

/**
 * Saldo inicial (de abertura) declarado no topo do extrato BTG. Sem âncora `^`: o pdf.js cola
 * a data ao rótulo (ex.: "01/03/2026Saldo Inicial -11.662,64").
 */
function encontrarSaldoInicialBtg(linhas) {
  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    const m = line.match(/Saldo\s+Inicial\b\s*(-?R?\$?\s*\d[\d.\s]*,\d{2})/i);
    if (m) {
      const v = parseValorBtgPdfBr(m[1]);
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

const RE_DESCRICAO_RUIDO = /^(saldo\b|total\s+de\s+|data\s+e\s+hora|data\s+descri|movimenta)/i;

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
  const flush = () => {
    if (carry && RE_LINHA_DATA.test(carry)) out.push(carry);
    carry = '';
  };
  for (const raw of linhas) {
    const line = String(raw ?? '').trim();
    if (!line) continue;
    if (RE_LINHA_DATA.test(line)) {
      flush();
      carry = line;
    } else if (RE_TERMINADOR_RODAPE.test(line)) {
      // Rodapé/totais/saldo final: encerram o lançamento corrente, não são continuação dele.
      flush();
    } else {
      carry = carry ? `${carry} ${line}` : line;
    }
  }
  flush();
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
  // Linhas de saldo (Inicial, Final, Diário, Anterior…) não são movimentos: descartar.
  // Caso contrário o "Saldo Final" do extrato vira um lançamento com o valor do saldo de fechamento.
  if (/^saldo\b/i.test(descricao)) return null;
  if (/^total\s+de\s+/i.test(descricao)) return null;
  if (/^data\s+e\s+hora\s+categoria/i.test(descricao)) return null;

  if (Math.abs(valor) < 1e-9) return null;

  return { descricao, valor, firstAmtIdx };
}

/**
 * Extrai a descrição (texto antes do 1º número) e a lista de números BR encontrados no trecho
 * após a data, preservando a ordem (esquerda→direita do pdf.js). Não decide sinal aqui.
 * @returns {{ descricao: string, nums: number[] } | null}
 */
function extrairDescricaoENumerosBtg(rest) {
  const matches = [...rest.matchAll(RE_VALOR_BR)];
  if (matches.length < 1) return null;
  const nums = matches.map((m) => parseValorBtgPdfBr(m[0]));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const firstIdx = matches[0].index ?? 0;
  const descricao = rest
    .slice(0, firstIdx)
    .trim()
    .replace(RE_HORA_BTG, '')
    .replace(/\s+/g, ' ');
  return { descricao, nums };
}

function arredondar2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Conta quantas linhas reconciliam com a hipótese de qual coluna é o saldo corrente
 * ('first' = primeiro número da linha; 'last' = último). Uma linha reconcilia quando
 * |saldo − saldoAnterior| bate (≈) com algum outro número da linha (o valor do movimento).
 */
function contarReconciliacoesSaldo(candidatos, saldoInicial, modo) {
  let prev = saldoInicial;
  let ok = 0;
  for (const c of candidatos) {
    const nums = c.nums;
    if (nums.length >= 2) {
      const saldo = modo === 'first' ? nums[0] : nums[nums.length - 1];
      const idxSaldo = modo === 'first' ? 0 : nums.length - 1;
      const esperado = Math.abs(saldo - prev);
      const bate = nums.some((v, i) => i !== idxSaldo && Math.abs(Math.abs(v) - esperado) < 0.015);
      if (bate) ok += 1;
      prev = saldo;
    } else {
      prev = nums[0];
    }
  }
  return ok;
}

function escolherSaldoDaLinha(nums, modo) {
  return modo === 'first' ? nums[0] : nums[nums.length - 1];
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
  // O saldo inicial precisa ser lido antes da mesclagem (ela trata "Saldo Inicial" como rodapé).
  const saldoInicial = encontrarSaldoInicialBtg(linhasBrutas);
  const linhas = mesclarLinhasContinuacaoAposData(linhasBrutas);

  // 1ª passada: linhas de movimento (data + descrição + números), sem decidir o sinal.
  const candidatos = [];
  for (const raw of linhas) {
    const line = raw.trim();
    if (!line) continue;
    if (RE_EXCLUIR_LINHA.test(line)) continue;
    if (/^Movimentação|^Data\s+Descrição|^Data\s+e\s+hora|^Saldo\b|^Total de |^SAC\s|^Ouvidoria|^sac@|^ouvidoria@/i.test(line)) {
      continue;
    }
    const m = line.match(RE_LINHA_DATA);
    if (!m) continue;
    const data = m[1];
    const rest = m[2].trim();
    if (!rest) continue;

    const ext = extrairDescricaoENumerosBtg(rest);
    if (!ext) continue;
    const { descricao, nums } = ext;
    if (!descricao || descricao.length < 3) continue;
    if (RE_DESCRICAO_RUIDO.test(descricao)) continue;
    candidatos.push({ data, descricao, rest, nums });
  }

  // Decide o modo de leitura do valor. Preferimos reconstruir pela variação do saldo corrente
  // (robusto: independe de palavra-chave crédito/débito), quando há "Saldo Inicial" e a cadeia
  // de saldos reconcilia. Detectamos automaticamente se o saldo é a 1ª ou a última coluna.
  const multi = candidatos.filter((c) => c.nums.length >= 2);
  let modoSaldo = null;
  if (saldoInicial !== null && multi.length >= 3) {
    const cFirst = contarReconciliacoesSaldo(candidatos, saldoInicial, 'first');
    const cLast = contarReconciliacoesSaldo(candidatos, saldoInicial, 'last');
    const melhor = Math.max(cFirst, cLast);
    if (melhor >= Math.ceil(multi.length * 0.6)) {
      modoSaldo = cFirst >= cLast ? 'first' : 'last';
    }
  }

  const transacoes = [];
  /** Ordem no PDF — distingue linhas iguais (mesma data/valor/descrição). */
  let seqExtrato = 0;

  const empurrar = (data, descricao, valor, saldo) => {
    if (!Number.isFinite(valor) || Math.abs(valor) < 1e-9) return;
    seqExtrato += 1;
    const numero = `BTG-PDF-${String(seqExtrato).padStart(5, '0')}-${fnv1aHex(`${data}|${valor}|${descricao}`)}`;
    transacoes.push({
      letra: 'N',
      numero,
      data,
      descricao,
      valor,
      saldo: Number.isFinite(saldo) ? arredondar2(saldo) : 0,
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
  };

  if (modoSaldo) {
    let prev = saldoInicial;
    for (const c of candidatos) {
      const saldoLinha = escolherSaldoDaLinha(c.nums, modoSaldo);
      const valor = arredondar2(saldoLinha - prev);
      prev = saldoLinha;
      empurrar(c.data, c.descricao, valor, saldoLinha);
    }
  } else {
    for (const c of candidatos) {
      const parsed = extrairDescricaoEValorBtg(c.rest);
      if (!parsed) continue;
      empurrar(c.data, parsed.descricao, parsed.valor, NaN);
    }
  }

  transacoes.sort((a, b) => {
    const da = a.data.split('/').reverse().join('-');
    const db = b.data.split('/').reverse().join('-');
    const c = da.localeCompare(db);
    if (c !== 0) return c;
    return String(a.numero).localeCompare(String(b.numero));
  });

  // No modo heurístico, o saldo do PDF não é confiável: recompõe acumulado a partir de 0.
  // No modo reconstrução, o saldo já vem do extrato (inclui a abertura) e é mantido.
  if (!modoSaldo) {
    let saldoAcum = 0;
    for (const t of transacoes) {
      saldoAcum += Number(t.valor) || 0;
      t.saldo = arredondar2(saldoAcum);
    }
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
