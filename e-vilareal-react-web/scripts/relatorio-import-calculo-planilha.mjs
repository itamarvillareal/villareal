#!/usr/bin/env node
/**
 * Relatório e pré-análise do import `import-calculo.xls` (layout 2026).
 *
 * Não grava na API: apenas lê a planilha, valida colunas, agrupa por cliente/proc/dimensão
 * e descreve o que seria gerado (rodadas de cálculo + rascunhos de pagamentos).
 *
 * Uso:
 *   node scripts/relatorio-import-calculo-planilha.mjs [caminho/import-calculo.xls] [--json]
 *
 * Layout assumido (confirmar com seu ficheiro real):
 * - Cabeçalho na linha 6 (1-based), dados a partir da linha 7 (igual nas duas abas analisadas).
 * - Aba 1: nome contém "relatorio" e "debitos" e "cadastrad" (ex.: "Relatorio Debitos Cadastrad (4)").
 * - Aba 2: nome contém "relatorio" e ("001" ou "999") (ex.: "Relatório - 001 a 999").
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

const HEADER_ROW_1BASED = 6;
const DATA_START_1BASED = 7;

/** Deslocamento de letra Excel → índice 0 (D=3, …, U=20). */
function colLetterToIndex0(letter) {
  const s = String(letter ?? '').trim().toUpperCase();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 65 || c > 90) continue;
    n = n * 26 + (c - 64);
  }
  return Math.max(0, n - 1);
}

const COL = {
  ABA1_D_COD_CLIENTE: colLetterToIndex0('D'),
  ABA1_G_VENCIMENTO: colLetterToIndex0('G'),
  ABA1_I_VALOR: colLetterToIndex0('I'),
  ABA1_L_PARCELA: colLetterToIndex0('L'),
  ABA1_M_PROC: colLetterToIndex0('M'),
  ABA1_N_DIM: colLetterToIndex0('N'),
  ABA2_D_COD_CLIENTE: colLetterToIndex0('D'),
  ABA2_G_VENCIMENTO: colLetterToIndex0('G'),
  ABA2_H_PAGAMENTO: colLetterToIndex0('H'),
  ABA2_I_VALOR: colLetterToIndex0('I'),
  ABA2_K_OBS: colLetterToIndex0('K'),
  ABA2_L_PARCELA: colLetterToIndex0('L'),
  ABA2_M_PROC: colLetterToIndex0('M'),
  ABA2_N_FLAG_SIM: colLetterToIndex0('N'),
  ABA2_U_DIM: colLetterToIndex0('U'),
};

