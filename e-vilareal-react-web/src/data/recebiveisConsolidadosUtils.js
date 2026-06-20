import {
  calcularParcelasPreview,
  formatarDataBR,
  formatarMoedaBRL,
} from '../pages/documentos/contratoHonorariosClausula3.js';

export const SITUACAO_QUITADO = 'QUITADO';
export const SITUACAO_ATRASADO = 'ATRASADO';
export const SITUACAO_A_VENCER = 'A_VENCER';
export const SITUACAO_SEM_FINANCEIRO = 'SEM_FINANCEIRO';
export const SITUACAO_CANCELADO = 'CANCELADO';

export const CUMPRIMENTO_SEM_REGISTRO = 'SEM_REGISTRO';
export const CUMPRIMENTO_A_COBRAR = 'A_COBRAR';
export const CUMPRIMENTO_RECEBIDO = 'RECEBIDO';
export const CUMPRIMENTO_NO_FINANCEIRO = 'NO_FINANCEIRO';

const STATUS_QUITADO = new Set(['RECEBIDO', 'CONCILIADO', 'CONFERIDO', 'ACERTADO', 'PAGO_CONFIRMADO']);
const STATUS_CANCELADO = new Set(['CANCELADO', 'SUBSTITUIDO']);
const STATUS_NO_FINANCEIRO = new Set(['CONCILIADO', 'ACERTADO']);
const STATUS_RECEBIDO_CLIENTE = new Set(['RECEBIDO', 'CONFERIDO', 'PAGO_CONFIRMADO']);

export const ROTULOS_SITUACAO = {
  [SITUACAO_QUITADO]: 'Quitado',
  [SITUACAO_ATRASADO]: 'Atrasado',
  [SITUACAO_A_VENCER]: 'A vencer',
  [SITUACAO_SEM_FINANCEIRO]: 'Sem registro em Pagamentos',
  [SITUACAO_CANCELADO]: 'Cancelado',
};

export const ROTULOS_CUMPRIMENTO = {
  [CUMPRIMENTO_SEM_REGISTRO]: 'Sem cobrança registrada',
  [CUMPRIMENTO_A_COBRAR]: 'Aguardando pagamento',
  [CUMPRIMENTO_RECEBIDO]: 'Recebido do cliente',
  [CUMPRIMENTO_NO_FINANCEIRO]: 'Entrou no financeiro',
};

const ROTULOS_STATUS_PAGAMENTO = {
  EMITIDO: 'Emitido',
  AGENDADO: 'Agendado',
  VENCIDO: 'Vencido',
  RECEBIDO: 'Recebido',
  CONFERIDO: 'Conferido',
  CONCILIADO: 'Conciliado',
  ACERTADO: 'Acertado',
  CANCELADO: 'Cancelado',
  SUBSTITUIDO: 'Substituído',
  PAGO_CONFIRMADO: 'Pago confirmado',
};

export function rotuloStatusPagamento(status) {
  if (!status) return '—';
  const key = String(status).toUpperCase();
  return ROTULOS_STATUS_PAGAMENTO[key] ?? key;
}

export function formatarRotuloBanco(numero, nome) {
  const rotulo = String(nome ?? '').trim();
  if (rotulo) return rotulo;
  if (numero != null && Number.isFinite(Number(numero))) return `Banco ${numero}`;
  return '—';
}

export function parcelaEstaPaga(parcela) {
  if (parcela?.pagamentoPago === true) return true;
  const status = parcela?.pagamentoStatus ? String(parcela.pagamentoStatus).toUpperCase() : '';
  return STATUS_QUITADO.has(status);
}

export function parcelamentoContratoAtivo(contrato) {
  if (Boolean(contrato?.gerarRecebiveis)) return true;
  const valorTotal = contrato?.valorTotalParcelas;
  const qtd = Number(contrato?.quantidadeParcelas);
  return (
    valorTotal != null &&
    Number.isFinite(Number(valorTotal)) &&
    Number(valorTotal) > 0 &&
    Number.isFinite(qtd) &&
    qtd > 0
  );
}

function contratoPagamentoUnicoSalvo(contrato) {
  if (parcelamentoContratoAtivo(contrato)) return false;
  const tipo = String(contrato?.tipoRemuneracao ?? '').toUpperCase();
  if (tipo !== 'VALOR_FIXO' && tipo !== 'MISTO') return false;
  const valor = Number(contrato?.valorFixo);
  return Number.isFinite(valor) && valor > 0;
}

