import {
  analisarLancamentosNovosDedupe,
  dataLancamentoParaIso,
  parseOfxToExtrato,
  sanitizarLancamentoImportacaoExtrato,
} from '../../../utils/ofx.js';
import {
  aplicarProtecaoDataCorteImportacao,
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

function montarConclusao({ meta, totais, faltamNoSistema, sobramNoSistema }) {
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

  if (faltamNoSistema.length > 0) {
    linhas.push(
      `${faltamNoSistema.length} lançamento(s) do OFX **não constam** no sistema (soma ${formatarMoeda(totais.somaFaltam)}).`,
    );
  }

  if (
    deltaEsperado != null &&
    (faltamNoSistema.length > 0 || sobramNoSistema.length > 0) &&
    !coerente
  ) {
    linhas.push(
      `Efeito do reparo (${formatarMoeda(deltaReparo)}) **não bate** com a diferença de saldo (${formatarMoeda(deltaEsperado)}). ` +
        'Provável histórico anterior ao período do OFX — use arquivo histórico completo ou ajuste o saldo de abertura; **não** use «Alinhar» cegamente.',
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
    linhas.push('Lançamentos alinhados com o OFX.');
  } else if (faltamNoSistema.length === 0 && sobramNoSistema.length === 0) {
    linhas.push('Lançamentos do período alinhados com o OFX.');
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

export function prepararImportacaoReparoExtrato(faltamNoSistema, nomeBanco, numeroBanco) {
  const linhas = (faltamNoSistema ?? []).map((row) =>
    sanitizarLancamentoImportacaoExtrato({
      ...row,
      nomeBanco: String(nomeBanco ?? '').trim(),
      numeroBanco: Number(numeroBanco),
      origemImportacao: 'OFX',
    }),
  );
  return { linhas, soma: somaValores(linhas) };
}

/**
 * Compara OFX com lançamentos já carregados (sem I/O).
 * Faltam/sobram limitam-se ao período DTSTART–DTEND do arquivo OFX.
 */
export function diagnosticarExtratoComOfxCore({
  ofxText,
  existenteAll,
  saldoApi = null,
}) {
  const meta = extrairMetadadosOfx(ofxText);
  const ofxRows = parseOfxToExtrato(ofxText).map((r) =>
    sanitizarLancamentoImportacaoExtrato({ ...r, origemImportacao: 'OFX' }),
  );

  const existenteNoPeriodo = existenteDentroPeriodoOfx(
    existenteAll,
    meta.dataInicio,
    meta.dataFim,
  );
  const existenteIgnoradosForaPeriodo = existenteForaPeriodoOfx(
    existenteAll,
    meta.dataInicio,
    meta.dataFim,
  );

  const protecao = aplicarProtecaoDataCorteImportacao(ofxRows, existenteAll, { modo: 'mesclar' });

  const ofxNoPeriodo = ofxDentroPeriodo(ofxRows, meta.dataInicio, meta.dataFim);

  const analiseFaltam = analisarLancamentosNovosDedupe(existenteNoPeriodo, ofxNoPeriodo, {
    respeitarExtratoComoMestre: true,
  });
  const faltamNoSistema = analiseFaltam.novos;

  const analiseMesclagem = analisarLancamentosNovosDedupe(existenteAll, protecao.rows, {
    respeitarExtratoComoMestre: false,
  });

  const sobramNoSistema = montarSobramNoSistema(ofxNoPeriodo, existenteAll, meta);
  const deltasAlinhamento = calcularDeltasAlinhamentoSaldo({
    meta,
    totais: {
      saldoSistema: saldoApi?.saldo ?? null,
      somaFaltam: somaValores(faltamNoSistema),
      somaSobram: somaValores(sobramNoSistema),
    },
  });

  const totais = {
    ofxArquivo: ofxRows.length,
    ofxAposCorte: protecao.rows.length,
    sistemaTotal: existenteAll.length,
    sistemaNoPeriodo: existenteNoPeriodo.length,
    faltamNoSistema: faltamNoSistema.length,
    faltamMesclagem: analiseMesclagem.novos.length,
    sobramNoSistema: sobramNoSistema.length,
    existenteIgnoradosForaPeriodo: existenteIgnoradosForaPeriodo.length,
    /** @deprecated use existenteIgnoradosForaPeriodo */
    sobramForaPeriodo: existenteIgnoradosForaPeriodo.length,
    ignoradosDedupe: analiseFaltam.ignorados,
    ignoradosPorCorte: protecao.ignoradosPorCorte,
    somaOfxArquivo: somaValores(ofxRows),
    somaOfxNoPeriodo: somaValores(ofxNoPeriodo),
    somaSistemaNoPeriodo: somaValores(existenteNoPeriodo),
    somaSistemaTotal: somaValores(existenteAll),
    somaFaltam: somaValores(faltamNoSistema),
    somaSobram: somaValores(sobramNoSistema),
    saldoLedgerOfx: meta.saldoLedger,
    saldoSistema: saldoApi?.saldo ?? null,
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
    porDiaImport: Object.fromEntries(analiseFaltam.porDia),
    diasIgnoradosPorContagem: analiseFaltam.diasIgnoradosPorContagem ?? [],
    conclusao: montarConclusao({ meta, totais, faltamNoSistema, sobramNoSistema }),
  };
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
  salvarLancamento,
}) {
  let diag = await diagnosticar();
  if (!alinhamentoSaldoCoerenteComOfx(diag)) {
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
  );

  const criados = [];
  const errosImportacao = [];
  for (const row of importacao.linhas) {
    if (signal?.aborted) break;
    try {
      const saved = await salvarLancamento(row);
      if (saved?.id) criados.push(saved.id);
      else errosImportacao.push(`${row.numero} ${row.data}: falha ao gravar`);
    } catch (e) {
      errosImportacao.push(`${row.numero} ${row.data}: ${e?.message || e}`);
    }
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
