/**
 * Cruza número CNJ com o cadastro interno (mesma fonte que Relatório Processos / Processos).
 */

import { getParesClienteProcMockRelatorio } from './relatorioProcessosDados.js';
import { getNomeClienteCadastroPorCodigo } from './relatorioProcessosDados.js';
import { getDadosProcessoClienteUnificado } from './processoClienteProcUnificado.js';
import { obterNumeroProcessoNovoUnificado } from './processosHistoricoData.js';
import { normalizarCnjParaChave } from './publicacoesPdfParser.js';
import { calcularScoreConfianca, datajudStubFromStatusValidacao } from './publicacoesValidacaoScore.js';

/**
 * Mapa CNJ normalizado → { codCliente, proc, cliente }
 */
export function montarIndiceCnjClienteProc() {
  const map = new Map();
  for (const [c, p] of getParesClienteProcMockRelatorio()) {
    const u = getDadosProcessoClienteUnificado(c, p);
    const cnj = obterNumeroProcessoNovoUnificado(c, p, u?.processoNovo ?? '');
    const key = normalizarCnjParaChave(cnj);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        codCliente: String(c).padStart(8, '0'),
        proc: String(p),
        cliente: getNomeClienteCadastroPorCodigo(c),
      });
    }
  }
  return map;
}

export function vincularPublicacaoAoCadastro(parseado, indiceMap) {
  const cnj = parseado.processoCnjNormalizado || normalizarCnjParaChave(parseado.numeroCnj);
  if (!cnj) {
    return {
      ...parseado,
      statusVinculo: 'sem_cnj',
      codCliente: '',
      procInterno: '',
      cliente: '',
      vinculoOrigem: '',
    };
  }
  const hit = indiceMap.get(cnj);
  if (!hit) {
    return {
      ...parseado,
      statusVinculo: 'nao_vinculado',
      codCliente: '',
      procInterno: '',
      cliente: '',
      vinculoOrigem: '',
    };
  }
  return {
    ...parseado,
    statusVinculo: 'vinculado',
    codCliente: hit.codCliente,
    procInterno: hit.proc,
    cliente: hit.cliente,
    vinculoOrigem: 'cadastro',
  };
}

function padCodCliente(s) {
  const n = String(s ?? '').replace(/\D/g, '');
  if (!n) return '';
  return n.padStart(8, '0').slice(-8);
}

/** Normaliza item da prévia ou do armazenamento para o formato esperado pelo parser de vínculo. */
function comoParseadoParaVinculo(item) {
  const cnj =
    item.processoCnjNormalizado ||
    item.numero_processo_cnj ||
    item.numeroCnj ||
    '';
  const norm = normalizarCnjParaChave(cnj) || cnj;
  return {
    ...item,
    numeroCnj: norm,
    processoCnjNormalizado: norm,
    statusTeor: item.statusTeor ?? item.statusPublicacao,
  };
}

/**
 * Vincula manualmente a publicação a código de cliente e proc. interno (auditoria: vinculoOrigem manual).
 * Recalcula score de confiança com base no status CNJ já conhecido.
 */
export function aplicarVinculoManual(item, { codCliente, procInterno, cliente }) {
  const cod = padCodCliente(codCliente);
  const proc = String(procInterno ?? '').trim();
  let nome = String(cliente ?? '').trim();
  if (cod && !nome) nome = getNomeClienteCadastroPorCodigo(Number.parseInt(cod, 10));
  if (!cod || !proc) {
    return { ...item, erroVinculo: 'Informe o código do cliente e o proc. interno.' };
  }
  const base = comoParseadoParaVinculo(item);
  const divergencias = Array.isArray(base.divergenciasPdfCnj) ? base.divergenciasPdfCnj : [];
  const statusVal = base.statusValidacaoCnj || '';
  const dj = datajudStubFromStatusValidacao(statusVal);
  const next = {
    ...base,
    statusVinculo: 'vinculado',
    codCliente: cod,
    procInterno: proc,
    cliente: nome,
    vinculoOrigem: 'manual',
  };
  delete next.erroVinculo;
  next.scoreConfianca = calcularScoreConfianca({
    processoCnjNormalizado: next.processoCnjNormalizado,
    statusTeor: next.statusTeor,
    statusVinculo: 'vinculado',
    datajudResult: dj,
    divergencias,
  });
  return next;
}

/**
 * Remove vínculo manual e reaplica o cruzamento automático com o cadastro interno (mesmo índice CNJ).
 */
export function reaplicarVinculoCadastro(item, indiceMap) {
  const limpo = { ...comoParseadoParaVinculo(item) };
  delete limpo.vinculoOrigem;
  delete limpo.erroVinculo;
  const v = vincularPublicacaoAoCadastro(limpo, indiceMap);
  const divergencias = Array.isArray(v.divergenciasPdfCnj) ? v.divergenciasPdfCnj : [];
  const dj = datajudStubFromStatusValidacao(v.statusValidacaoCnj ?? limpo.statusValidacaoCnj);
  return {
    ...v,
    scoreConfianca: calcularScoreConfianca({
      processoCnjNormalizado: v.processoCnjNormalizado,
      statusTeor: v.statusTeor,
      statusVinculo: v.statusVinculo,
      datajudResult: dj,
      divergencias,
    }),
  };
}