function stripAcc(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normHeaderCell(s) {
  return stripAcc(String(s ?? '').trim())
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normSheetName(s) {
  return stripAcc(String(s ?? '').trim()).toLowerCase();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function excelSerialParaISO(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseData(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    if (whole > 20000 && whole < 200000) return excelSerialParaISO(val);
  }
  const s = String(val).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function parseValorMonetario(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const t = String(v).trim().replace(/\s/g, '');
  if (!t) return null;
  if (/R\$/i.test(t)) {
    const s = t.replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (t.includes(',')) {
    const s = t.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseTexto(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normalizarCodigoCliente(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(Math.trunc(v)).padStart(8, '0');
  }
  let s = String(v).trim();
  s = s.replace(/\.0+$/, '');
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  return String(n).padStart(8, '0');
}

function parseNumeroProcesso(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 1 ? n : null;
  }
  const s = String(v).trim().replace(/\D/g, '');
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function parseDimensao(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 0 ? n : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  return n >= 0 ? n : null;
}

function parseParcelaNum(v) {
  const n = parseNumeroProcesso(v);
  return n;
}

/**
 * Campos da grade «Títulos» (alinha a {@link linhaTituloVaziaCalculos}).
 * Cada entrada: norm do cabeçalho → campo JSON.
 */
const MAPEAMENTO_TITULO_POR_HEADER = [
  { campo: 'dataVencimento', norms: [normHeaderCell('Data de Vencimento'), normHeaderCell('Vencimento')] },
  { campo: 'valorInicial', norms: [normHeaderCell('Valor Inicial'), normHeaderCell('Valor'), normHeaderCell('Principal')] },
  { campo: 'atualizacaoMonetaria', norms: [normHeaderCell('Atualização Monetária'), normHeaderCell('Atualizacao Monetaria')] },
  { campo: 'diasAtraso', norms: [normHeaderCell('Dias Atraso'), normHeaderCell('Dias de Atraso')] },
  { campo: 'juros', norms: [normHeaderCell('Juros')] },
  { campo: 'multa', norms: [normHeaderCell('Multa')] },
  { campo: 'honorarios', norms: [normHeaderCell('Honorários'), normHeaderCell('Honorarios')] },
  { campo: 'total', norms: [normHeaderCell('Total')] },
  { campo: 'descricaoValor', norms: [normHeaderCell('Descrição dos Valores'), normHeaderCell('Descrição Valor'), normHeaderCell('Descricao')] },
];

function resolverIndiceTituloPorHeader(headerRow, campo) {
  const entry = MAPEAMENTO_TITULO_POR_HEADER.find((m) => m.campo === campo);
  if (!entry) return -1;
  for (let c = 0; c < headerRow.length; c++) {
    const h = normHeaderCell(headerRow[c]);
    if (entry.norms.includes(h)) return c;
  }
  return -1;
}

/** Constrói mapa coluna → campo titulo a partir da linha de cabeçalho. */
function mapearColunasTitulo(headerRow) {
  const map = {};
  const usados = new Set();
  for (const { campo, norms } of MAPEAMENTO_TITULO_POR_HEADER) {
    for (let c = 0; c < headerRow.length; c++) {
      if (usados.has(c)) continue;
      const h = normHeaderCell(headerRow[c]);
      if (norms.includes(h)) {
        map[c] = campo;
        usados.add(c);
        break;
      }
    }
  }
  return map;
}

function sheetToMatrix(wb, sheetName) {
  const sh = wb.Sheets[sheetName];
  if (!sh) return [];
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
}

function pickAbaDebitosCadastrados(sheetNames) {
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.includes('relatorio') && x.includes('debitos') && x.includes('cadastrad')) return n;
  }
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.includes('debitos') && x.includes('cadastrad')) return n;
  }
  return null;
}

function pickAbaRelatorio001999(sheetNames) {
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.includes('relatorio') && (x.includes('001') || x.includes('999'))) return n;
  }
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.startsWith('relatorio') && !x.includes('debitos')) return n;
  }
  return null;
}

function linhaVazia(row) {
  if (!Array.isArray(row)) return true;
  return !row.some((c) => c != null && String(c).trim() !== '');
}

function cel(row, idx) {
  if (!Array.isArray(row) || idx < 0) return null;
  return idx < row.length ? row[idx] : null;
}

/**
 * Extrai objeto titulo (parcial) de uma linha; reforço D,M,N,L,G,I + restantes por cabeçalho.
 */
function linhaParaTitulo(row, headerRow, colTituloMap) {
  const t = {
    dataVencimento: '',
    valorInicial: '',
    atualizacaoMonetaria: '',
    diasAtraso: '',
    juros: '',
    multa: '',
    honorarios: '',
    total: '',
    descricaoValor: '',
    datasEspeciais: null,
  };
  const venc = parseData(cel(row, COL.ABA1_G_VENCIMENTO));
  const val = parseValorMonetario(cel(row, COL.ABA1_I_VALOR));
  if (venc) t.dataVencimento = venc;
  if (val != null) t.valorInicial = String(val);

  for (const [cStr, campo] of Object.entries(colTituloMap)) {
    const c = Number(cStr);
    const raw = cel(row, c);
    if (raw == null || String(raw).trim() === '') continue;
    if (campo === 'dataVencimento') {
      const d = parseData(raw);
      if (d) t.dataVencimento = d;
    } else if (campo === 'valorInicial') {
      const vm = parseValorMonetario(raw);
      if (vm != null) t.valorInicial = String(vm);
    } else {
      t[campo] = String(raw).trim();
    }
  }
  return t;
}

