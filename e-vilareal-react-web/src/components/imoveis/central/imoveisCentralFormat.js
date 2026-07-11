/** Helpers puros de formatação/status da Central de Imóveis. */

export function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function competenciaLabel(comp) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(comp ?? '').trim());
  if (!m) return String(comp ?? '—');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mes = nomes[Number(m[2]) - 1] ?? m[2];
  return `${mes}/${m[1]}`;
}

/**
 * Status do mês de um item da visão geral, para badge:
 * vago | aluguel-pendente | repasse-pendente | repasse-divergente | ok | sem-contrato
 */
export function statusMesItem(item) {
  if (!item) return { key: 'sem-contrato', label: '—', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  if (!item.ocupado) {
    return { key: 'vago', label: 'Vago', cls: 'bg-slate-100 text-slate-600 border-slate-300' };
  }
  if (!item.contratoId) {
    return {
      key: 'sem-contrato',
      label: 'Sem contrato',
      cls: 'bg-violet-50 text-violet-800 border-violet-200',
    };
  }
  const aluguel = Number(item.aluguelRecebido) || 0;
  if (aluguel <= 0) {
    return {
      key: 'aluguel-pendente',
      label: 'Aluguel não recebido',
      cls: 'bg-red-50 text-red-800 border-red-200',
    };
  }
  const status = String(item.statusRepasse ?? '').toUpperCase();
  if (status === 'FEITO') {
    return { key: 'ok', label: 'Mês OK', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  }
  if (status === 'DIVERGENTE') {
    return {
      key: 'repasse-divergente',
      label: 'Repasse divergente',
      cls: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }
  return {
    key: 'repasse-pendente',
    label: 'Repasse pendente',
    cls: 'bg-orange-50 text-orange-800 border-orange-300',
  };
}

/** Texto de busca do item (endereço, condomínio, unidade, partes, nº, Cod.+Proc.). */
export function textoBuscaItem(item) {
  return [
    item?.numeroPlanilha,
    item?.titulo,
    item?.enderecoCompleto,
    item?.condominio,
    item?.unidade,
    item?.inquilino,
    item?.proprietario,
    item?.codigoCliente,
    item?.numeroInterno,
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .join(' ')
    .toLocaleLowerCase('pt-BR');
}
