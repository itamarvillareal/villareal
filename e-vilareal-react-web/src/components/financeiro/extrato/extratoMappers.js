import {
  buildContaToLetraMerge,
  codigoClienteExtratoDesdeApiDto,
  loadPersistedContasContabeisExtrasFinanceiro,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
  obterCodigoClienteFinanceiroPorPessoaId,
} from '../../../data/financeiroData.js';
import {
  dataCompraCartaoCorrigida,
  vencimentoFaturaDeLancamento,
} from '../../../utils/cartaoFaturaVencimento.js';

function toBrDate(iso) {
  const s = String(iso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function brDateToIso(br) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br ?? '').trim());
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(br ?? '').trim());
  return iso ? iso[0] : '';
}

function codClienteExibicao(l) {
  return codigoClienteExtratoDesdeApiDto(l);
}

function procExibicao(l) {
  const grupo = String(l.grupoCompensacao ?? '').trim();
  if (grupo) return grupo;
  const ni = l.numeroInternoProcesso ?? l.numero_interno_processo;
  if (ni == null || ni === '') return '';
  return normalizarProcFinanceiro(ni) || '';
}

/** DD/MM ou DD/MM/AAAA se ano ≠ corrente. */
export function formatDataExtratoColuna(isoOrBr) {
  const s = String(isoOrBr ?? '').trim();
  let y;
  let mo;
  let d;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    mo = iso[2];
    d = iso[3];
  } else {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!br) return s;
    d = br[1];
    mo = br[2];
    y = Number(br[3]);
  }
  const anoAtual = new Date().getFullYear();
  if (y === anoAtual) return `${d}/${mo}`;
  return `${d}/${mo}/${y}`;
}

function temVinculoClienteExtrato(item) {
  return (
    (item.clienteId != null && Number(item.clienteId) > 0) ||
    String(item.codCliente ?? '').trim() !== ''
  );
}

/** Com cliente/proc. preenchidos e conta ainda N, promove para A (Conta Escritório). */
export function promoverContaEscritorioSeVinculado(draft, contas = []) {
  if (!temVinculoClienteExtrato(draft)) return draft;
  const letra = String(draft.contaCodigo ?? 'N').trim().toUpperCase() || 'N';
  if (letra !== 'N') return draft;
  const contaA = contas.find((c) => String(c.codigo ?? '').trim().toUpperCase() === 'A');
  return {
    ...draft,
    contaCodigo: 'A',
    contaContabilId: contaA?.id ?? draft.contaContabilId,
    contaContabilNome: contaA?.nome ?? 'Conta Escritório',
  };
}

export function textoObsExtrato(item) {
  const obs = String(item.observacao ?? '').trim();
  return obs || '—';
}

/** Observação padrão após vínculo cliente + processo (Parte Cliente x Parte Oposta). */
export function montarObservacaoExtratoVinculo(parteCliente, parteOposta) {
  const pc = String(parteCliente ?? '').trim();
  const po = String(parteOposta ?? '').trim();
  if (pc && po) return `${pc} x ${po}`;
  return pc || po || '';
}

/**
 * @param {object} l — DTO {@link LancamentoFinanceiroResponse}
 * @param {Record<string, string>} [contaToLetra]
 */
export function mapApiLancamentoToExtratoRow(l, contaToLetra) {
  const map =
    contaToLetra ??
    buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
  const contaNome = String(l.contaContabilNome ?? '').trim();
  const contaCodigo = String(map[contaNome] ?? 'N')
    .trim()
    .toUpperCase() || 'N';
  const natureza = String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? 'DEBITO' : 'CREDITO';
  const valorAbs = Math.abs(Number(l.valor ?? 0));
  const dataIso = String(l.dataLancamento ?? '').slice(0, 10);

  return {
    id: Number(l.id),
    contaCodigo,
    contaContabilId: l.contaContabilId ?? null,
    contaContabilNome: contaNome,
    dataLancamento: dataIso,
    dataExibicao: formatDataExtratoColuna(dataIso),
    descricao: String(l.descricao ?? ''),
    descricaoDetalhada: String(l.descricaoDetalhada ?? ''),
    valor: valorAbs,
    natureza,
    etapa: String(l.etapa ?? 'IMPORTADO').toUpperCase(),
    observacao: String(l.descricaoDetalhada ?? '').trim(),
    codCliente: codClienteExibicao(l),
    proc: procExibicao(l),
    clienteId: l.clienteId ?? null,
    pessoaRefId: l.pessoaRefId ?? null,
    processoId: l.processoId ?? null,
    bancoNome: String(l.bancoNome ?? ''),
    numeroBanco: l.numeroBanco ?? null,
    numeroLancamento: String(l.numeroLancamento ?? ''),
    saldo: l.saldo != null ? Number(l.saldo) : null,
    grupoCompensacao: l.grupoCompensacao ?? null,
    ref: String(l.refTipo || 'N').toUpperCase() === 'R' ? 'R' : 'N',
    dimensao: '',
    eq: '',
    parcela: '',
    origem: String(l.origem ?? ''),
    status: String(l.status ?? ''),
  };
}

