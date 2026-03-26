/**
 * Geração de rodadas mock alinhada à tela {@link Calculos} (títulos, parcelas, cabeçalho).
 * Usada pelo Relatório Cálculos para consolidar linhas sem depender de cada combinação já ter sido aberta.
 */
import { padCliente, normalizarProcesso } from './processosDadosRelatorio.js';
import { getParesClienteProcMockRelatorio } from './relatorioProcessosDados.js';

export const PARCELAS_POR_PAGINA_MOCK = 20;

export function gerarCabecalhoMock() {
  return { autor: '', reu: '' };
}

export function gerarTitulosMock() {
  const vazio = {
    dataVencimento: '',
    valorInicial: '',
    atualizacaoMonetaria: '',
    diasAtraso: '',
    juros: '',
    multa: '',
    honorarios: '',
    total: '',
    descricaoValor: '',
  };
  return Array.from({ length: 60 }, () => ({ ...vazio }));
}

export function linhaVaziaParcela() {
  return {
    dataVencimento: '',
    valorParcela: '',
    honorariosParcela: '',
    observacao: '',
    dataPagamento: '',
  };
}

export function gerarParcelasMock() {
  return Array.from({ length: PARCELAS_POR_PAGINA_MOCK }, () => linhaVaziaParcela());
}

/**
 * Rodada inicial idêntica à criada em Cálculos ao entrar num cliente/proc/dimensão novo.
 * @param {Record<string, unknown>} [overrides] — sobrescreve campos (ex.: parcelas de teste 50).
 */
export function criarRodadaMockCalculos(codClienteRaw, procRaw, dimensaoRaw, overrides = {}) {
  const cod8 = padCliente(codClienteRaw);
  const proc = normalizarProcesso(procRaw);
  const dim = Math.max(0, Math.floor(Number(dimensaoRaw) || 0));
  const base = {
    pagina: 1,
    paginaParcelamento: 1,
    titulos: gerarTitulosMock(cod8, proc, dim),
    parcelas: gerarParcelasMock(),
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: gerarCabecalhoMock(cod8, proc),
    honorariosDataRecebimento: {},
    parcelamentoAceito: false,
    panelConfig: undefined,
  };
  return { ...base, ...overrides };
}

let _mapaMockRelatorioCache = null;

/**
 * Mapa `cod8:proc:0` → rodada com títulos mock (mesma grade que Cálculos), para todas as combinações do Relatório Processos.
 * Dados persistidos pelo usuário sobrescrevem estas chaves em {@link getLinhasRelatorioCalculosConsolidado}.
 */
export function buildMapaRodadasMockRelatorioCalculos() {
  if (_mapaMockRelatorioCache) return _mapaMockRelatorioCache;
  const map = {};
  for (const [c, p] of getParesClienteProcMockRelatorio()) {
    const cod8 = padCliente(c);
    const key = `${cod8}:${p}:0`;
    map[key] = criarRodadaMockCalculos(c, p, 0, {
      parcelamentoAceito: (c + p) % 9 === 0,
      quantidadeParcelasInformada: (c + p) % 6 === 0 ? '12' : '00',
    });
  }
  _mapaMockRelatorioCache = map;
  return map;
}
