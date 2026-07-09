import {
  TIPO_REMUNERACAO_PERCENTUAL,
  TIPO_REMUNERACAO_VALOR_FIXO,
  TIPO_REMUNERACAO_MISTO,
  clausula3DadosParaForm,
  estadoInicialClausula3,
} from '../../pages/documentos/contratoHonorariosClausula3.js';

export const inputClassConferencia =
  'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900';

export function badgeConfiancaClasse(score) {
  const n = Number(score ?? 0);
  if (n >= 70) return 'bg-emerald-100 text-emerald-800';
  if (n >= 40) return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-800';
}

export function extracaoParaFormConferencia(dados) {
  if (!dados) return estadoInicialClausula3();
  return clausula3DadosParaForm(
    {
      tipoRemuneracao: dados.tipoRemuneracao || TIPO_REMUNERACAO_PERCENTUAL,
      percentualProveito: dados.percentualProveito,
      valorFixo: dados.valorFixo,
      temParcelamento: dados.temParcelamento !== false,
      gerarRecebiveis: dados.gerarRecebiveis !== false,
      quantidadeParcelas: dados.quantidadeParcelas,
      valorTotalParcelas: dados.valorTotalParcelas,
      primeiroVencimento: dados.primeiroVencimento,
      intervaloParcelas: dados.intervaloParcelas || 'MENSAL',
      formaPagamento: dados.formaPagamento || 'PIX',
      parcelas: dados.parcelas || [],
    },
    dados.dataContrato,
  );
}

export function flagsNomeArquivoImportacao(nome) {
  const n = String(nome ?? '')
    .normalize('NFC')
    .toLowerCase();
  return {
    naoIncluir: /n[aã]o\s*incluir|nao\s*incluir/.test(n),
    revogacao: /revogac/.test(n),
    duplicataProvavel: /\(1\)|c[oó]pia|copy/.test(n),
    inicialExecucao: /inicial|execu[cç][aã]o/.test(n),
  };
}

export function avaliarQualidadeImportacao(dados, item) {
  const alertas = [];
  const bloqueios = [];
  if (!dados?.tipoRemuneracao) bloqueios.push('Sem tipo de remuneração');
  if (dados?.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO && !dados.valorFixo) {
    bloqueios.push('Sem valor fixo');
  }
  if (dados?.tipoRemuneracao === TIPO_REMUNERACAO_PERCENTUAL && !dados.percentualProveito) {
    alertas.push('Sem percentual');
  }
  if (dados?.tipoRemuneracao === TIPO_REMUNERACAO_MISTO && !dados.percentualProveito && !dados.valorFixo) {
    alertas.push('Misto sem valores');
  }
  if (!dados?.dataContrato) alertas.push('Sem data do contrato');
  if (!dados?.objetoContrato) alertas.push('Sem objeto');
  if (dados?.temCasoVinculado && !item?.processoId && !item?.processoSugerido?.processoId) {
    bloqueios.push('Caso vinculado sem processo');
  }
  if (!item?.codigoCliente) bloqueios.push('Sem código cliente');
  if ((item?.alertas || []).some((a) => /credit balance/i.test(a))) {
    alertas.push('Extração IA bloqueada (heurística)');
  }
  return { alertas, bloqueios };
}

export function scoreConferenciaItem(item, qual, flags) {
  let s = 40;
  const d = item?.dadosAprovados || item?.dadosExtraidos || {};
  if (d.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO && d.valorFixo) s += 20;
  if (d.dataContrato) s += 10;
  if (item?.processoId || item?.processoSugerido?.processoId) s += 15;
  if (d.objetoContrato) s += 5;
  if (flags.naoIncluir || flags.revogacao || flags.inicialExecucao) s -= 40;
  if (flags.duplicataProvavel) s -= 10;
  s -= qual.bloqueios.length * 15;
  s -= qual.alertas.length * 2;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export function recomendacaoConferencia(score, qual, flags) {
  if (qual.bloqueios.length) return 'BLOQUEADO';
  if (flags.naoIncluir || flags.revogacao || flags.inicialExecucao) return 'REJEITAR';
  if (score >= 75) return 'APROVAR';
  if (score >= 50) return 'REVISAR';
  return 'DETALHADO';
}

export function labelRecomendacao(rec) {
  switch (rec) {
    case 'APROVAR':
      return 'Pronto';
    case 'REVISAR':
      return 'Revisar';
    case 'REJEITAR':
      return 'Rejeitar';
    case 'BLOQUEADO':
      return 'Bloqueado';
    default:
      return 'Detalhado';
  }
}

export function classeRecomendacao(rec) {
  switch (rec) {
    case 'APROVAR':
      return 'bg-emerald-100 text-emerald-800';
    case 'REVISAR':
      return 'bg-amber-100 text-amber-900';
    case 'REJEITAR':
      return 'bg-red-100 text-red-800';
    case 'BLOQUEADO':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}
