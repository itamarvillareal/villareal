/**
 * Exportação de relatório das publicações listadas na UI (respeita filtros atuais).
 * CSV UTF-8 com BOM para abrir corretamente no Excel.
 */

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function campoResumo(row) {
  const r = String(row?.resumoPublicacao ?? '').trim();
  if (r) return r.slice(0, 8000);
  const t = String(row?.teorIntegral ?? '').trim();
  return t ? t.slice(0, 8000) : '';
}

/**
 * @param {Array<Record<string, unknown>>} rows — itens no formato da grade (API ou legado)
 * @returns {string} conteúdo CSV (com BOM)
 */
export function montarCsvRelatorioPublicacoes(rows) {
  const headers = [
    'id',
    'numero_cnj',
    'codigo_cliente',
    'proc_interno',
    'cliente',
    'data_publicacao',
    'data_disponibilizacao',
    'diario',
    'tipo_publicacao',
    'status_validacao_cnj',
    'score_confianca',
    'status_vinculo_ui',
    'status_tratamento_api',
    'origem_importacao',
    'processo_id_api',
    'cliente_id_api',
    'arquivo_origem',
    'hash_arquivo',
    'observacao',
    'resumo_ou_teor',
  ];
  const lines = [headers.join(',')];
  for (const row of rows || []) {
    const line = [
      csvEscape(row.id),
      csvEscape(row.numero_processo_cnj || row.numeroCnj),
      csvEscape(row.codCliente),
      csvEscape(row.procInterno),
      csvEscape(row.cliente),
      csvEscape(row.dataPublicacao),
      csvEscape(row.dataDisponibilizacao),
      csvEscape(row.diario),
      csvEscape(row.tipoPublicacao),
      csvEscape(row.statusValidacaoCnj),
      csvEscape(row.scoreConfianca),
      csvEscape(row.statusVinculo),
      csvEscape(row._statusTratamento),
      csvEscape(row._origemImportacao),
      csvEscape(row._processoId),
      csvEscape(row._clienteId),
      csvEscape(row.arquivoOrigem),
      csvEscape(row.hashArquivo),
      csvEscape(row.observacoesTecnicas),
      csvEscape(campoResumo(row)),
    ].join(',');
    lines.push(line);
  }
  return `\ufeff${lines.join('\r\n')}`;
}

/**
 * Dispara download do ficheiro no browser.
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ nomeArquivo?: string }} [opts]
 */
export function downloadRelatorioPublicacoesCsv(rows, opts = {}) {
  const csv = montarCsvRelatorioPublicacoes(rows);
  const nome =
    opts.nomeArquivo ||
    `relatorio-publicacoes-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
