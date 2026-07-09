import {
  analisarLancamentosNovosDedupe,
  dataLancamentoParaIso,
  listarChavesSemanticasLancamento,
  parseOfxToExtrato,
  sanitizarLancamentoImportacaoExtrato,
} from '../../../utils/ofx.js';
import {
  aplicarProtecaoDataCorteImportacao,
  aplicarProtecaoDataCorteImportacaoComData,
  formatarDataCorteBr,
} from '../../../utils/extratoImportProtecao.js';

function parseOfxDtTag(raw) {
  const s = String(raw ?? '').trim();
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** OFX usa ponto decimal (5743.46); formato BR só quando há vírgula. */
function parseOfxAmount(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.includes(',')) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Há lançamentos faltando ou sobrando no período do OFX. */
export function transacoesDesalinhadasNoPeriodoOfx(diag) {
  if (!diag) return false;
  return (diag.faltamNoSistema?.length ?? 0) > 0 || (diag.sobramNoSistema?.length ?? 0) > 0;
}

/** Saldo declarado no OFX (LEDGERBAL) difere do saldo do sistema na data final. */
export function saldoLedgerDesalinhadoComOfx(diag) {
  if (!diag) return false;
  const diff =
    diag.meta?.saldoLedger != null && diag.totais?.saldoSistema != null
      ? diag.totais.saldoSistema - diag.meta.saldoLedger
      : null;
  return diff != null && Math.abs(diff) >= 0.01;
}

/** True se faltam/sobram no período — base para reparo e «Continuar importação». */
export function precisaReparoExtratoComOfx(diag) {
  return transacoesDesalinhadasNoPeriodoOfx(diag);
}

export function extratoAlinhadoComOfx(diag) {
  return !transacoesDesalinhadasNoPeriodoOfx(diag);
}

/** Lançamentos do período e saldo (LEDGERBAL) coincidem com o OFX. */
export function extratoFielComOfx(diag) {
  return extratoAlinhadoComOfx(diag) && !saldoLedgerDesalinhadoComOfx(diag);
}

/**
 * «Continuar importação» no modal: mesclagem com proteção de corte.
 * - Alinhado no período → ok.
 * - Alinhamento de saldo incoerente (histórico anterior ao OFX) → ok (só mesclar).
 * - Sobram no período → precisa excluir antes.
 * - Faltam coerentes → precisa «Alinhar saldo com OFX» antes.
 */
export function podeContinuarImportacaoExtratoComOfx(diag) {
  if (!diag) return false;
  if (extratoAlinhadoComOfx(diag)) return true;
  if ((diag.sobramNoSistema?.length ?? 0) > 0) return false;
  if (!alinhamentoSaldoCoerenteComOfx(diag)) return true;
  return false;
}

/** Metadados do arquivo OFX (período e saldo declarado pelo banco). */
export function extrairMetadadosOfx(ofxText) {
  const txt = String(ofxText ?? '');
  const ledgerBlock = txt.match(/<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>/i)?.[0] ?? '';
  const balMatch = ledgerBlock.match(/<BALAMT>([^<\r\n]+)/i);
  const saldoLedger = balMatch ? parseOfxAmount(balMatch[1]) : null;
  const dataInicio = parseOfxDtTag(txt.match(/<DTSTART>([^<]+)/i)?.[1]);
  const dataFim = parseOfxDtTag(txt.match(/<DTEND>([^<]+)/i)?.[1]);
  return { dataInicio, dataFim, saldoLedger };
}

/** Período e saldo final inferidos das linhas do extrato (PDF BTG etc.). */
export function extrairMetadadosDeRows(rows) {
  const isos = (rows ?? []).map((r) => dataLancamentoParaIso(r?.data)).filter(Boolean);
  let dataInicio = null;
  let dataFim = null;
  if (isos.length) {
    dataInicio = isos.reduce((a, b) => (a < b ? a : b));
    dataFim = isos.reduce((a, b) => (a > b ? a : b));
  }
  let saldoLedger = null;
  const comSaldo = (rows ?? []).filter((r) => Number.isFinite(Number(r.saldo)));
  if (comSaldo.length) {
    const ordenados = [...comSaldo].sort((a, b) => {
      const da = dataLancamentoParaIso(a.data) ?? '';
      const db = dataLancamentoParaIso(b.data) ?? '';
      const c = da.localeCompare(db);
      if (c !== 0) return c;
      return String(a.numero ?? '').localeCompare(String(b.numero ?? ''));
    });
    saldoLedger = Number(ordenados[ordenados.length - 1].saldo);
  }
  return { dataInicio, dataFim, saldoLedger };
}

/** Valor com sinal para somas (OFX já vem assinado; API pode vir absoluto + natureza). */
function valorAssinadoParaSoma(t) {
  const n = Number(t?.valor);
  if (!Number.isFinite(n)) return 0;
  const nat = String(t?.natureza ?? '').toUpperCase();
  if (nat === 'DEBITO') return -Math.abs(n);
  if (nat === 'CREDITO') return Math.abs(n);
  return n;
}

function somaValores(rows) {
  return (rows ?? []).reduce((s, t) => s + valorAssinadoParaSoma(t), 0);
}

function ofxDentroPeriodo(ofxRows, dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return ofxRows ?? [];
  return (ofxRows ?? []).filter((t) => {
    const iso = dataLancamentoParaIso(t?.data);
    return iso && iso >= dataInicio && iso <= dataFim;
  });
}

/** Diferença de saldo esperada vs efeito líquido do reparo (faltam − sobram). */
export function calcularDeltasAlinhamentoSaldo(diag) {
  const deltaEsperado =
    diag?.meta?.saldoLedger != null && diag?.totais?.saldoSistema != null
      ? diag.meta.saldoLedger - diag.totais.saldoSistema
      : null;
  const deltaReparo = (diag?.totais?.somaFaltam ?? 0) - (diag?.totais?.somaSobram ?? 0);
  const coerente =
    deltaEsperado == null || Math.abs(deltaReparo - deltaEsperado) < 0.01;
  return { deltaEsperado, deltaReparo, coerente };
}

export function alinhamentoSaldoCoerenteComOfx(diag) {
  return calcularDeltasAlinhamentoSaldo(diag).coerente;
}

/** Saldo projetado após importar faltantes e excluir sobras (sem I/O). */
export function calcularSaldoAposReparo(saldoSistema, somaFaltam, somaSobram) {
  if (saldoSistema == null || !Number.isFinite(Number(saldoSistema))) return null;
  const delta = (Number(somaFaltam) || 0) - (Number(somaSobram) || 0);
  return Number(saldoSistema) + delta;
}

/**
 * OFX com FITID ausente no sistema que o dedupe semântico tratou como já gravado
 * (ex.: vários PIX VRV -5.000 no mesmo dia na mesma chave).
 */
export function detectarFaltantesOcultosPorDedupe(
  ofxNoPeriodo,
  existenteNoPeriodo,
  faltamNoSistema,
  analiseFaltam = null,
) {
  const sysNums = new Set(
    (existenteNoPeriodo ?? [])
      .map((t) => String(t?.numero ?? '').trim())
      .filter(Boolean),
  );
  const faltamNums = new Set(
    (faltamNoSistema ?? []).map((t) => String(t?.numero ?? '').trim()).filter(Boolean),
  );

  const candidatos = (analiseFaltam?.ignoradosDetalhe ?? [])
    .filter((x) => x.motivo === 'chave_semantica')
    .map((x) => x.row)
    .filter((o) => {
      const n = String(o?.numero ?? '').trim();
      return n && !sysNums.has(n) && !faltamNums.has(n);
    });

  if (!candidatos.length) {
    return [];
  }

  const seen = new Set();
  const out = [];
  for (const row of candidatos) {
    const n = String(row?.numero ?? '').trim();
    if (!n || seen.has(n)) continue;
    const chaves = listarChavesSemanticasLancamento(row);
    const colidiu = candidatos.some((outro) => {
      if (outro === row) return false;
      const on = String(outro?.numero ?? '').trim();
      if (!on || on === n) return false;
      const outras = listarChavesSemanticasLancamento(outro);
      return chaves.some((k) => outras.includes(k));
    });
    if (colidiu) {
      seen.add(n);
      out.push(row);
    }
  }
  return out;
}

function formatarMoeda(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Lançamentos gravados dentro do intervalo DTSTART–DTEND do OFX. */
function existenteDentroPeriodoOfx(existenteAll, dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return existenteAll ?? [];
  return (existenteAll ?? []).filter((t) => {
    const iso = dataLancamentoParaIso(t?.data);
    return iso && iso >= dataInicio && iso <= dataFim;
  });
}

/** Lançamentos gravados fora do intervalo DTSTART–DTEND do OFX (ignorados na análise). */
function existenteForaPeriodoOfx(existenteAll, dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return [];
  return (existenteAll ?? []).filter((t) => {
    const iso = dataLancamentoParaIso(t?.data);
    return iso && (iso < dataInicio || iso > dataFim);
  });
}

function montarSobramNoSistema(ofxRows, existenteAll, meta) {
  const existenteNoPeriodo = existenteDentroPeriodoOfx(
    existenteAll,
    meta.dataInicio,
    meta.dataFim,
  );
  const analiseSobra = analisarLancamentosNovosDedupe(ofxRows, existenteNoPeriodo, {
    respeitarExtratoComoMestre: true,
  });
  return analiseSobra.novos;
}

function montarConclusao({
  meta,
  totais,
  faltamNoSistema,
  sobramNoSistema,
  faltamOcultosPorDedupe = [],
}) {
  const linhas = [];
  const diffSaldo =
    meta.saldoLedger != null && totais.saldoSistema != null
      ? totais.saldoSistema - meta.saldoLedger
      : null;

  if (meta.dataInicio && meta.dataFim) {
    linhas.push(
      `Período do arquivo: ${meta.dataInicio.split('-').reverse().join('/')} — ${meta.dataFim.split('-').reverse().join('/')}.`,
    );
  }

  if (meta.saldoLedger != null && Math.abs(meta.saldoLedger) < 0.005) {
    linhas.push('O OFX declara saldo final **zero** no banco.');
  } else if (meta.saldoLedger != null) {
    linhas.push(`Saldo final no OFX (LEDGERBAL): ${formatarMoeda(meta.saldoLedger)}.`);
  }

  if (totais.saldoSistema != null) {
    linhas.push(`Saldo atual no sistema: ${formatarMoeda(totais.saldoSistema)}.`);
  }

  if (Number(totais.saldoInicialSistema)) {
    linhas.push(
      `Saldo de abertura cadastrado: ${formatarMoeda(totais.saldoInicialSistema)} — confira se coincide com o banco.`,
    );
  }

  if (diffSaldo != null && Math.abs(diffSaldo) >= 0.01) {
    linhas.push(
      `Saldo na data final: sistema ${formatarMoeda(totais.saldoSistema)} vs OFX ${formatarMoeda(meta.saldoLedger)} (diferença ${formatarMoeda(diffSaldo)}). Confira saldo de abertura ou use OFX histórico completo.`,
    );
  }

  const { deltaEsperado, deltaReparo, coerente } = calcularDeltasAlinhamentoSaldo({
    meta,
    totais,
    faltamNoSistema,
    sobramNoSistema,
  });

  if (faltamOcultosPorDedupe.length > 0) {
    linhas.push(
      `${faltamOcultosPorDedupe.length} lançamento(s) do OFX têm FITID ausente no sistema mas **não** aparecem como faltantes (pareamento semântico) — soma ${formatarMoeda(totais.somaFaltamOcultos)}.`,
    );
  }

  if (faltamNoSistema.length > 0) {
    linhas.push(
      `${faltamNoSistema.length} lançamento(s) do OFX **não constam** no sistema (soma ${formatarMoeda(totais.somaFaltam)}).`,
    );
  }

  if (
    coerente &&
    faltamNoSistema.length > 0 &&
    meta.saldoLedger != null &&
    totais.saldoAposReparo != null &&
    Math.abs(totais.saldoAposReparo - meta.saldoLedger) < 0.01
  ) {
    linhas.push(
      `Importar os faltantes fecha o saldo com o LEDGERBAL (${formatarMoeda(meta.saldoLedger)}). Use **Alinhar saldo com OFX**.`,
    );
  }

  if (
    deltaEsperado != null &&
    (faltamNoSistema.length > 0 || sobramNoSistema.length > 0) &&
    !coerente
  ) {
    linhas.push(
      `Efeito do reparo (${formatarMoeda(deltaReparo)}) **não bate** com a diferença de saldo (${formatarMoeda(deltaEsperado)}). ` +
        'Revise lançamentos ocultos pelo pareamento semântico, histórico anterior ao período ou saldo de abertura — **não** use «Alinhar» cegamente.',
    );
  }

  if (sobramNoSistema.length > 0) {
    linhas.push(
      `${sobramNoSistema.length} lançamento(s) no sistema **não constam** no OFX do período (soma ${formatarMoeda(totais.somaSobram)}).`,
    );
    linhas.push(
      'Use **Alinhar saldo com OFX** para excluir o que sobra e gravar o que falta, somente no intervalo do arquivo.',
    );
  }

  if (totais.existenteIgnoradosForaPeriodo > 0) {
    linhas.push(
      `${totais.existenteIgnoradosForaPeriodo} lançamento(s) fora do período do arquivo foram ignorados (não entram na análise).`,
    );
  }

  if (totais.faltamMesclagem != null && totais.faltamMesclagem !== faltamNoSistema.length) {
    linhas.push(
      `Na importação mesclada normal entrariam só ${totais.faltamMesclagem} linha(s) (corte ${totais.dataCorteBr || '—'}).`,
    );
  }

  if (
    faltamNoSistema.length === 0 &&
    sobramNoSistema.length === 0 &&
    (diffSaldo == null || Math.abs(diffSaldo) < 0.01)
  ) {
    linhas.push('Extrato fiel ao OFX (lançamentos e saldo).');
  } else if (faltamNoSistema.length === 0 && sobramNoSistema.length === 0) {
    if (diffSaldo != null && Math.abs(diffSaldo) >= 0.01 && totais.existenteIgnoradosForaPeriodo > 0) {
      linhas.push(
        `Lançamentos do período batem com o OFX, mas o saldo difere em ${formatarMoeda(diffSaldo)} porque há ${totais.existenteIgnoradosForaPeriodo} lançamento(s) **anterior(es) ao período** fora desta análise. Reparar só com OFX mensal não corrige o saldo — use OFX histórico completo ou «Limpar conta» e reimporte.`,
      );
    } else if (diffSaldo != null && Math.abs(diffSaldo) >= 0.01) {
      linhas.push(
        'Lançamentos do período alinhados; ajuste o **saldo de abertura** para fechar com o LEDGERBAL do banco.',
      );
    } else {
      linhas.push('Lançamentos do período alinhados com o OFX.');
    }
  }

  if (linhas.length === 0) {
    linhas.push('Análise concluída — revise as tabelas abaixo.');
  }

  return linhas;
}

/** Lançamentos «sobram no sistema» com id na API, prontos para exclusão. */
export function prepararExclusaoReparoExtrato(sobramNoSistema) {
  const linhas = (sobramNoSistema ?? []).filter((t) => Number(t.apiId) > 0);
  const apiIds = linhas.map((t) => Number(t.apiId));
  const semId = (sobramNoSistema ?? []).filter((t) => !(Number(t.apiId) > 0));
  return {
    apiIds,
    linhas,
    soma: somaValores(linhas),
    semId,
  };
}

export function prepararImportacaoReparoExtrato(
  faltamNoSistema,
  nomeBanco,
  numeroBanco,
  origemImportacao = 'OFX',
) {
  const origem = String(origemImportacao ?? 'OFX').trim() || 'OFX';
  const linhas = (faltamNoSistema ?? []).map((row) =>
    sanitizarLancamentoImportacaoExtrato({
      ...row,
      nomeBanco: String(nomeBanco ?? '').trim(),
      numeroBanco: Number(numeroBanco),
      origemImportacao: origem,
    }),
  );
  return { linhas, soma: somaValores(linhas) };
}

/**
 * Compara OFX com lançamentos já carregados (sem I/O).
 * Faltam/sobram limitam-se ao período DTSTART–DTEND do arquivo OFX.
 *
 * @param {object} opts
 * @param {string} opts.ofxText
 * @param {object[]} opts.existenteAll — lançamentos no período (ou todos, se OFX sem DTSTART/DTEND)
 * @param {object[]} [opts.existenteMesclagem] — base para estimativa de mesclagem (janela desde data de corte)
 * @param {object|null} [opts.saldoApi]
 * @param {string|null} [opts.dataCorteOverride] YYYY-MM-DD (evita recalcular corte no browser)
 * @param {number|null} [opts.sistemaTotalOverride] total ATIVO no banco (quando existenteAll é só o período)
 * @param {number|null} [opts.existenteIgnoradosForaPeriodoOverride]
 */
export function diagnosticarExtratoComArquivoCore({
  arquivoRows,
  meta,
  existenteAll,
  existenteMesclagem = null,
  saldoApi = null,
  dataCorteOverride = null,
  sistemaTotalOverride = null,
  existenteIgnoradosForaPeriodoOverride = null,
  origemImportacao = 'OFX',
}) {
  const origem = String(origemImportacao ?? 'OFX').trim() || 'OFX';
  const ofxRows = (arquivoRows ?? []).map((r) =>
    sanitizarLancamentoImportacaoExtrato({ ...r, origemImportacao: r.origemImportacao ?? origem }),
  );

  const existenteNoPeriodo = existenteDentroPeriodoOfx(
    existenteAll,
    meta.dataInicio,
    meta.dataFim,
  );
  const existenteIgnoradosForaPeriodo =
    existenteIgnoradosForaPeriodoOverride ??
    existenteForaPeriodoOfx(existenteAll, meta.dataInicio, meta.dataFim).length;

  const dataCorteIso = dataCorteOverride ? String(dataCorteOverride).slice(0, 10) : null;
  const protecao = dataCorteIso
    ? aplicarProtecaoDataCorteImportacaoComData(ofxRows, dataCorteIso)
    : aplicarProtecaoDataCorteImportacao(ofxRows, existenteAll, { modo: 'mesclar' });

  const ofxNoPeriodo = ofxDentroPeriodo(ofxRows, meta.dataInicio, meta.dataFim);

  const analiseFaltam = analisarLancamentosNovosDedupe(existenteNoPeriodo, ofxNoPeriodo, {
    respeitarExtratoComoMestre: true,
  });
  const faltamNoSistema = analiseFaltam.novos;

  const analiseMesclagem = analisarLancamentosNovosDedupe(
    existenteMesclagem ?? existenteAll,
    protecao.rows,
    {
      respeitarExtratoComoMestre: false,
    },
  );

  const sobramNoSistema = montarSobramNoSistema(ofxNoPeriodo, existenteAll, meta);
  const somaFaltam = somaValores(faltamNoSistema);
  const somaSobram = somaValores(sobramNoSistema);
  const saldoSistema = saldoApi?.saldo ?? null;
  const deltasAlinhamento = calcularDeltasAlinhamentoSaldo({
    meta,
    totais: {
      saldoSistema,
      somaFaltam,
      somaSobram,
    },
  });
  let faltamOcultosPorDedupe = detectarFaltantesOcultosPorDedupe(
    ofxNoPeriodo,
    existenteNoPeriodo,
    faltamNoSistema,
    analiseFaltam,
  );
  if (deltasAlinhamento.coerente) {
    faltamOcultosPorDedupe = [];
  }

  const totais = {
    ofxArquivo: ofxRows.length,
    ofxAposCorte: protecao.rows.length,
    sistemaTotal: sistemaTotalOverride ?? existenteAll.length,
    sistemaNoPeriodo: existenteNoPeriodo.length,
    faltamNoSistema: faltamNoSistema.length,
    faltamMesclagem: analiseMesclagem.novos.length,
    sobramNoSistema: sobramNoSistema.length,
    existenteIgnoradosForaPeriodo,
    /** @deprecated use existenteIgnoradosForaPeriodo */
    sobramForaPeriodo: existenteIgnoradosForaPeriodo,
    ignoradosDedupe: analiseFaltam.ignorados,
    ignoradosPorCorte: protecao.ignoradosPorCorte,
    somaOfxArquivo: somaValores(ofxRows),
    somaOfxNoPeriodo: somaValores(ofxNoPeriodo),
    somaSistemaNoPeriodo: somaValores(existenteNoPeriodo),
    somaSistemaTotal: somaValores(existenteAll),
    somaFaltam,
    somaSobram,
    faltamOcultosPorDedupe: faltamOcultosPorDedupe.length,
    somaFaltamOcultos: somaValores(faltamOcultosPorDedupe),
    saldoAposReparo: calcularSaldoAposReparo(saldoSistema, somaFaltam, somaSobram),
    saldoLedgerOfx: meta.saldoLedger,
    saldoSistema,
    saldoInicialSistema: saldoApi?.saldoInicial ?? null,
    dataCorte: protecao.dataCorte,
    dataCorteBr: formatarDataCorteBr(protecao.dataCorte),
    deltaSaldoEsperado: deltasAlinhamento.deltaEsperado,
    deltaSaldoReparo: deltasAlinhamento.deltaReparo,
    alinhamentoSaldoCoerente: deltasAlinhamento.coerente,
  };

  return {
    meta,
    totais,
    faltamNoSistema,
    sobramNoSistema,
    faltamOcultosPorDedupe,
    porDiaImport: Object.fromEntries(analiseFaltam.porDia),
    diasIgnoradosPorContagem: analiseFaltam.diasIgnoradosPorContagem ?? [],
    conclusao: montarConclusao({
      meta,
      totais,
      faltamNoSistema,
      sobramNoSistema,
      faltamOcultosPorDedupe,
    }),
  };
}

export function diagnosticarExtratoComOfxCore({
  ofxText,
  existenteAll,
  existenteMesclagem = null,
  saldoApi = null,
  dataCorteOverride = null,
  sistemaTotalOverride = null,
  existenteIgnoradosForaPeriodoOverride = null,
}) {
  const meta = extrairMetadadosOfx(ofxText);
  const ofxRows = parseOfxToExtrato(ofxText).map((r) =>
    sanitizarLancamentoImportacaoExtrato({ ...r, origemImportacao: 'OFX' }),
  );
  return diagnosticarExtratoComArquivoCore({
    arquivoRows: ofxRows,
    meta,
    existenteAll,
    existenteMesclagem,
    saldoApi,
    dataCorteOverride,
    sistemaTotalOverride,
    existenteIgnoradosForaPeriodoOverride,
    origemImportacao: 'OFX',
  });
}

/**
 * Alinha extrato com o OFX mestre: exclui sobras e importa faltantes (sem data de corte).
 */
export async function executarAlinhamentoExtratoComOfxCore({
  ofxText,
  nomeBanco,
  numeroBanco,
  signal,
  diagnosticar,
  removerLote,
  salvarLancamentos,
  origemImportacao = 'OFX',
  /** Quando true, ignora incoerência LEDGERBAL × efeito do reparo (OFX parcial ou LEDGERBAL enganoso). */
  ignorarIncoerenciaSaldo = false,
}) {
  let diag = await diagnosticar();
  if (!ignorarIncoerenciaSaldo && !alinhamentoSaldoCoerenteComOfx(diag)) {
    const { deltaEsperado, deltaReparo } = calcularDeltasAlinhamentoSaldo(diag);
    throw new Error(
      `Alinhamento bloqueado: importar/excluir alteraria o saldo em ${formatarMoeda(deltaReparo)}, ` +
        `mas a diferença em relação ao banco é ${formatarMoeda(deltaEsperado)}. ` +
        'Use OFX histórico completo ou ajuste o saldo de abertura.',
    );
  }

  const exclusao = prepararExclusaoReparoExtrato(diag.sobramNoSistema);

  let removidos = [];
  const errosExclusao = [];
  if (exclusao.apiIds.length > 0) {
    const r = await removerLote(exclusao.apiIds);
    removidos = r.removidos ?? [];
    errosExclusao.push(...(r.erros ?? []));
  }

  diag = await diagnosticar();
  const importacao = prepararImportacaoReparoExtrato(
    diag.faltamNoSistema,
    nomeBanco,
    numeroBanco,
    origemImportacao,
  );

  const criados = [];
  const errosImportacao = [];
  const linhasImportacao = importacao.linhas ?? [];
  if (linhasImportacao.length > 0) {
    const batch = await salvarLancamentos(linhasImportacao, { signal });
    criados.push(...(batch.criados ?? []));
    errosImportacao.push(...(batch.erros ?? []));
  }

  const diagFinal = await diagnosticar();

  return {
    removidos: removidos.length,
    criados: criados.length,
    errosExclusao,
    errosImportacao,
    diagFinal,
  };
}
