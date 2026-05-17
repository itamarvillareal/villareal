#!/usr/bin/env node
/**
 * Relatório e pré-análise do import `import-calculo.xls` (layout 2026).
 *
 * Não grava na API: apenas lê a planilha, valida colunas, agrupa por cliente/proc/dimensão
 * e descreve o que seria gerado (rodadas de cálculo + rascunhos de pagamentos).
 *
 * Uso:
 *   node scripts/relatorio-import-calculo-planilha.mjs [--json]
 *   node scripts/relatorio-import-calculo-planilha.mjs "/outro/import-calculo.xls" [--json]
 *   (sem caminho: procura import-calculo.xls na pasta sistema / Dropbox — igual aos outros imports)
 *
 * Linhas cabeçalho/dados (1-based): por defeito tenta inferir nas primeiras ~80 linhas; pode forçar com
 *   --header-row=N --data-row=N ou --header-row-aba1= --data-row-aba1= --header-row-aba2= --data-row-aba2=
 *
 * Layout (confirmar com seu ficheiro real):
 * - Cabeçalho/dados: inferidos nas primeiras ~80 linhas (por texto nas cols C/L/M na aba 1 e B/K/S na aba 2), ou fixados por CLI `--header-row` / `--data-row` / por aba.
 * - Constantes legado: linha 6 = cabeçalho, linha 7+ = dados (quando a inferência falha ou não encontra marcadores).
 * - Aba 1: nome contém "relatorio" e "debitos" e "cadastrad" (ex.: "Relatorio Debitos Cadastrad (4)").
 * - Aba 2: nome contém "relatorio" e ("001" ou "999") (ex.: "Relatório - 001 a 999").
 */

import XLSX from 'xlsx';
import {
  COL_LAYOUT2026 as COL,
  DATA_START_1BASED_LAYOUT2026 as DATA_START_1BASED,
  HEADER_ROW_1BASED_LAYOUT2026 as HEADER_ROW_1BASED,
  parseLayout2026FromWorkbook,
} from './lib/import-calculo-layout2026-parse.mjs';
import { candidatosImportCalculoXlsParaLog, resolveImportCalculoXlsPath } from './lib/resolve-import-calculo-xls.mjs';

function parseLinhaPlanilha1BasedArg(val, flag) {
  const n = Number(String(val).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    console.error(`[relatório] ${flag} deve ser um inteiro ≥ 1 (linha 1-based).`);
    process.exit(1);
  }
  return n;
}

function parseArgs(argv) {
  let file = null;
  let json = false;
  let layoutHeaderRow = null;
  let layoutDataRow = null;
  let layoutHeaderRowAba1 = null;
  let layoutDataRowAba1 = null;
  let layoutHeaderRowAba2 = null;
  let layoutDataRowAba2 = null;
  for (const a of argv) {
    if (a === '--json') json = true;
    else if (a.startsWith('--header-row='))
      layoutHeaderRow = parseLinhaPlanilha1BasedArg(a.slice(13), '--header-row');
    else if (a.startsWith('--data-row='))
      layoutDataRow = parseLinhaPlanilha1BasedArg(a.slice(11), '--data-row');
    else if (a.startsWith('--header-row-aba1='))
      layoutHeaderRowAba1 = parseLinhaPlanilha1BasedArg(a.slice(18), '--header-row-aba1');
    else if (a.startsWith('--data-row-aba1='))
      layoutDataRowAba1 = parseLinhaPlanilha1BasedArg(a.slice(16), '--data-row-aba1');
    else if (a.startsWith('--header-row-aba2='))
      layoutHeaderRowAba2 = parseLinhaPlanilha1BasedArg(a.slice(18), '--header-row-aba2');
    else if (a.startsWith('--data-row-aba2='))
      layoutDataRowAba2 = parseLinhaPlanilha1BasedArg(a.slice(16), '--data-row-aba2');
    else if (!a.startsWith('-') && !file) file = a;
  }
  return {
    file,
    json,
    layoutOpts: buildLayoutOpts({
      layoutHeaderRow,
      layoutDataRow,
      layoutHeaderRowAba1,
      layoutDataRowAba1,
      layoutHeaderRowAba2,
      layoutDataRowAba2,
    }),
  };
}

function buildLayoutOpts(p) {
  /** @type {Record<string, number>} */
  const o = {};
  if (p.layoutHeaderRow != null) o.headerRow = p.layoutHeaderRow;
  if (p.layoutDataRow != null) o.dataRow = p.layoutDataRow;
  if (p.layoutHeaderRowAba1 != null) o.headerRowAba1 = p.layoutHeaderRowAba1;
  if (p.layoutDataRowAba1 != null) o.dataRowAba1 = p.layoutDataRowAba1;
  if (p.layoutHeaderRowAba2 != null) o.headerRowAba2 = p.layoutHeaderRowAba2;
  if (p.layoutDataRowAba2 != null) o.dataRowAba2 = p.layoutDataRowAba2;
  return o;
}

