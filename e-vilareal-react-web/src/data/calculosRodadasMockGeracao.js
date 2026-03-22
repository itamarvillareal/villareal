/**
 * Geração de rodadas mock alinhada à tela {@link Calculos} (títulos, parcelas, cabeçalho).
 * Usada pelo Relatório Cálculos para consolidar linhas sem depender de cada combinação já ter sido aberta.
 */
import { padCliente, normalizarCliente, normalizarProcesso } from './processosDadosRelatorio.js';
import { getMockProcesso10x10 } from './processosMock.js';
import { getParesClienteProcMockRelatorio } from './relatorioProcessosDados.js';

export const PARCELAS_POR_PAGINA_MOCK = 20;

function seededRand(seed0) {
  let seed = seed0 >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
}

export function gerarCabecalhoMock(codigoCliente, proc) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProcesso(proc));
  const mock10 = getMockProcesso10x10(c, p);
  if (mock10) return { autor: mock10.parteCliente, reu: mock10.parteOposta };
  const autor = `PARTE CLIENTE ${String(c).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`;
  const reu = `PARTE OPOSTA ${String((c * 7 + p) % 999).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`;
  return { autor, reu };
}

export function gerarTitulosMock(codigoCliente, proc, dimensao) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProcesso(proc));
  const d = Math.max(0, Math.floor(Number(dimensao) || 0));

  const rand = seededRand((c * 2654435761 + p * 97531 + d * 104729) >>> 0);
  const total = 60;
  const baseAno = 2024 + ((p + d) % 2);
  const rows = [];
  for (let i = 0; i < total; i++) {
    const preencher = i < 24 || rand() > 0.35;
    if (!preencher) {
      rows.push({
        dataVencimento: '',
        valorInicial: '',
        atualizacaoMonetaria: '',
        diasAtraso: '',
        juros: '',
        multa: '',
        honorarios: '',
        total: '',
        descricaoValor: '',
      });
      continue;
    }
    const dia = String(((i + p + 1) % 28) + 1).padStart(2, '0');
    const mes = String(((i + d) % 12) + 1).padStart(2, '0');
    const ano = String(baseAno);
    const principal = Math.round((800 + c * 17 + p * 31 + d * 53 + i * (60 + d * 4) + rand() * 500) * 100) / 100;
    rows.push({
      dataVencimento: `${dia}/${mes}/${ano}`,
      valorInicial: `R$ ${principal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      atualizacaoMonetaria: '',
      diasAtraso: '',
      juros: '',
      multa: '',
      honorarios: '',
      total: '',
      descricaoValor: '',
    });
  }
  return rows;
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
