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

export const FORMA_PAGAMENTO_PIX = 'PIX';
export const FORMA_PAGAMENTO_BOLETO = 'BOLETO';

export const PIX_CNPJ_ESCRITORIO = '39.720.563/0001-90';

import { formatValorMoedaCampo } from '../../utils/moneyBr.js';
import { parseValorMonetarioBr } from '../../utils/parseValorMonetarioBr.js';

export const FORMAS_PAGAMENTO_HONORARIOS = [
  { id: FORMA_PAGAMENTO_PIX, label: 'PIX', descricao: `Chave CNPJ ${PIX_CNPJ_ESCRITORIO}` },
  { id: FORMA_PAGAMENTO_BOLETO, label: 'Boleto bancário', descricao: 'Boleto emitido pelo escritório' },
];

export function estadoInicialClausula3() {
  return {
    tipoRemuneracao: TIPO_REMUNERACAO_PERCENTUAL,
    percentualProveito: '35',
    valorFixo: '',
    temParcelamento: false,
    gerarRecebiveis: false,
    quantidadeParcelas: '2',
    valorTotalParcelas: '',
    primeiroVencimento: new Date().toISOString().slice(0, 10),
    intervaloParcelas: INTERVALO_PARCELA_MENSAL,
    formaPagamento: FORMA_PAGAMENTO_PIX,
  };
}

function parseMoedaBR(valor) {
  if (valor === '' || valor == null) return null;
  return parseValorMonetarioBr(valor);
}

export { parseMoedaBR };

/** Normaliza campo monetário para exibição (ex.: 1000 → 1.000,00). */
export function formatarMoedaCampo(valor) {
  const s = String(valor ?? '').trim();
  if (!s) return '';
  return formatValorMoedaCampo(s);
}

export function clausula3FormParaApi(form) {
  const percentual = parseMoedaBR(form.percentualProveito?.replace?.(',', '.') ?? form.percentualProveito);
  const valorFixo = parseMoedaBR(form.valorFixo);
  const valorTotalParcelas = parseMoedaBR(form.valorTotalParcelas);
  const quantidadeParcelas =
    form.quantidadeParcelas !== '' && form.quantidadeParcelas != null
      ? Number(form.quantidadeParcelas)
      : null;

  return {
    tipoRemuneracao: form.tipoRemuneracao,
    percentualProveito: Number.isFinite(percentual) ? percentual : null,
    valorFixo: Number.isFinite(valorFixo) ? valorFixo : null,
    temParcelamento: Boolean(form.temParcelamento),
    gerarRecebiveis: Boolean(form.gerarRecebiveis),
    quantidadeParcelas: Number.isFinite(quantidadeParcelas) ? quantidadeParcelas : null,
    valorTotalParcelas: Number.isFinite(valorTotalParcelas) ? valorTotalParcelas : null,
    primeiroVencimento: form.primeiroVencimento || null,
    intervaloParcelas: form.intervaloParcelas || INTERVALO_PARCELA_MENSAL,
    formaPagamento: form.formaPagamento || FORMA_PAGAMENTO_PIX,
  };
}

export function parcelamentoAtivo(form) {
  return Boolean(form.temParcelamento);
}

/** Data única de pagamento (fora do parcelamento). */
export function mostraDataPagamento(form) {
  if (parcelamentoAtivo(form)) return false;
  return (
    form.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO ||
    form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO
  );
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

/** Prévia local das parcelas (mesma regra do backend). */
export function calcularParcelasPreview(form) {
  if (!parcelamentoAtivo(form)) return [];
  const total = parseMoedaBR(form.valorTotalParcelas) ?? parseMoedaBR(form.valorFixo);
  if (total == null || total <= 0) return [];

  const qtd = Number(form.quantidadeParcelas);
  const quantidade = Number.isFinite(qtd) && qtd > 0 ? qtd : 1;
  const unica =
    form.intervaloParcelas === INTERVALO_PARCELA_UNICA || quantidade === 1;
  const primeiro = form.primeiroVencimento || new Date().toISOString().slice(0, 10);

  const base = Math.floor((total / quantidade) * 100) / 100;
  let acumulado = 0;
  const parcelas = [];

  for (let i = 1; i <= quantidade; i++) {
    const valor = i < quantidade ? base : Math.round((total - acumulado) * 100) / 100;
    acumulado += valor;
    const d = new Date(`${primeiro}T12:00:00`);
    if (!unica) d.setMonth(d.getMonth() + (i - 1));
    parcelas.push({
      numero: i,
      valor,
      dataVencimento: d.toISOString().slice(0, 10),
    });
  }
  return parcelas;
}

export function formatarMoedaBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

export function formatarDataBR(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