function metaLinhasStr(meta) {
  if (!meta) return null;
  const suf =
    meta.inferred === false ? '' : ` (inferido${meta.score != null ? `, score=${meta.score}` : ''})`;
  return `linha ${meta.header1Based} (cabeçalho); dados a partir da linha ${meta.data1Based}${suf}`;
}

function main() {
  const { file, json, layoutOpts } = parseArgs(process.argv.slice(2));
  const abs = resolveImportCalculoXlsPath(file);
  if (!abs) {
    console.error('import-calculo.xls não encontrado. Tentados:');
    for (const p of candidatosImportCalculoXlsParaLog(file)) console.error(' ', p);
    process.exit(1);
  }
  console.log(`[relatório] planilha: ${abs}`);
  const wb = XLSX.readFile(abs, { cellDates: true, raw: true });
  const parsed = parseLayout2026FromWorkbook(wb, layoutOpts);
  const {
    nameDebitos,
    nameRel,
    titulosPorChave: porChaveTitulos,
    parcelamentoPorChave: porChaveParcelamento,
    avisos,
    colunasNaoMapeadasDebitos: colunasNaoMapeadas,
    colTituloMapDebitos,
    layoutLinhas,
  } = parsed;

  const avisosOut = [...avisos];
  if (!nameDebitos) {
    avisosOut.unshift('Aba «Relatorio Debitos Cadastrad…» não encontrada pelo padrão (relatorio+debitos+cadastrad).');
  }
  if (!nameRel) {
    avisosOut.unshift('Aba «Relatório - 001 a 999» não encontrada pelo padrão (relatorio + 001 ou 999).');
  }

  const duvidasSugeridas = [
    'Verificar na aba 1 se restam colunas só para Custas Judiciais (`debitos[]`) após mapear Títulos / Descrição / datas especiais.',
    'Honorários por parcela (aba 2): coluna dedicada ou sempre vazio?',
  ];

  const linhasAba1PorCliente = new Map();
  for (const [key, entry] of Object.entries(porChaveTitulos)) {
    const cod8 = key.split('|')[0];
    linhasAba1PorCliente.set(cod8, (linhasAba1PorCliente.get(cod8) ?? 0) + entry.titulos.length);
  }
  const linhasAba2PorCliente = new Map();
  for (const [key, entry] of Object.entries(porChaveParcelamento)) {
    const cod8 = key.split('|')[0];
    linhasAba2PorCliente.set(cod8, (linhasAba2PorCliente.get(cod8) ?? 0) + entry.parcelas.length);
  }

  const payloadRelatorio = {
    ficheiro: abs,
    abas: { debitosCadastrados: nameDebitos, relatorio001999: nameRel },
    layoutLinhas,
    titulosPorChave: porChaveTitulos,
    parcelamentoPorChave: porChaveParcelamento,
    avisos: avisosOut,
    duvidasSugeridas,
    estatisticasClientes: {
      titulosPorCod8: Object.fromEntries(linhasAba1PorCliente),
      parcelasPorCod8: Object.fromEntries(linhasAba2PorCliente),
    },
  };

  if (json) {
    console.log(JSON.stringify(payloadRelatorio, null, 2));
    return;
  }

  if (nameDebitos) {
    console.log('# Relatório — Aba 1 (débitos cadastrados / Títulos)\n');
    console.log(`Ficheiro: ${abs}`);
    console.log(`Aba: ${nameDebitos}`);
    const m1 = layoutLinhas?.aba1;
    console.log(
      m1
        ? `Cabeçalho/dados (aba 1): ${metaLinhasStr(m1)}`
        : `Cabeçalho: linha ${HEADER_ROW_1BASED}; dados: linha ${DATA_START_1BASED}+`
    );
    console.log('\n## Reforço de colunas (índice 0-based / letra Excel)\n');
    console.log('| Campo | Coluna |');
    console.log('|-------|--------|');
    console.log(`| Código Cliente | ${XLSX.utils.encode_col(COL.ABA1_COD_CLIENTE)} (${COL.ABA1_COD_CLIENTE}) |`);
    console.log(`| Vencimento | ${XLSX.utils.encode_col(COL.ABA1_VENCIMENTO)} (${COL.ABA1_VENCIMENTO}) |`);
    console.log(`| Valor (título) | ${XLSX.utils.encode_col(COL.ABA1_VALOR_TITULO)} (${COL.ABA1_VALOR_TITULO}) |`);
    console.log(`| Parcela (referência) | ${XLSX.utils.encode_col(COL.ABA1_PARCELA_REF)} (${COL.ABA1_PARCELA_REF}) |`);
    console.log(`| Proc | ${XLSX.utils.encode_col(COL.ABA1_PROC)} (${COL.ABA1_PROC}) |`);
    console.log(`| Dimensão | ${XLSX.utils.encode_col(COL.ABA1_DIM)} (${COL.ABA1_DIM}) |`);
    console.log(`\nColunas de cabeçalho mapeadas para campos de Títulos: ${Object.keys(colTituloMapDebitos).length}`);
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

  if (nameRel) {
    console.log('\n---\n');
    console.log('# Relatório — Aba 2 (Relatório 001–999 / Parcelamento + Pagamentos)\n');
    console.log(`Aba: ${nameRel}`);
    const m2 = layoutLinhas?.aba2;
    if (m2) console.log(`Cabeçalho/dados (aba 2): ${metaLinhasStr(m2)}`);
    console.log('Filtro: coluna L «Cálculo Aceito» = **SIM** (case-insensitive).');
    console.log('\n## Reforço de colunas\n');
    console.log('| Campo | Coluna |');
    console.log('|-------|--------|');
    console.log(`| Código Cliente | ${XLSX.utils.encode_col(COL.ABA2_COD_CLIENTE)} (${COL.ABA2_COD_CLIENTE}) |`);
    console.log(`| Proc | ${XLSX.utils.encode_col(COL.ABA2_PROC)} (${COL.ABA2_PROC}) |`);
    console.log(`| Cálculo Aceito (importa parcelamento) | ${XLSX.utils.encode_col(COL.ABA2_FLAG_CALCULO_ACEITO_SIM)} (${COL.ABA2_FLAG_CALCULO_ACEITO_SIM}) |`);
    console.log(`| Parcela | ${XLSX.utils.encode_col(COL.ABA2_PARCELA)} (${COL.ABA2_PARCELA}) |`);
    console.log(`| Vencimento | ${XLSX.utils.encode_col(COL.ABA2_VENCIMENTO)} (${COL.ABA2_VENCIMENTO}) |`);
    console.log(`| Data pagamento | ${XLSX.utils.encode_col(COL.ABA2_DATA_PAGAMENTO)} (${COL.ABA2_DATA_PAGAMENTO}) |`);
    console.log(`| Valor | ${XLSX.utils.encode_col(COL.ABA2_VALOR)} (${COL.ABA2_VALOR}) |`);
    console.log(`| Observação parcela | ${XLSX.utils.encode_col(COL.ABA2_OBS_PARCELA)} (${COL.ABA2_OBS_PARCELA}) |`);
    console.log(`| Dimensão | ${XLSX.utils.encode_col(COL.ABA2_DIM)} (${COL.ABA2_DIM}) |`);

    const nChavesP = Object.keys(porChaveParcelamento).length;
    let nParc = 0;
    for (const v of Object.values(porChaveParcelamento)) nParc += v.parcelas.length;
    console.log(`\n**Resumo:** ${nChavesP} chaves com ≥1 linha SIM, ${nParc} parcelas.\n`);
    console.log('**Efeito previsto no sistema:**');
    console.log('- `parcelamentoAceito: true` (checkbox «Aceitar Pagamento») para cada chave acima.');
    console.log('- `parcelas[]` preenchido na rodada (PUT /api/calculos/rodadas/{cod8}/{proc}/{dim}).');
    console.log('- **Pagamentos (API):** apenas quando a coluna **F** (data pagamento) tiver data efetiva; caso contrário só atualiza rodada/parcelamento.');
    console.log('  `POST /api/pagamentos` aceita `descricao`, `categoria`, `formaPagamento` e `status` omitidos — o servidor normaliza (strings vazias; status → PENDENTE).');
  }

  console.log('\n---\n');
  console.log('# Dúvidas em aberto (validar antes do import real)\n');
  duvidasSugeridas.forEach((d, i) => {
    console.log(`${i + 1}. ${d}`);
  });
  if (avisosOut.length) {
    console.log('\n## Avisos durante a leitura\n');
    for (const a of avisosOut.slice(0, 50)) console.log(`- ${a}`);
    if (avisosOut.length > 50) console.log(`- … +${avisosOut.length - 50} avisos`);
  }

  console.log('\n---\n');
  console.log('Para exportar este relatório estruturado em JSON (p. ex. para automatizar):');
  console.log(`  node scripts/relatorio-import-calculo-planilha.mjs "${abs}" --json`);
  console.log('\nPara gravar na API (layout 2026), mesmo padrão que histórico/processos:');
  console.log(`  node scripts/import-calculos-planilha-layout2026.mjs --login=itamar`);
}

main();
