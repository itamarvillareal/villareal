/**
 * Consolidação das rodadas persistidas em Cálculos (`vilareal.calculos.rodadas.v1`) para o Relatório Cálculos.
 * Uma linha por parcela (aba Parcelamento / Pagamento), alinhada aos campos da tela {@link Calculos}.
 */
import { loadRodadasCalculos } from './calculosRodadasStorage.js';
import { buildMapaRodadasMockRelatorioCalculos } from './calculosRodadasMockGeracao.js';
import { getNomeClienteCadastroPorCodigo } from './relatorioProcessosDados.js';
import { getLancamentosContaCorrente } from './financeiroData.js';
import { getRegistroProcesso } from './processosHistoricoData.js';

function parseBRL(str) {
  if (str == null) return 0;
  const s = String(str).trim();
  if (!s) return 0;
  const cleaned = s.replace(/R\$\s?/i, '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function formatBRL(n) {
  const v = Number(n) || 0;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trunc2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.trunc(v * 100) / 100;
}

function parseQuantidadeParcelasNumero(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  if (!d) return 0;
  return Math.min(9999, Math.max(0, Number(d)));
}

function parcelaLinhaTemConteudo(p) {
  if (!p || typeof p !== 'object') return false;
  return ['dataVencimento', 'valorParcela', 'honorariosParcela', 'observacao', 'dataPagamento'].some(
    (k) => String(p[k] ?? '').trim() !== ''
  );
}

function inferirSituacaoParcela(dataPag, valorParc) {
  const temPag = String(dataPag ?? '').trim() !== '';
  const temVal = parseBRL(String(valorParc ?? '')) !== 0;
  if (temPag) return 'Paga';
  if (temVal) return 'Pendente';
  return '—';
}

/** Tenta casar data + valor absoluto com lançamento da Conta Corrente (mesmo cliente/proc.). */
function codBaixaContaCorrentePorParcela(lancamentos, dataRef, valorStr) {
  const data = String(dataRef ?? '').trim();
  if (!data) return '';
  const alvo = Math.abs(Math.round(parseBRL(valorStr) * 100));
  if (!alvo) return '';
  for (const l of lancamentos || []) {
    if (String(l.data ?? '').trim() !== data) continue;
    const c = Math.abs(Math.round(Number(l.valor) * 100));
    if (c === alvo) {
      const n = String(l.numero ?? '').trim();
      const b = String(l.nomeBanco ?? '').trim();
      if (n && b) return `${n} · ${b}`;
      return n || b || '';
    }
  }
  return '';
}

/**
 * @param {Array<Record<string, unknown>> | undefined} lista — grade «Títulos» da rodada
 */
export function calcularResumoTitulosCalculos(lista) {
  const valid = (lista || []).filter((r) => String(r?.valorInicial ?? '').trim() !== '');
  const qtd = valid.length;

  const sumValorInicial = valid.reduce((acc, r) => acc + parseBRL(r.valorInicial), 0);
  const sumAtualizacao = valid.reduce((acc, r) => acc + parseBRL(r.atualizacaoMonetaria), 0);
  const sumJuros = valid.reduce((acc, r) => acc + parseBRL(r.juros), 0);
  const sumMulta = valid.reduce((acc, r) => acc + parseBRL(r.multa), 0);
  const sumHonorarios = valid.reduce((acc, r) => acc + parseBRL(r.honorarios), 0);
  const sumTotal = valid.reduce((acc, r) => acc + parseBRL(r.total), 0);

  const diasNums = valid
    .map((r) => Number(String(r?.diasAtraso ?? '').trim()))
    .filter((n) => Number.isFinite(n));
  const sumDias = diasNums.reduce((a, b) => a + b, 0);

  const qtdLabel = `${String(qtd).padStart(2, '0')} título${qtd === 1 ? '' : 's'}`;

  return {
    qtd: qtdLabel,
    valorInicial: formatBRL(trunc2(sumValorInicial)),
    atualizacao: formatBRL(trunc2(sumAtualizacao)),
    diasAtraso: `${Math.floor(sumDias)} dias de atraso`,
    juros: formatBRL(trunc2(sumJuros)),
    multa: formatBRL(trunc2(sumMulta)),
    honorarios: formatBRL(trunc2(sumHonorarios)),
    total: formatBRL(trunc2(sumTotal)),
  };
}

/**
 * Interpreta chave `codCliente8:proc:dimensao` usada em {@link Calculos}.
 * @returns {{ codCliente: string, proc: number, dimensao: number } | null}
 */
export function parseRodadaCalculosKey(key) {
  const parts = String(key ?? '').split(':');
  if (parts.length < 3) return null;
  const dim = Number(parts.pop());
  const proc = Number(parts.pop());
  const codCliente = parts.join(':');
  if (!codCliente || !Number.isFinite(proc) || !Number.isFinite(dim)) return null;
  return { codCliente, proc, dimensao: dim };
}

/**
 * @typedef {object} LinhaRelatorioCalculos
 * @property {string} rodadaKey
 * @property {number} indiceParcela — 0-based (ordenar exibir)
 * @property {string} codCliente — mesmo que coluna «Cód.»
 * @property {string} proc
 * @property {string} dimensao
 */

/** @returns {LinhaRelatorioCalculos[]} */
export function getLinhasRelatorioCalculosConsolidado() {
  /** Mock alinhado à tela Cálculos; persistência sobrescreve por chave `cod8:proc:dim`. */
  const rodadas = { ...buildMapaRodadasMockRelatorioCalculos(), ...(loadRodadasCalculos() || {}) };

  const dimPorClienteProc = new Map();
  for (const key of Object.keys(rodadas)) {
    const p = parseRodadaCalculosKey(key);
    if (!p) continue;
    const k = `${p.codCliente}|${p.proc}`;
    dimPorClienteProc.set(k, (dimPorClienteProc.get(k) || 0) + 1);
  }

  const lancCache = new Map();
  function lancamentosCached(cod, proc) {
    const k = `${cod}|${proc}`;
    if (!lancCache.has(k)) {
      lancCache.set(k, getLancamentosContaCorrente(cod, proc).lancamentos);
    }
    return lancCache.get(k);
  }

  /** @type {Record<string, unknown>[]} */
  const rows = [];

  for (const [key, rodada] of Object.entries(rodadas)) {
    if (!rodada || typeof rodada !== 'object') continue;
    const parsed = parseRodadaCalculosKey(key);
    if (!parsed) continue;

    const { codCliente, proc, dimensao } = parsed;
    const procNum = Math.floor(Number(proc)) || 1;
    const procExibicao = String(procNum).padStart(2, '0');
    const codNum = Number(String(codCliente).replace(/\D/g, ''));
    const cab = rodada.cabecalho && typeof rodada.cabecalho === 'object' ? rodada.cabecalho : {};
    const honorMap =
      rodada.honorariosDataRecebimento && typeof rodada.honorariosDataRecebimento === 'object'
        ? rodada.honorariosDataRecebimento
        : {};
    const parcelas = Array.isArray(rodada.parcelas) ? rodada.parcelas : [];
    const nQ = parseQuantidadeParcelasNumero(rodada.quantidadeParcelasInformada);

    let maxFilled = -1;
    parcelas.forEach((p, i) => {
      if (parcelaLinhaTemConteudo(p)) maxFilled = Math.max(maxFilled, i);
    });
    const numLinhas = Math.max(nQ, maxFilled + 1, 0);
    if (numLinhas === 0) continue;

    const reg = getRegistroProcesso(codCliente, procNum);
    const unidade = String(reg?.unidade ?? '').trim();
    const cliente = getNomeClienteCadastroPorCodigo(Number.isFinite(codNum) && codNum >= 1 ? codNum : 1);
    const reu = String(cab.reu ?? '').trim();
    const calculoAceito = rodada.parcelamentoAceito ? 'Sim' : 'Não';
    const qtdDimensoes = String(dimPorClienteProc.get(`${codCliente}|${proc}`) ?? 1);
    const lancs = lancamentosCached(codCliente, procNum);

    for (let i = 0; i < numLinhas; i++) {
      const p = parcelas[i] || {};
      const chaveHon = `parcela:${i}`;
      const dataVenc = String(p.dataVencimento ?? '').trim();
      const dataPag = String(p.dataPagamento ?? '').trim();
      const valor = String(p.valorParcela ?? '').trim();
      const hon = String(p.honorariosParcela ?? '').trim();
      const obs = String(p.observacao ?? '').trim();
      const dataPagHon = String(honorMap[chaveHon] ?? '').trim();
      const situacao = inferirSituacaoParcela(dataPag, valor);
      const codBaixa = codBaixaContaCorrentePorParcela(lancs, dataPag, valor);

      rows.push({
        rodadaKey: key,
        indiceParcela: i,
        codCliente,
        proc: procExibicao,
        dimensao: String(dimensao),
        navigateCodCliente: codCliente,
        navigateProc: String(procNum),
        navigateDimensao: String(dimensao),
        codigo: codCliente,
        reu,
        unidade,
        dataVencimento: dataVenc,
        dataPagamento: dataPag,
        valor,
        valorHonorarios: hon,
        obs,
        parcela: String(i + 1).padStart(2, '0'),
        calculoAceito,
        cliente,
        dataVencHonorarios: dataVenc,
        valorDosHonorarios: hon,
        dataPagHonorarios: dataPagHon,
        obsPagamentoHonorarios: '',
        reciboAConfeccionar: '',
        situacao,
        qtdDimensoes,
        codBaixaContaCorrente: codBaixa,
      });
    }
  }

  rows.sort((a, b) => {
    const ca = Number(String(a.codCliente).replace(/\D/g, '')) || 0;
    const cb = Number(String(b.codCliente).replace(/\D/g, '')) || 0;
    if (ca !== cb) return ca - cb;
    const pa = Number(String(a.proc).replace(/\D/g, '')) || 0;
    const pb = Number(String(b.proc).replace(/\D/g, '')) || 0;
    if (pa !== pb) return pa - pb;
    const da = Number(a.dimensao) || 0;
    const db = Number(b.dimensao) || 0;
    if (da !== db) return da - db;
    return (Number(a.indiceParcela) || 0) - (Number(b.indiceParcela) || 0);
  });

  return rows;
}