function chaveRodada(cod8, proc, dim) {
  return `${cod8}|${proc}|${dim}`;
}

function parseArgs(argv) {
  let file = null;
  let json = false;
  for (const a of argv) {
    if (a === '--json') json = true;
    else if (!a.startsWith('-') && !file) file = a;
  }
  return { file, json };
}

function main() {
  const { file, json } = parseArgs(process.argv.slice(2));
  const defaultFile = path.resolve(process.cwd(), 'import-calculo.xls');
  const abs = file ? (path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)) : defaultFile;

  if (!fs.existsSync(abs)) {
    console.error(`Ficheiro não encontrado: ${abs}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(abs, { cellDates: true, raw: true });
  const nameDebitos = pickAbaDebitosCadastrados(wb.SheetNames);
  const nameRel = pickAbaRelatorio001999(wb.SheetNames);

  const duvidas = [];
  const avisos = [];

  if (!nameDebitos) {
    avisos.push('Aba «Relatorio Debitos Cadastrad…» não encontrada pelo padrão (relatorio+debitos+cadastrad).');
  }
  if (!nameRel) {
    avisos.push('Aba «Relatório - 001 a 999» não encontrada pelo padrão (relatorio + 001 ou 999).');
  }

  const hIdx = HEADER_ROW_1BASED - 1;
  const dIdx = DATA_START_1BASED - 1;

  /** @type {Record<string, { titulos: unknown[], linhas: number[], parcelasRef: number[] }>} */
  const porChaveTitulos = {};
  /** @type {Record<string, { parcelas: unknown[], linhas: number[], aceitarPagamento: boolean }>} */
  const porChaveParcelamento = {};

  if (nameDebitos) {
    const m = sheetToMatrix(wb, nameDebitos);
    const headerRow = m[hIdx] || [];
    const colTituloMap = mapearColunasTitulo(headerRow);
    const colunasNaoMapeadas = [];
    for (let c = 0; c < headerRow.length; c++) {
      const h = String(headerRow[c] ?? '').trim();
      if (!h) continue;
      if (!Object.prototype.hasOwnProperty.call(colTituloMap, c)) {
        colunasNaoMapeadas.push({ col: c, letra: XLSX.utils.encode_col(c), header: h });
      }
    }

    for (let i = dIdx; i < m.length; i++) {
      const row = m[i];
      if (linhaVazia(row)) continue;
      const cod = normalizarCodigoCliente(cel(row, COL.ABA1_D_COD_CLIENTE));
      const proc = parseNumeroProcesso(cel(row, COL.ABA1_M_PROC));
      const dim = parseDimensao(cel(row, COL.ABA1_N_DIM));
      const parc = parseParcelaNum(cel(row, COL.ABA1_L_PARCELA));
      if (!cod || proc == null || dim == null) {
        avisos.push(`Aba débitos linha ${i + 1}: sem código/proc/dimensão válidos — ignorada para agregação.`);
        continue;
      }
      const key = chaveRodada(cod, proc, dim);
      if (!porChaveTitulos[key]) {
        porChaveTitulos[key] = { titulos: [], linhas: [], parcelasRef: [] };
      }
      const tit = linhaParaTitulo(row, headerRow, colTituloMap);
      porChaveTitulos[key].titulos.push({ ...tit, _planilhaLinha: i + 1, _parcelaPlanilha: parc });
      porChaveTitulos[key].linhas.push(i + 1);
      if (parc != null) porChaveTitulos[key].parcelasRef.push(parc);
    }

    if (!json) {
      console.log('# Relatório — Aba 1 (débitos cadastrados / Títulos)\n');
      console.log(`Ficheiro: ${abs}`);
      console.log(`Aba: ${nameDebitos}`);
      console.log(`Cabeçalho: linha ${HEADER_ROW_1BASED}; dados: linha ${DATA_START_1BASED}+`);
      console.log('\n## Reforço de colunas (índice 0-based / letra Excel)\n');
      console.log('| Campo | Coluna |');
      console.log('|-------|--------|');
      console.log(`| Código Cliente | D (${COL.ABA1_D_COD_CLIENTE}) |`);
      console.log(`| Vencimento | G (${COL.ABA1_G_VENCIMENTO}) |`);
      console.log(`| Valor (título) | I (${COL.ABA1_I_VALOR}) |`);
      console.log(`| Parcela (referência) | L (${COL.ABA1_L_PARCELA}) |`);
      console.log(`| Proc | M (${COL.ABA1_M_PROC}) |`);
      console.log(`| Dimensão | N (${COL.ABA1_N_DIM}) |`);
      console.log(`\nColunas de cabeçalho mapeadas para campos de Títulos: ${Object.keys(colTituloMap).length}`);
      if (colunasNaoMapeadas.length) {
        console.log('\n### Cabeçalhos não mapeados automaticamente (rever manualmente)\n');
        for (const x of colunasNaoMapeadas.slice(0, 40)) {
          console.log(`- Col ${x.letra} (${x.col}): «${x.header}»`);
        }
        if (colunasNaoMapeadas.length > 40) {
          console.log(`- … e mais ${colunasNaoMapeadas.length - 40} colunas`);
        }
      }
      const nChaves = Object.keys(porChaveTitulos).length;
      let nLinhas = 0;
      for (const v of Object.values(porChaveTitulos)) nLinhas += v.titulos.length;
      console.log(`\n**Resumo:** ${nChaves} chaves (cliente|proc|dim), ${nLinhas} linhas de dados com chave válida.\n`);
    }
  }

  if (nameRel) {
    const m = sheetToMatrix(wb, nameRel);
    for (let i = dIdx; i < m.length; i++) {
      const row = m[i];
      if (linhaVazia(row)) continue;
      const flag = String(cel(row, COL.ABA2_N_FLAG_SIM) ?? '')
        .trim()
        .toUpperCase();
      if (flag !== 'SIM') continue;

      const cod = normalizarCodigoCliente(cel(row, COL.ABA2_D_COD_CLIENTE));
      const proc = parseNumeroProcesso(cel(row, COL.ABA2_M_PROC));
      const dim = parseDimensao(cel(row, COL.ABA2_U_DIM));
      const parc = parseParcelaNum(cel(row, COL.ABA2_L_PARCELA));
      if (!cod || proc == null || dim == null) {
        avisos.push(`Aba relatório linha ${i + 1}: coluna N=SIM mas chave inválida — ignorada.`);
        continue;
      }
      const key = chaveRodada(cod, proc, dim);
      const parcela = {
        numero: parc,
        dataVencimento: parseData(cel(row, COL.ABA2_G_VENCIMENTO)),
        dataPagamento: parseData(cel(row, COL.ABA2_H_PAGAMENTO)),
        valorParcela: parseValorMonetario(cel(row, COL.ABA2_I_VALOR)),
        honorariosParcela: null,
        observacao: parseTexto(cel(row, COL.ABA2_K_OBS)),
      };
      if (parcela.numero == null) {
        avisos.push(`Aba relatório linha ${i + 1}: parcela inválida (col. L) — ignorada.`);
        continue;
      }
      if (!porChaveParcelamento[key]) {
        porChaveParcelamento[key] = { parcelas: [], linhas: [], aceitarPagamento: true };
      }
      porChaveParcelamento[key].parcelas.push({ ...parcela, _planilhaLinha: i + 1 });
      porChaveParcelamento[key].linhas.push(i + 1);
    }

    if (!json) {
      console.log('\n---\n');
      console.log('# Relatório — Aba 2 (Relatório 001–999 / Parcelamento + Pagamentos)\n');
      console.log(`Aba: ${nameRel}`);
      console.log('Filtro: coluna N = **SIM** (case-insensitive).');
      console.log('\n## Reforço de colunas\n');
      console.log('| Campo | Coluna |');
      console.log('|-------|--------|');
      console.log(`| Código Cliente | D (${COL.ABA2_D_COD_CLIENTE}) |`);
      console.log(`| Proc | M (${COL.ABA2_M_PROC}) |`);
      console.log(`| Flag importação pagamento | N (${COL.ABA2_N_FLAG_SIM}) |`);
      console.log(`| Parcela | L (${COL.ABA2_L_PARCELA}) |`);
      console.log(`| Vencimento | G (${COL.ABA2_G_VENCIMENTO}) |`);
      console.log(`| Data pagamento | H (${COL.ABA2_H_PAGAMENTO}) |`);
      console.log(`| Valor | I (${COL.ABA2_I_VALOR}) |`);
      console.log(`| Observação parcela | K (${COL.ABA2_K_OBS}) |`);
      console.log(`| Dimensão | U (${COL.ABA2_U_DIM}) |`);

      const nChavesP = Object.keys(porChaveParcelamento).length;
      let nParc = 0;
      for (const v of Object.values(porChaveParcelamento)) nParc += v.parcelas.length;
      console.log(`\n**Resumo:** ${nChavesP} chaves com ≥1 linha SIM, ${nParc} parcelas.\n`);
      console.log('**Efeito previsto no sistema:**');
      console.log('- `parcelamentoAceito: true` (checkbox «Aceitar Pagamento») para cada chave acima.');
      console.log('- `parcelas[]` preenchido na rodada (PUT /api/calculos/rodadas/{cod8}/{proc}/{dim}).');
      console.log('- **Pagamentos (módulo Pagamentos):** cada parcela SIM implica criar/atualizar registo;');
      console.log('  o body deve incluir `clienteId` e opcionalmente `processoId` (resolução via API antes do POST).');
    }
  }

  /** Rascunho JSON para inspeção / futuro importador */
  const payloadRelatorio = {
    ficheiro: abs,
    abas: { debitosCadastrados: nameDebitos, relatorio001999: nameRel },
    titulosPorChave: porChaveTitulos,
    parcelamentoPorChave: porChaveParcelamento,
    avisos,
    duvidasSugeridas: [
      'Aba 1: cada linha da planilha corresponde a **uma linha na grade Títulos** (mesmo índice que «Parcela» na coluna L) ou há mais de uma linha por parcela?',
      'Colunas não mapeadas na aba 1: devem alimentar `debitos[]` da rodada (antes na segunda aba do script antigo), `titulos[]` com outro campo, ou ignorar?',
      'Pagamentos: usar `formaPagamento` e `categoria` fixos (ex.: TRANSFERENCIA / HONORARIOS) ou existem colunas na planilha?',
      '`dataPagamento` em H quando vazio: criar pagamento como **pendente** (status AGENDADO/PENDENTE) ou não criar até haver data?',
      'Honorários por parcela (aba 2): não indicados — devem vir da aba Títulos ou ficar nulos?',
      'Conflitos: se uma chave existe na aba 1 e na aba 2, o PUT da rodada deve **fundir** `titulos` importados da aba 1 com `parcelas` da aba 2 na mesma chave?',
    ],
  };

  if (json) {
    console.log(JSON.stringify(payloadRelatorio, null, 2));
  } else {
    console.log('\n---\n');
    console.log('# Dúvidas em aberto (validar antes do import real)\n');
    payloadRelatorio.duvidasSugeridas.forEach((d, i) => {
      console.log(`${i + 1}. ${d}`);
    });
    if (avisos.length) {
      console.log('\n## Avisos durante a leitura\n');
      for (const a of avisos.slice(0, 50)) console.log(`- ${a}`);
      if (avisos.length > 50) console.log(`- … +${avisos.length - 50} avisos`);
    }

    console.log('\n---\n');
    console.log('Para exportar este relatório estruturado em JSON (p. ex. para automatizar):');
    console.log(`  node scripts/relatorio-import-calculo-planilha.mjs "${abs}" --json`);
  }
}

main();