function parcelaUnicaFromContrato(contrato) {
  const valor = Number(contrato.valorFixo);
  const venc = String(contrato.dataContrato ?? '').slice(0, 10) || hojeIsoLocal();
  return {
    numeroParcela: 1,
    valor,
    dataVencimento: venc,
    pagamentoId: null,
    pagamentoStatus: null,
    pagamentoDataRecebimento: null,
    pagamentoFinanceiroLancamentoId: null,
    pagamentoDataPagamento: null,
    pagamentoBancoNumero: null,
    pagamentoBancoNome: null,
    pagamentoPago: false,
  };
}

export function resolverParcelasContrato(contrato) {
  const parcelas = contrato.parcelas ?? [];
  if (parcelas.length > 0) return parcelas;

  if (!parcelamentoContratoAtivo(contrato)) {
    if (contratoPagamentoUnicoSalvo(contrato)) {
      return [parcelaUnicaFromContrato(contrato)];
    }
    return [];
  }

  const qtd = Number(contrato.quantidadeParcelas);
  const total = contrato.valorTotalParcelas ?? contrato.valorFixo;
  if (!Number.isFinite(qtd) || qtd <= 0 || total == null) return [];

  const primeiroVencimento =
    contrato.parcelas?.[0]?.dataVencimento ??
    contrato.dataContrato ??
    new Date().toISOString().slice(0, 10);

  return calcularParcelasPreview({
    temParcelamento: true,
    quantidadeParcelas: String(qtd),
    valorTotalParcelas: total,
    valorFixo: total,
    primeiroVencimento,
    intervaloParcelas: qtd === 1 ? 'UNICA' : 'MENSAL',
  }).map((p) => ({
    numeroParcela: p.numero,
    valor: p.valor,
    dataVencimento: p.dataVencimento,
    pagamentoId: null,
    pagamentoStatus: null,
    pagamentoDataRecebimento: null,
    pagamentoFinanceiroLancamentoId: null,
    pagamentoDataPagamento: null,
    pagamentoBancoNumero: null,
    pagamentoBancoNome: null,
    pagamentoPago: false,
  }));
}

export function hojeIsoLocal() {
  return new Date().toISOString().slice(0, 10);
}

export function classificarCumprimento(parcela) {
  const status = parcela.pagamentoStatus ? String(parcela.pagamentoStatus).toUpperCase() : '';

  if (!parcela.pagamentoId) return CUMPRIMENTO_SEM_REGISTRO;
  if (parcela.pagamentoFinanceiroLancamentoId || STATUS_NO_FINANCEIRO.has(status)) {
    return CUMPRIMENTO_NO_FINANCEIRO;
  }
  if (STATUS_RECEBIDO_CLIENTE.has(status)) return CUMPRIMENTO_RECEBIDO;
  return CUMPRIMENTO_A_COBRAR;
}

export function classificarSituacaoRecebivel(parcela, hoje = hojeIsoLocal()) {
  const venc = String(parcela.dataVencimento ?? '').slice(0, 10);
  const status = parcela.pagamentoStatus ? String(parcela.pagamentoStatus).toUpperCase() : '';

  if (status && STATUS_CANCELADO.has(status)) return SITUACAO_CANCELADO;
  if (status && STATUS_QUITADO.has(status)) return SITUACAO_QUITADO;

  if (!parcela.pagamentoId) {
    if (venc && venc < hoje) return SITUACAO_ATRASADO;
    return SITUACAO_SEM_FINANCEIRO;
  }

  if (status === 'VENCIDO' || (venc && venc < hoje)) return SITUACAO_ATRASADO;
  return SITUACAO_A_VENCER;
}

