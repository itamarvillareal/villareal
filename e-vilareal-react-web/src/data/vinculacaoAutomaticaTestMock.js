/**
 * Dados de teste: 50 parcelas (Cálculos) + 50 lançamentos distribuídos em 5 bancos
 * (Nubank, CORA, CEF, Itaú, PicPay — 10 cada), mesma data e valor que cada parcela,
 * para testar a vinculação automática varrendo todos os extratos. Cliente 999, proc. 88, dimensão 0.
 */

export const RODADA_KEY_VINCULACAO_TESTE = '00000999:88:0';

/** Bancos que recebem fatias do extrato de teste (50 ÷ 5 = 10 lançamentos por banco). */
export const BANCOS_VINCULACAO_TESTE = ['Nubank', 'CORA', 'CEF', 'Itaú', 'PicPay'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmtBRL(n) {
  const v = Math.round(Number(n) * 100) / 100;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 50 datas consecutivas a partir da data-base abaixo e valores únicos em centavos. */
export function gerarParesParcelaExtrato50() {
  const parcelas = [];
  const extrato = [];
  /** Altere para renovar o período de teste (parcelas + extratos são recalculados no build). */
  const base = new Date(2026, 2, 1);
  let saldo = 0;

  for (let i = 0; i < 50; i++) {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + i);
    const dd = pad2(dt.getDate());
    const mm = pad2(dt.getMonth() + 1);
    const yyyy = String(dt.getFullYear());
    const data = `${dd}/${mm}/${yyyy}`;

    const valorReais = 75 + (i * 41) % 420 + ((i * 7) % 100) / 100;
    const v = Math.round(valorReais * 100) / 100;
    const valorNeg = -v;
    saldo += valorNeg;

    parcelas.push({
      dataVencimento: data,
      valorParcela: fmtBRL(v),
      honorariosParcela: '',
      observacao: `Teste vinc. auto ${i + 1}/50`,
      dataPagamento: '',
    });

    extrato.push({
      letra: 'A',
      numero: String(88000 + i),
      data,
      descricao: 'PIX TESTE VINC. AUTO',
      valor: valorNeg,
      saldo,
      saldoDesc: '',
      descricaoDetalhada: '',
      categoria: '',
      codCliente: '',
      proc: '',
      dimensao: '',
      parcela: '',
      ref: '',
      eq: '',
    });
  }

  return { parcelas, extrato };
}

function recomputeSaldo(lancamentos) {
  let saldo = 0;
  return lancamentos.map((l) => {
    saldo += l.valor;
    return { ...l, saldo };
  });
}

/**
 * Divide os 50 lançamentos em fatias por banco; saldo recalculado por extrato (por banco).
 */
export function splitExtratoVinculacaoTestePorBanco(extratoCompleto, bancos = BANCOS_VINCULACAO_TESTE) {
  const n = bancos.length;
  if (!extratoCompleto.length || n === 0) return {};
  const chunk = Math.ceil(extratoCompleto.length / n);
  const out = {};
  for (let b = 0; b < n; b++) {
    const nome = bancos[b];
    const slice = extratoCompleto.slice(b * chunk, b * chunk + chunk);
    const comSaldo = recomputeSaldo(slice);
    out[nome] = comSaldo.map((l) => ({
      ...l,
      descricao: `PIX TESTE VINC. AUTO [${nome}]`,
    }));
  }
  return out;
}

const titulosMinimosTeste = Array.from({ length: 24 }, () => ({
  dataVencimento: '',
  valorInicial: '',
  atualizacaoMonetaria: '',
  diasAtraso: '',
  juros: '',
  multa: '',
  honorarios: '',
  total: '',
  descricaoValor: '',
}));

const { parcelas: PARCELAS_TESTE_50, extrato: EXTRATO_COMPLETO_50 } = gerarParesParcelaExtrato50();

const EXTRATOS_VINCULACAO_TESTE_POR_BANCO = splitExtratoVinculacaoTestePorBanco(EXTRATO_COMPLETO_50);

/** Rodada única para Cálculos (persistida junto com outras rodadas). */
export function buildRodadaCalculosVinculacaoTeste50() {
  return {
    pagina: 1,
    paginaParcelamento: 1,
    titulos: titulosMinimosTeste,
    parcelas: PARCELAS_TESTE_50,
    quantidadeParcelasInformada: '50',
    taxaJurosParcelamento: '0,00',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: {
      autor: 'CLIENTE TESTE 999 — PROC 88 (mock vinculação)',
      reu: 'RÉU MOCK — TESTE AUTOMÁTICO',
    },
    honorariosDataRecebimento: {},
    parcelamentoAceito: true,
  };
}

/** Merge para estado inicial de rodadas (chave fixa). */
export const RODADAS_VINCULACAO_TESTE_50 = {
  [RODADA_KEY_VINCULACAO_TESTE]: buildRodadaCalculosVinculacaoTeste50(),
};

/** Mapa banco → lançamentos de teste (cópia profunda). */
export function getExtratosVinculacaoTestePorBanco() {
  return JSON.parse(JSON.stringify(EXTRATOS_VINCULACAO_TESTE_POR_BANCO));
}

/** Compat: apenas a fatia Nubank (10 lançamentos). */
export function getExtratoNubankVinculacaoTeste50() {
  return JSON.parse(JSON.stringify(EXTRATOS_VINCULACAO_TESTE_POR_BANCO.Nubank || []));
}
