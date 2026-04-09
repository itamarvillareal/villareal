/**
 * Cruza número CNJ com o cadastro interno (API clientes + processos).
 */

import { getNomeClienteCadastroPorCodigo } from './relatorioProcessosDados.js';
import { obterNumeroProcessoNovoUnificado } from './processosHistoricoData.js';
import { normalizarCnjParaChave } from './publicacoesPdfParser.js';
import { calcularScoreConfianca, datajudStubFromStatusValidacao } from './publicacoesValidacaoScore.js';
import { featureFlags } from '../config/featureFlags.js';
import { listarClientesCadastro } from '../repositories/clientesRepository.js';
import { listarProcessosPorCodigoCliente, mapApiProcessoToUiShape } from '../repositories/processosRepository.js';

/**
 * Índice vazio até {@link montarIndiceCnjClienteProcAsync} concluir (evita dados fictícios).
 */
export function montarIndiceCnjClienteProc() {
  return new Map();
}

/**
 * Mapa CNJ normalizado → { codCliente, proc, cliente }
 */
export async function montarIndiceCnjClienteProcAsync() {
  const map = new Map();
  if (!featureFlags.useApiProcessos || !featureFlags.useApiClientes) {
    return map;
  }
  let clientes;
  try {
    clientes = await listarClientesCadastro();
  } catch {
    return map;
  }
  if (!Array.isArray(clientes) || clientes.length === 0) return map;

  const sorted = [...clientes].sort((a, b) => String(a.codigo ?? '').localeCompare(String(b.codigo ?? '')));

  for (const cli of sorted) {
    const digits = String(cli.codigo ?? '').replace(/\D/g, '');
    const codPad = digits.padStart(8, '0').slice(-8);
    if (!codPad || /^0{8}$/.test(codPad)) continue;

    const nomeCliente =
      String(cli.nomeRazao ?? '').trim() ||
      getNomeClienteCadastroPorCodigo(Number(digits.replace(/^0+/, '') || '0'));

    let rawList;
    try {
      rawList = await listarProcessosPorCodigoCliente(codPad);
    } catch {
      continue;
    }
    const procs = Array.isArray(rawList) ? rawList : [];
    for (const raw of procs) {
      const u = mapApiProcessoToUiShape(raw);
      const p = Number(u.numeroInterno);
      if (!Number.isFinite(p) || p < 1) continue;
      const cnj = obterNumeroProcessoNovoUnificado(codPad, p, u.numeroProcessoNovo ?? '');
      const key = normalizarCnjParaChave(cnj);
      if (!key || map.has(key)) continue;
      map.set(key, {
        codCliente: codPad,
        proc: String(p),
        cliente: nomeCliente,
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