/** Parcelas contratuais de honorários — independente do % sobre proveito nos autos. */
export function consolidarRecebiveisContratos(contratos, hoje = hojeIsoLocal()) {
  const linhas = [];
  for (const contrato of contratos ?? []) {
    const parcelas = resolverParcelasContrato(contrato);
    if (parcelas.length === 0) continue;

    const totalParcelas = parcelas.length;
    for (const parcela of parcelas) {
      const situacao = classificarSituacaoRecebivel(parcela, hoje);
      const cumprimento = classificarCumprimento(parcela);
      linhas.push({
        chave: `${contrato.id}-${parcela.id ?? parcela.numeroParcela}`,
        contratoId: contrato.id,
        processoId: contrato.processoId,
        codigoCliente: contrato.codigoCliente,
        numeroInterno: contrato.numeroInterno,
        nomeContratante: contrato.parteCliente || contrato.nomeContratante,
        parteCliente: contrato.parteCliente || contrato.nomeContratante,
        parteOposta: contrato.parteOposta || '',
        papelCliente: contrato.papelCliente || '',
        tipoRemuneracao: contrato.tipoRemuneracao,
        gerarRecebiveis: Boolean(contrato.gerarRecebiveis),
        parcelaId: parcela.id,
        numeroParcela: parcela.numeroParcela,
        totalParcelas,
        valor: Number(parcela.valor) || 0,
        dataVencimento: String(parcela.dataVencimento ?? '').slice(0, 10),
        pagamentoId: parcela.pagamentoId,
        pagamentoStatus: parcela.pagamentoStatus,
        pagamentoDataRecebimento: parcela.pagamentoDataRecebimento
          ? String(parcela.pagamentoDataRecebimento).slice(0, 10)
          : null,
        pagamentoFinanceiroLancamentoId: parcela.pagamentoFinanceiroLancamentoId,
        pagamentoDataPagamento: parcela.pagamentoDataPagamento
          ? String(parcela.pagamentoDataPagamento).slice(0, 10)
          : parcela.pagamentoDataRecebimento
            ? String(parcela.pagamentoDataRecebimento).slice(0, 10)
            : null,
        pagamentoBancoNumero: parcela.pagamentoBancoNumero ?? null,
        pagamentoBancoNome: parcela.pagamentoBancoNome ?? null,
        pagamentoPago: Boolean(parcela.pagamentoPago) || parcelaEstaPaga(parcela),
        situacao,
        cumprimento,
      });
    }
  }
  return linhas.sort((a, b) => {
    const da = a.dataVencimento || '9999-99-99';
    const db = b.dataVencimento || '9999-99-99';
    if (da !== db) return da.localeCompare(db);
    return String(a.nomeContratante ?? '').localeCompare(String(b.nomeContratante ?? ''), 'pt-BR');
  });
}

export function resumirRecebiveisConsolidados(linhas) {
  const acc = {
    total: linhas.length,
    valorTotal: 0,
    valorAtrasado: 0,
    valorAVencer: 0,
    valorQuitado: 0,
    valorPrevisao: 0,
    qtdAtrasado: 0,
    qtdAVencer: 0,
    qtdQuitado: 0,
    qtdSemFinanceiro: 0,
    qtdSemRegistro: 0,
    qtdAguardando: 0,
    qtdRecebidoCliente: 0,
    qtdNoFinanceiro: 0,
    valorSemRegistro: 0,
    valorAguardando: 0,
    valorRecebidoCliente: 0,
    valorNoFinanceiro: 0,
  };
  for (const l of linhas) {
    acc.valorTotal += l.valor;
    if (l.situacao === SITUACAO_ATRASADO) {
      acc.qtdAtrasado += 1;
      acc.valorAtrasado += l.valor;
    } else if (l.situacao === SITUACAO_A_VENCER) {
      acc.qtdAVencer += 1;
      acc.valorAVencer += l.valor;
      acc.valorPrevisao += l.valor;
    } else if (l.situacao === SITUACAO_QUITADO) {
      acc.qtdQuitado += 1;
      acc.valorQuitado += l.valor;
    } else if (l.situacao === SITUACAO_SEM_FINANCEIRO) {
      acc.qtdSemFinanceiro += 1;
      acc.valorPrevisao += l.valor;
    }

    if (l.cumprimento === CUMPRIMENTO_SEM_REGISTRO) {
      acc.qtdSemRegistro += 1;
      acc.valorSemRegistro += l.valor;
    } else if (l.cumprimento === CUMPRIMENTO_A_COBRAR) {
      acc.qtdAguardando += 1;
      acc.valorAguardando += l.valor;
    } else if (l.cumprimento === CUMPRIMENTO_RECEBIDO) {
      acc.qtdRecebidoCliente += 1;
      acc.valorRecebidoCliente += l.valor;
    } else if (l.cumprimento === CUMPRIMENTO_NO_FINANCEIRO) {
      acc.qtdNoFinanceiro += 1;
      acc.valorNoFinanceiro += l.valor;
    }
  }
  return acc;
}

export function classeBadgeSituacao(situacao) {
  switch (situacao) {
    case SITUACAO_ATRASADO:
      return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200';
    case SITUACAO_A_VENCER:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
    case SITUACAO_QUITADO:
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
    case SITUACAO_SEM_FINANCEIRO:
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    case SITUACAO_CANCELADO:
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function classeBadgeCumprimento(cumprimento) {
  switch (cumprimento) {
    case CUMPRIMENTO_SEM_REGISTRO:
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    case CUMPRIMENTO_A_COBRAR:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
    case CUMPRIMENTO_RECEBIDO:
      return 'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100';
    case CUMPRIMENTO_NO_FINANCEIRO:
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export { formatarDataBR, formatarMoedaBRL };
