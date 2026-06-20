export const TIPO_REMUNERACAO_PERCENTUAL = 'PERCENTUAL_PROVEITO';
export const TIPO_REMUNERACAO_VALOR_FIXO = 'VALOR_FIXO';
export const TIPO_REMUNERACAO_MISTO = 'MISTO';

export const TIPOS_REMUNERACAO = [
  { id: TIPO_REMUNERACAO_PERCENTUAL, label: 'Percentual sobre proveito econômico' },
  { id: TIPO_REMUNERACAO_VALOR_FIXO, label: 'Valor fixo' },
  { id: TIPO_REMUNERACAO_MISTO, label: 'Percentual + valor fixo (entrada/mínimo)' },
];

export const INTERVALO_PARCELA_MENSAL = 'MENSAL';
export const INTERVALO_PARCELA_UNICA = 'UNICA';

export const FORMAS_PAGAMENTO_HONORARIOS = [
  { id: 'PIX', label: 'PIX' },
  { id: 'BOLETO', label: 'Boleto' },
  { id: 'TRANSFERENCIA', label: 'Transferência' },
  { id: 'OUTRO', label: 'Outro' },
];

export function estadoInicialClausula3() {
  return {
    tipoRemuneracao: TIPO_REMUNERACAO_PERCENTUAL,
    percentualProveito: '35',
    valorFixo: '',
    gerarRecebiveis: false,
    quantidadeParcelas: '1',
    valorTotalParcelas: '',
    primeiroVencimento: new Date().toISOString().slice(0, 10),
    intervaloParcelas: INTERVALO_PARCELA_MENSAL,
    formaPagamento: 'PIX',
  };
}

export function clausula3FormParaApi(form) {
  const percentual =
    form.percentualProveito !== '' && form.percentualProveito != null
      ? Number(String(form.percentualProveito).replace(',', '.'))
      : null;
  const valorFixo =
    form.valorFixo !== '' && form.valorFixo != null
      ? Number(String(form.valorFixo).replace(/\./g, '').replace(',', '.'))
      : null;
  const valorTotalParcelas =
    form.valorTotalParcelas !== '' && form.valorTotalParcelas != null
      ? Number(String(form.valorTotalParcelas).replace(/\./g, '').replace(',', '.'))
      : null;
  const quantidadeParcelas =
    form.quantidadeParcelas !== '' && form.quantidadeParcelas != null
      ? Number(form.quantidadeParcelas)
      : null;

  return {
    tipoRemuneracao: form.tipoRemuneracao,
    percentualProveito: Number.isFinite(percentual) ? percentual : null,
    valorFixo: Number.isFinite(valorFixo) ? valorFixo : null,
    gerarRecebiveis: Boolean(form.gerarRecebiveis),
    quantidadeParcelas: Number.isFinite(quantidadeParcelas) ? quantidadeParcelas : null,
    valorTotalParcelas: Number.isFinite(valorTotalParcelas) ? valorTotalParcelas : null,
    primeiroVencimento: form.primeiroVencimento || null,
    intervaloParcelas: form.intervaloParcelas || INTERVALO_PARCELA_MENSAL,
    formaPagamento: form.formaPagamento || 'PIX',
  };
}

export function parcelamentoAtivo(form) {
  return Boolean(form.gerarRecebiveis);
}

export function valorParcelavelSugerido(form) {
  if (form.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO) {
    return form.valorFixo;
  }
  if (form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO) {
    return form.valorFixo;
  }
  return form.valorTotalParcelas;
}
