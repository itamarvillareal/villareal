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
 * Mapa CNJ normalizado → { codCliente, proc, cliente, reu }
 * `reu` vem de `parteOposta` do processo (mesma regra da tela Processos).
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
      const cnjApi = String(u.numeroProcessoNovo ?? '').trim();
      const cnj = cnjApi || obterNumeroProcessoNovoUnificado(codPad, p, '');
      const key = normalizarCnjParaChave(cnj);
      if (!key || map.has(key)) continue;
      const reu = String(u.parteOposta ?? '').trim();
      map.set(key, {
        codCliente: codPad,
        proc: String(p),
        cliente: nomeCliente,
        reu,
      });
    }
  }
  return map;
}

/**
 * Busca no mapa CNJ→cadastro tentando variantes sem zero à esquerda no 1º segmento
 * (PDFs antigos podem trazer `0356280-…` enquanto o cadastro gravou `356280-…`).
 */
export function buscarHitIndiceCnjPorCnj(indiceMap, cnjRaw) {
  if (!(indiceMap instanceof Map) || indiceMap.size === 0) return null;
  const s0 = String(cnjRaw ?? '').trim();
  if (!s0) return null;
  const keyCanon = normalizarCnjParaChave(s0);
  const upRaw = s0.toUpperCase();
  const candidatos = [];
  if (keyCanon) candidatos.push(keyCanon);
  if (upRaw && upRaw !== keyCanon) candidatos.push(upRaw);

  for (const base of candidatos) {
    const m = base.match(/^(\d+)-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/);
    if (!m) {
      const hit = indiceMap.get(base);
      if (hit) return { hit, chaveUsada: base };
      continue;
    }
    const tail = `${m[2]}.${m[3]}.${m[4]}.${m[5]}.${m[6]}`;
    const seen = new Set();
    let seg = m[1];
    for (;;) {
      const k = `${seg}-${tail}`.toUpperCase();
      if (!seen.has(k)) {
        seen.add(k);
        const hit = indiceMap.get(k);
        if (hit) return { hit, chaveUsada: k };
      }
      if (!seg.startsWith('0') || seg.length <= 1) break;
      seg = seg.slice(1);
    }
  }
  return null;
}

/**
 * Resolve cliente / proc. interno / réu pelo CNJ no cadastro, sem alterar o item.
 * Útil quando o índice ainda não existia na importação ou quando a linha veio da API sem vínculo persistido.
 */
export function lookupSugestaoVinculoCadastro(item, indiceMap) {
  const cnj =
    item?.processoCnjNormalizado ||
    item?.numero_processo_cnj ||
    item?.numeroCnj ||
    '';
  const res = buscarHitIndiceCnjPorCnj(indiceMap, cnj);
  if (!res) return null;
  const { hit } = res;
  return {
    codCliente: hit.codCliente,
    procInterno: hit.proc,
    cliente: hit.cliente,
    reu: hit.reu || '',
  };
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
      reu: '',
      vinculoOrigem: '',
    };
  }
  const res = buscarHitIndiceCnjPorCnj(indiceMap, cnj || parseado.numeroCnj);
  if (!res) {
    return {
      ...parseado,
      statusVinculo: 'nao_vinculado',
      codCliente: '',
      procInterno: '',
      cliente: '',
      reu: '',
      vinculoOrigem: '',
    };
  }
  const hit = res.hit;
  const reu = String(hit.reu ?? '').trim();
  return {
    ...parseado,
    statusVinculo: 'vinculado',
    codCliente: hit.codCliente,
    procInterno: hit.proc,
    cliente: hit.cliente,
    reu,
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
    reu: '',
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
