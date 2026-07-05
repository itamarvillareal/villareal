import { linhaBateFiltroLetras } from '../extrato/extratoLetrasFiltro.js';
import { linhaSemParCompensacao } from '../extrato/compensacaoSemPar.js';

/** Chave estável para linhas banco + cartão (ids numéricos podem coincidir entre tabelas). */
export function extratoRowKey(row) {
  const origem = row?.origemExtrato === 'cartao' ? 'cartao' : 'banco';
  return `${origem}:${row?.id}`;
}

export function origemExtratoLabel(row) {
  if (row?.origemExtrato === 'cartao') {
    return String(row.cartaoNome || row.bancoNome || 'Cartão').trim() || 'Cartão';
  }
  return String(row.bancoNome || 'Banco').trim() || 'Banco';
}

export function compararLancamentosTotal(a, b, sortAsc = false) {
  const da = String(a?.dataLancamento ?? '');
  const db = String(b?.dataLancamento ?? '');
  const cmpData = da.localeCompare(db);
  if (cmpData !== 0) return sortAsc ? cmpData : -cmpData;
  const cmpOrigem = extratoRowKey(a).localeCompare(extratoRowKey(b));
  return sortAsc ? cmpOrigem : -cmpOrigem;
}

export function filtrarLinhasTotal(linhas, { busca, etapa, letras, letrasModo, semParCompensacao } = {}) {
  let out = Array.isArray(linhas) ? linhas : [];
  if (semParCompensacao) {
    out = out.filter(linhaSemParCompensacao);
  } else {
    out = out.filter((r) => linhaBateFiltroLetras(r, { letras, letrasModo }));
    const etapaNorm = String(etapa ?? '').trim().toUpperCase();
    if (etapaNorm) {
      out = out.filter((r) => String(r?.etapa ?? '').trim().toUpperCase() === etapaNorm);
    }
  }
  const q = String(busca ?? '').trim().toUpperCase();
  if (q) {
    out = out.filter((r) => {
      const campos = [
        r?.descricao,
        r?.descricaoDetalhada,
        r?.bancoNome,
        r?.cartaoNome,
        r?.numeroLancamento,
        origemExtratoLabel(r),
      ];
      return campos.some((c) => String(c ?? '').toUpperCase().includes(q));
    });
  }
  return out;
}

export function paginarLinhasTotal(linhas, { page = 0, size = 50 } = {}) {
  const total = linhas?.length ?? 0;
  const pageSize = Math.max(1, Number(size) || 50);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
  const start = p * pageSize;
  return {
    content: (linhas ?? []).slice(start, start + pageSize),
    totalElements: total,
    totalPages,
    number: p,
    size: pageSize,
  };
}

export function mesclarLinhasTotal(bancoRows, cartaoRows, { sortAsc = false } = {}) {
  const merged = [...(bancoRows ?? []), ...(cartaoRows ?? [])];
  merged.sort((a, b) => compararLancamentosTotal(a, b, sortAsc));
  return merged;
}