/** Converte transação da Conta Corrente (local ou UI da API) para o painel de detalhe do extrato. */
export function contaCorrenteTransacaoParaExtratoDetailItem(t) {
  if (!t || typeof t !== 'object') return null;
  const isCartao = t.origemExtrato === 'cartao';
  const valorNum = Number(t.valor) || 0;
  const natureza = valorNum < 0 ? 'DEBITO' : 'CREDITO';
  const valorAbs = Math.abs(valorNum);
  const dataIso = brDateToIso(t.data) || String(t.dataLancamento ?? '').slice(0, 10);
  const letra = String(t.letra ?? 'A').trim().toUpperCase() || 'A';
  const id = Number(t.apiId ?? t.id);
  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    origemExtrato: isCartao ? 'cartao' : 'banco',
    cartaoId: t._financeiroMeta?.cartaoId ?? t.cartaoId ?? null,
    cartaoNome: isCartao ? String(t.nomeBanco ?? t.cartaoNome ?? '') : '',
    numeroCartao: isCartao ? t.numeroBanco ?? t.numeroCartao ?? null : null,
    contaCodigo: letra,
    contaContabilId: t._financeiroMeta?.contaContabilId ?? t.contaContabilId ?? null,
    dataLancamento: dataIso,
    dataExibicao: formatDataExtratoColuna(dataIso || t.data),
    descricao: String(t.descricao ?? ''),
    descricaoDetalhada: String(t.descricaoDetalhada ?? t.categoria ?? ''),
    valor: valorAbs,
    natureza,
    etapa: String(t.etapa ?? 'IMPORTADO').toUpperCase(),
    observacao: String(t.descricaoDetalhada ?? t.categoria ?? '').trim(),
    codCliente: String(t.codCliente ?? ''),
    proc: String(t.proc ?? ''),
    clienteId: t.clienteId ?? t._financeiroMeta?.clienteId ?? null,
    pessoaRefId: t.pessoaRefId ?? t._financeiroMeta?.pessoaRefId ?? null,
    processoId: t.processoId ?? t._financeiroMeta?.processoId ?? null,
    bancoNome: String(t.nomeBanco ?? t.bancoNome ?? ''),
    numeroBanco: t.numeroBanco ?? null,
    numeroLancamento: String(t.numero ?? t.numeroLancamento ?? ''),
    grupoCompensacao: t._financeiroMeta?.grupoCompensacao ?? t.grupoCompensacao ?? null,
    ref: String(t.ref ?? 'N').toUpperCase() === 'R' ? 'R' : 'N',
    origem: String(t.origemImportacao ?? t.origem ?? ''),
  };
}

/** Converte linha do extrato para formato UI legado (PUT via repository). */
export function extratoRowToUi(row) {
  const isCartao = row.origemExtrato === 'cartao';
  const sinal = row.natureza === 'DEBITO' ? -1 : 1;
  const valorAssinado = isCartao ? (row.natureza === 'DEBITO' ? -row.valor : row.valor) : row.valor * sinal;
  const letra = String(row.contaCodigo ?? 'N').trim().toUpperCase() || 'N';
  const grupoMarcador = String(
    row.grupoCompensacao ?? row._financeiroMeta?.grupoCompensacao ?? '',
  ).trim();
  const proc =
    letra === 'E'
      ? String(row.proc ?? grupoMarcador).trim()
      : String(row.proc ?? '').trim() || (grupoMarcador === '0' ? '0' : '');
  return {
    apiId: row.id,
    letra: row.contaCodigo,
    numero: row.numeroLancamento,
    data: toBrDate(row.dataLancamento),
    dataCompetencia: toBrDate(row.dataCompetencia ?? row.dataLancamento),
    descricao: row.descricao,
    descricaoDetalhada: row.descricaoDetalhada,
    valor: valorAssinado,
    codCliente: row.codCliente,
    proc,
    ref: row.ref,
    dimensao: row.dimensao,
    eq: row.eq,
    parcela: row.parcela,
    nomeBanco: isCartao ? row.cartaoNome || row.bancoNome : row.bancoNome,
    numeroBanco: isCartao ? row.numeroCartao ?? row.numeroBanco : row.numeroBanco,
    origemImportacao: row.origem,
    origemExtrato: row.origemExtrato ?? 'banco',
    _financeiroMeta: {
      clienteId: row.clienteId,
      pessoaRefId: row.pessoaRefId ?? null,
      processoId: row.processoId,
      contaContabilId: row.contaContabilId,
      cartaoId: row.cartaoId ?? null,
      grupoCompensacao:
        letra === 'E'
          ? proc || grupoMarcador || null
          : proc === '0' && !(Number(row.processoId) > 0)
            ? '0'
            : grupoMarcador || null,
    },
  };
}

