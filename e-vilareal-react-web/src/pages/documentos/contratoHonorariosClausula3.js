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
    primeiroVencimento: sugerirPrimeiroVencimentoMensal(),
    intervaloParcelas: INTERVALO_PARCELA_MENSAL,
    formaPagamento: FORMA_PAGAMENTO_PIX,
    parcelas: [],
  };
}

/** Dia 1 do próximo mês civil (fuso Brasília) — padrão para parcelas mensais. */
export function sugerirPrimeiroVencimentoMensal() {
  const hojeIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [y, m] = hojeIso.split('-').map(Number);
  let ano = y;
  let mes = m + 1;
  if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
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
  const parcelasResolvidas = resolverParcelasForm(form);
  const somaParcelas = somarValorParcelas(form.parcelas?.length ? form.parcelas : parcelasResolvidas);
  const valorTotalApi =
    somaParcelas != null && somaParcelas > 0
      ? somaParcelas
      : Number.isFinite(valorTotalParcelas)
        ? valorTotalParcelas
        : null;

  return {
    tipoRemuneracao: form.tipoRemuneracao,
    percentualProveito: Number.isFinite(percentual) ? percentual : null,
    valorFixo:
      (form.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO ||
        form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO) &&
      Number.isFinite(valorFixo)
        ? valorFixo
        : null,
    temParcelamento: Boolean(form.temParcelamento),
    gerarRecebiveis: Boolean(form.gerarRecebiveis),
    quantidadeParcelas: form.temParcelamento
      ? Number.isFinite(quantidadeParcelas)
        ? quantidadeParcelas
        : null
      : form.gerarRecebiveis
        ? 1
        : null,
    valorTotalParcelas: form.temParcelamento ? valorTotalApi : null,
    primeiroVencimento: form.primeiroVencimento || null,
    intervaloParcelas: form.intervaloParcelas || INTERVALO_PARCELA_MENSAL,
    formaPagamento: form.formaPagamento || FORMA_PAGAMENTO_PIX,
    parcelas:
      form.temParcelamento && parcelasResolvidas.length > 0
        ? parcelasResolvidas.map((p) => ({
            numero: p.numero,
            valor: p.valor,
            dataVencimento: p.dataVencimento,
          }))
        : null,
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

/** Parcelas exibidas/editadas no formulário (customizadas ou recalculadas). */
export function resolverParcelasForm(form) {
  if (!parcelamentoAtivo(form)) return [];
  const qtd = Number(form.quantidadeParcelas);
  const quantidade = Number.isFinite(qtd) && qtd > 0 ? qtd : 0;
  const custom = Array.isArray(form.parcelas) ? form.parcelas : [];
  if (custom.length === quantidade && custom.every((p) => p?.dataVencimento && Number.isFinite(Number(p?.valor)))) {
    return custom.map((p, idx) => ({
      numero: p.numero ?? idx + 1,
      valor: Number(p.valor),
      dataVencimento: String(p.dataVencimento).slice(0, 10),
    }));
  }
  return calcularParcelasPreview(form);
}

/** Soma dos valores das parcelas (centavos arredondados). */
export function somarValorParcelas(parcelas) {
  if (!Array.isArray(parcelas) || parcelas.length === 0) return null;
  const total = parcelas.reduce((acc, p) => acc + valorEfetivoParcela(p), 0);
  return Math.round(total * 100) / 100;
}

function valorEfetivoParcela(parcela) {
  if (parcela?.valorDisplay != null && String(parcela.valorDisplay).trim() !== '') {
    const parsed = parseMoedaBR(formatarMoedaCampo(parcela.valorDisplay));
    if (parsed != null && parsed >= 0) return parsed;
  }
  if (Number.isFinite(Number(parcela?.valor))) return Number(parcela.valor);
  return 0;
}

/** Atualiza valor total (e valor fixo, se aplicável) conforme a soma das parcelas. */
export function sincronizarTotalComParcelas(form) {
  const parcelas = Array.isArray(form.parcelas) ? form.parcelas : resolverParcelasForm(form);
  const soma = somarValorParcelas(parcelas);
  if (soma == null || soma <= 0) return form;
  const totalFmt = formatarMoedaCampo(soma);
  const next = { ...form, valorTotalParcelas: totalFmt };
  if (
    form.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO ||
    form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO
  ) {
    next.valorFixo = totalFmt;
  }
  return next;
}

/** Recalcula parcelas automáticas a partir dos totais/prazos. */
export function recalcularParcelasForm(form) {
  return {
    ...form,
    parcelas: calcularParcelasPreview(form),
  };
}

export function atualizarParcelaForm(form, indice, patch) {
  const base = resolverParcelasForm(form);
  if (indice < 0 || indice >= base.length) return form;
  const parcelas = (form.parcelas?.length === base.length ? form.parcelas : base).map((p, idx) => {
    if (idx !== indice) return { ...base[idx], ...p, numero: base[idx].numero, valor: base[idx].valor, dataVencimento: base[idx].dataVencimento };
    const merged = { ...base[idx], ...p, ...patch };
    if (patch.valor != null && patch.valorDisplay === undefined) {
      delete merged.valorDisplay;
    }
    return merged;
  });
  return sincronizarTotalComParcelas({ ...form, parcelas });
}

export function formatarMoedaBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor ?? 0);
}

