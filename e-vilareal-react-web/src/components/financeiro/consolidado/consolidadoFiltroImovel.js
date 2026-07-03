import { normalizarNumeroImovelFinanceiro } from '../../../data/financeiroData.js';

/** Prefixo Cod.+Proc. na Obs (ex.: 11579 = cod. 1157 + proc. 9). */
export function prefixoObsCodProc(codigoCliente, numeroInterno) {
  const codDigits = String(codigoCliente ?? '')
    .trim()
    .replace(/\D/g, '')
    .replace(/^0+/, '');
  const proc = Math.trunc(Number(numeroInterno));
  if (!codDigits || !Number.isFinite(proc) || proc < 1) return '';
  return `${codDigits}${proc}`;
}

export function montarCtxFiltroImovel(numeroPlanilha, vinculosApi = null, imovelApi = null) {
  const np = normalizarNumeroImovelFinanceiro(numeroPlanilha);
  if (!np) return null;
  const obsPrefixos = new Set();
  for (const v of vinculosApi?.vinculos ?? []) {
    const p = prefixoObsCodProc(v?.codigoCliente, v?.numeroInterno);
    if (p) {
      obsPrefixos.add(p);
      obsPrefixos.add(`${p} -`);
    }
  }
  const unidade = String(imovelApi?.unidade ?? '').trim();
  const cond = String(imovelApi?.condominio ?? '').trim();
  if (unidade && cond) {
    obsPrefixos.add(`${unidade} ${cond}`);
  }
  return { numeroPlanilha: np, obsPrefixos: [...obsPrefixos] };
}

export function lancamentoBateFiltroImovel(row, ctx) {
  if (!ctx?.numeroPlanilha) return true;
  const np = normalizarNumeroImovelFinanceiro(row?.numeroImovel ?? row?.grupoCompensacao);
  if (np === ctx.numeroPlanilha) return true;
  const obs = String(row?.observacao ?? row?.descricaoDetalhada ?? '').trim();
  if (!obs) return false;
  const obsLower = obs.toLowerCase();
  for (const prefixo of ctx.obsPrefixos ?? []) {
    const p = String(prefixo ?? '').trim().toLowerCase();
    if (p && obsLower.startsWith(p)) return true;
  }
  return false;
}