export function mergeExtratoRowComRespostaApi(row, saved, contaToLetra) {
  const mapped = mapApiLancamentoToExtratoRow(saved, contaToLetra);
  const clienteId =
    Number(mapped.clienteId) > 0
      ? mapped.clienteId
      : Number(row.clienteId) > 0
        ? row.clienteId
        : null;
  const processoId =
    mapped.processoId != null && Number(mapped.processoId) > 0
      ? mapped.processoId
      : row.processoId != null && Number(row.processoId) > 0
        ? row.processoId
        : null;
  const proc =
    String(row.proc ?? '').trim() || String(mapped.proc ?? '').trim() || '';
  const pessoaRef = Number(mapped.pessoaRefId ?? row.pessoaRefId) || 0;
  const codEnviado =
    normalizarCodigoClienteFinanceiro(row.codCliente) ||
    (pessoaRef > 0 ? obterCodigoClienteFinanceiroPorPessoaId(pessoaRef) : '');
  const base = { ...mapped, clienteId, processoId, proc: proc || mapped.proc };
  if (codEnviado) {
    return { ...base, codCliente: codEnviado };
  }
  if (mapped.codCliente) return base;
  return base;
}

/**
 * @param {object} l — DTO {@link LancamentoCartaoResponse}
 * @param {Record<string, string>} [contaToLetra]
 */
export function mapApiLancamentoCartaoToExtratoRow(l, contaToLetra) {
  const map =
    contaToLetra ??
    buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
  const contaNome = String(l.contaContabilNome ?? '').trim();
  const contaCodigo = String(map[contaNome] ?? 'N')
    .trim()
    .toUpperCase() || 'N';
  const valorNum = Number(l.valor ?? 0);
  const natureza = valorNum < 0 ? 'DEBITO' : 'CREDITO';
  const valorAbs = Math.abs(valorNum);
  const dataIso = dataCompraCartaoCorrigida(l) || String(l.dataLancamento ?? '').slice(0, 10);
  const vencIso = vencimentoFaturaDeLancamento(l);

  return {
    id: Number(l.id),
    origemExtrato: 'cartao',
    cartaoId: l.cartaoId ?? null,
    cartaoNome: String(l.cartaoNome ?? ''),
    numeroCartao: l.numeroCartao ?? null,
    contaCodigo,
    contaContabilId: l.contaContabilId ?? null,
    contaContabilNome: contaNome,
    dataLancamento: dataIso,
    dataCompetencia: String(l.dataCompetencia ?? '').slice(0, 10) || dataIso,
    dataExibicao: formatDataExtratoColuna(dataIso),
    vencimentoFaturaExibicao: vencIso ? formatDataExtratoColuna(vencIso) : '',
    descricao: String(l.descricao ?? ''),
    descricaoDetalhada: String(l.descricaoDetalhada ?? ''),
    valor: valorAbs,
    natureza,
    etapa: String(l.etapa ?? 'IMPORTADO').toUpperCase(),
    observacao: String(l.descricaoDetalhada ?? '').trim(),
    codCliente: codClienteExibicao(l),
    proc: procExibicao(l),
    clienteId: l.clienteId ?? null,
    pessoaRefId: l.pessoaRefId ?? null,
    processoId: l.processoId ?? null,
    bancoNome: String(l.cartaoNome ?? ''),
    numeroBanco: l.numeroCartao ?? null,
    numeroLancamento: String(l.numeroLancamento ?? ''),
    saldo: null,
    grupoCompensacao: l.grupoCompensacao ?? null,
    ref: String(l.refTipo || 'N').toUpperCase() === 'R' ? 'R' : 'N',
    dimensao: '',
    eq: '',
    parcela: '',
    origem: String(l.origem ?? ''),
    status: String(l.status ?? ''),
  };
}

export function mergeExtratoRowComRespostaApiCartao(row, saved, contaToLetra) {
  const mapped = mapApiLancamentoCartaoToExtratoRow(saved, contaToLetra);
  const clienteId =
    Number(mapped.clienteId) > 0
      ? mapped.clienteId
      : Number(row.clienteId) > 0
        ? row.clienteId
        : null;
  const processoId =
    mapped.processoId != null && Number(mapped.processoId) > 0
      ? mapped.processoId
      : row.processoId != null && Number(row.processoId) > 0
        ? row.processoId
        : null;
  const proc =
    String(mapped.proc ?? '').trim() || String(row.proc ?? '').trim() || '';
  const pessoaRef = Number(mapped.pessoaRefId ?? row.pessoaRefId) || 0;
  let codEnviado =
    normalizarCodigoClienteFinanceiro(row.codCliente) ||
    (pessoaRef > 0 ? obterCodigoClienteFinanceiroPorPessoaId(pessoaRef) : '');
  const temVinculo = Number(clienteId) > 0 || proc !== '';
  const base = { ...mapped, clienteId, processoId, proc: proc || mapped.proc };
  if (codEnviado && temVinculo) {
    return { ...base, codCliente: codEnviado };
  }
  if (mapped.codCliente) return base;
  if (codEnviado) return { ...base, codCliente: codEnviado };
  return base;
}