export function formatarDataBR(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Reconstrói o formulário da Cláusula 3ª a partir dos dados salvos no backend. */
export function clausula3DadosParaForm(dados, dataContrato = null) {
  if (!dados) return estadoInicialClausula3();
  const dataContratoIso = dataContrato ? String(dataContrato).slice(0, 10) : null;
  const form = {
    ...estadoInicialClausula3(),
    tipoRemuneracao: dados.tipoRemuneracao || TIPO_REMUNERACAO_PERCENTUAL,
    percentualProveito:
      dados.percentualProveito != null ? String(dados.percentualProveito).replace('.', ',') : '35',
    valorFixo: dados.valorFixo != null ? formatarMoedaCampo(dados.valorFixo) : '',
    temParcelamento: Boolean(dados.temParcelamento),
    gerarRecebiveis: Boolean(dados.gerarRecebiveis),
    quantidadeParcelas:
      dados.quantidadeParcelas != null ? String(dados.quantidadeParcelas) : '2',
    valorTotalParcelas:
      dados.valorTotalParcelas != null ? formatarMoedaCampo(dados.valorTotalParcelas) : '',
    primeiroVencimento:
      dados.primeiroVencimento || dataContratoIso || sugerirPrimeiroVencimentoMensal(),
    intervaloParcelas: dados.intervaloParcelas || INTERVALO_PARCELA_MENSAL,
    formaPagamento: dados.formaPagamento || FORMA_PAGAMENTO_PIX,
    parcelas: Array.isArray(dados.parcelas)
      ? dados.parcelas.map((p, idx) => ({
          numero: p.numero ?? p.numeroParcela ?? idx + 1,
          valor: Number(p.valor),
          dataVencimento: String(p.dataVencimento ?? p.data_vencimento ?? '').slice(0, 10),
        }))
      : [],
  };
  if (form.temParcelamento && form.parcelas.length === 0) {
    form.parcelas = calcularParcelasPreview(form);
  }
  return form;
}

export const ANTECEDENCIA_VENCIMENTO_DIA = 'VENCIMENTO_DIA';
export const ANTECEDENCIA_VENCIMENTO_MENOS_1 = 'VENCIMENTO_MENOS_1';
export const ANTECEDENCIA_VENCIMENTO_MENOS_3 = 'VENCIMENTO_MENOS_3';

export const ANTECEDENCIAS_WHATSAPP_HONORARIOS = [
  { value: ANTECEDENCIA_VENCIMENTO_DIA, label: 'No dia do vencimento (D+0)' },
  { value: ANTECEDENCIA_VENCIMENTO_MENOS_1, label: '1 dia antes (D-1)' },
  { value: ANTECEDENCIA_VENCIMENTO_MENOS_3, label: '3 dias antes (D-3)' },
];

export function whatsappCobrancaInicial() {
  return {
    ativo: false,
    horarioEnvio: '09:00',
    antecedencia: ANTECEDENCIA_VENCIMENTO_DIA,
    telefonesExtrasTexto: '',
  };
}

export function whatsappCobrancaParaForm(config) {
  if (!config) return whatsappCobrancaInicial();
  const extras = Array.isArray(config.telefonesExtras) ? config.telefonesExtras : [];
  return {
    ativo: Boolean(config.ativo),
    horarioEnvio: config.horarioEnvio || '09:00',
    antecedencia: config.antecedencia || ANTECEDENCIA_VENCIMENTO_DIA,
    telefonesExtrasTexto: extras.join('\n'),
  };
}

export function whatsappCobrancaParaApi(form) {
  const raw = String(form.telefonesExtrasTexto ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean)
    .map((d) => (d.startsWith('55') ? d : `55${d}`));
  return {
    ativo: Boolean(form.ativo),
    horarioEnvio: form.horarioEnvio || '09:00',
    antecedencia: form.antecedencia || ANTECEDENCIA_VENCIMENTO_DIA,
    telefonesExtras: raw,
  };
}

/** Totais de parcelas contratuais (recebido / pendente). */
export function resumirParcelasHonorarios(parcelas) {
  const lista = Array.isArray(parcelas) ? parcelas : [];
  const total = lista.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const recebido = lista.reduce(
    (s, p) => s + (p.pagamentoPago ? Number(p.valor) || 0 : 0),
    0,
  );
  const pagas = lista.filter((p) => p.pagamentoPago).length;
  return {
    total: Math.round(total * 100) / 100,
    recebido: Math.round(recebido * 100) / 100,
    pendente: Math.round(Math.max(0, total - recebido) * 100) / 100,
    qtdParcelas: lista.length,
    qtdPagas: pagas,
  };
}
