import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
} from '../../../data/financeiroData.js';

function toBrDate(iso) {
  const s = String(iso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function codClienteExibicao(l) {
  const raw = l.codigoCliente != null ? String(l.codigoCliente).trim() : '';
  if (raw === '') return '';
  const digits = raw.replace(/\D/g, '');
  const n = Number(digits);
  return normalizarCodigoClienteFinanceiro(Number.isFinite(n) && n >= 1 ? n : '');
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

export function textoObsExtrato(item) {
  const letra = String(item.contaCodigo ?? '').toUpperCase();
  const temCliente =
    (item.clienteId != null && Number(item.clienteId) > 0) ||
    String(item.codCliente ?? '').trim() !== '';
  if (letra === 'A' && temCliente) {
    const cod = String(item.codCliente ?? '').trim();
    const proc = String(item.proc ?? '').trim();
    const vinc = [cod, proc].filter(Boolean).join('/');
    return vinc || '—';
  }
  const obs = String(item.observacao ?? '').trim();
  return obs || '—';
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

/** Converte linha do extrato para formato UI legado (PUT via repository). */
export function extratoRowToUi(row) {
  const sinal = row.natureza === 'DEBITO' ? -1 : 1;
  return {
    apiId: row.id,
    letra: row.contaCodigo,
    numero: row.numeroLancamento,
    data: toBrDate(row.dataLancamento),
    dataCompetencia: toBrDate(row.dataLancamento),
    descricao: row.descricao,
    descricaoDetalhada: row.descricaoDetalhada,
    valor: row.valor * sinal,
    codCliente: row.codCliente,
    proc: row.proc,
    ref: row.ref,
    dimensao: row.dimensao,
    eq: row.eq,
    parcela: row.parcela,
    nomeBanco: row.bancoNome,
    numeroBanco: row.numeroBanco,
    origemImportacao: row.origem,
    _financeiroMeta: {
      clienteId: row.clienteId,
      processoId: row.processoId,
      contaContabilId: row.contaContabilId,
      grupoCompensacao: row.grupoCompensacao,
    },
  };
}

export function mergeExtratoRowComRespostaApi(row, saved, contaToLetra) {
  return mapApiLancamentoToExtratoRow(saved, contaToLetra);
}
