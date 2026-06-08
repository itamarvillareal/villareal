/**
 * Grade de processos do cliente — mesma fonte e filtro que Cadastro de Clientes (/pessoas).
 */

import { normalizarNumeroBusca, normalizarTextoBusca } from '../components/CadastroClientes.jsx';
import { termoDigitosCorrespondeCnjCampo } from '../domain/cnjFuzzyBusca.js';
import { loadCadastroClienteDados } from './cadastroClientesStorage.js';
import {
  alinharListaProcessosDescricaoComHistorico,
  enriquecerListaProcessosComHistoricoLocal,
} from './processosHistoricoData.js';
import {
  mergeCadastroClientesProcessosComApi,
} from '../repositories/processosRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  enriquecerLinhaProcessoVinculoFinanceiro,
  prepararIndiceBuscaProcessoVinculo,
} from './buscaClienteProcFinanceiro.js';
import { obterParteOpostaUnificada, obterParteClienteUnificada } from './processosHistoricoData.js';

function apenasDigitos(val) {
  return String(val ?? '').replace(/\D/g, '');
}

function textoUnidadeProcessoGrade(proc) {
  return [proc?.unidade, proc?.unidadeEndereco].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
}

function enriquecerParteOpostaNaGrade(row, codigoPadded8) {
  const n = Number(row.procNumero);
  if (!Number.isFinite(n) || n < 1) return row;
  const atual = String(row.parteOposta ?? row.reu ?? '').trim();
  if (atual && atual !== '—') return row;
  const po = obterParteOpostaUnificada(codigoPadded8, n, atual);
  if (!po) return row;
  return { ...row, parteOposta: po, reu: po };
}

function enriquecerParteClienteNaGrade(row, codigoPadded8) {
  const n = Number(row.procNumero);
  if (!Number.isFinite(n) || n < 1) return row;
  const atual = String(row.parteCliente ?? row.autor ?? row.titularNome ?? '').trim();
  if (atual && atual !== '—') {
    if (!String(row.parteCliente ?? '').trim() && atual) {
      return { ...row, parteCliente: atual, autor: atual };
    }
    return row;
  }
  const pc = obterParteClienteUnificada(codigoPadded8, n, atual);
  if (pc) return { ...row, parteCliente: pc, autor: pc };
  const titular = String(row.titularNome ?? '').trim();
  if (titular) return { ...row, parteCliente: titular, autor: titular };
  return row;
}

/**
 * Filtro da grade «Processos do cliente» (Cadastro de Clientes e modal Financeiro passo 2).
 * @param {Array<Record<string, unknown>>} processos
 * @param {string} termoRaw
 */
export function filtrarProcessosGradeCliente(processos, termoRaw) {
  const termo = normalizarTextoBusca(termoRaw);
  const termoNumero = normalizarNumeroBusca(termoRaw);
  if (!termo) return processos;

  const buscaProcCurta = termoNumero.length > 0 && termoNumero.length <= 2;

  return (processos || []).filter((proc) => {
    const procNumeroStr = String(proc.procNumero ?? '');
    const procInternoDigits = apenasDigitos(proc.procNumero);
    const numeroNovo = normalizarNumeroBusca(proc.processoNovo ?? '');

    const numeroMatch = (() => {
      if (!termoNumero) return false;
      if (buscaProcCurta) return procNumeroStr.includes(termoNumero);
      const procN = Number(procInternoDigits);
      const termN = Number(termoNumero);
      const internoExato =
        Number.isFinite(procN) && Number.isFinite(termN) && procN >= 0 && procN === termN;
      return (
        internoExato ||
        numeroNovo.includes(termoNumero) ||
        termoDigitosCorrespondeCnjCampo(termoNumero, proc.processoNovo ?? '')
      );
    })();

    const autorStr = normalizarTextoBusca(proc.parteCliente ?? proc.autor ?? '');
    const reuStr = normalizarTextoBusca(proc.reu ?? proc.parteOposta ?? '');
    const tipoAcaoStr = normalizarTextoBusca(proc.tipoAcao ?? proc.descricao ?? '');
    const unidadeStr = normalizarTextoBusca(textoUnidadeProcessoGrade(proc));

    return (
      numeroMatch ||
      autorStr.includes(termo) ||
      reuStr.includes(termo) ||
      tipoAcaoStr.includes(termo) ||
      normalizarTextoBusca(proc.parteOposta ?? '').includes(termo) ||
      normalizarTextoBusca(proc.descricao ?? '').includes(termo) ||
      unidadeStr.includes(termo)
    );
  });
}

/** Lista imediata: cadastro local + histórico (`vilareal:processos-historico:v1`), sem API. */
export function carregarProcessosGradeClienteLocal(codigoPadded8) {
  const persisted = loadCadastroClienteDados(codigoPadded8);
  const base = Array.isArray(persisted?.processos) ? persisted.processos : [];
  const alinhado = alinharListaProcessosDescricaoComHistorico(
    codigoPadded8,
    enriquecerListaProcessosComHistoricoLocal(codigoPadded8, base)
  );
  return alinhado.map((row) => enriquecerParteClienteNaGrade(enriquecerParteOpostaNaGrade(row, codigoPadded8), codigoPadded8));
}

/**
 * Completa a grade com GET /api/processos?resumo=true (parte oposta/cliente via processo_parte) + merge como em Clientes.
 * @param {string} codigoPadded8
 * @param {Array<Record<string, unknown>>} listaLocal
 */
/**
 * @param {string} codigoPadded8
 * @param {Array<Record<string, unknown>>} listaLocal
 * @param {{ comPartesNaApi?: boolean }} [opts] — `true` carrega partes na API (réu/autor) para busca no modal Financeiro.
 */
export async function mesclarProcessosGradeClienteComApi(codigoPadded8, listaLocal, opts = {}) {
  if (!featureFlags.useApiProcessos) {
    return Array.isArray(listaLocal) ? listaLocal : [];
  }
  const { listarProcessosPorCodigoCliente, listarProcessosResumoPorCodigoCliente } = await import(
    '../repositories/processosRepository.js'
  );
  const apiList = opts.comPartesNaApi
    ? await listarProcessosPorCodigoCliente(codigoPadded8)
    : await listarProcessosResumoPorCodigoCliente(codigoPadded8);
  const merged = mergeCadastroClientesProcessosComApi(
    codigoPadded8,
    Array.isArray(listaLocal) ? listaLocal : [],
    apiList
  );
  const alinhado = alinharListaProcessosDescricaoComHistorico(codigoPadded8, merged);
  return alinhado.map((row) => enriquecerParteClienteNaGrade(enriquecerParteOpostaNaGrade(row, codigoPadded8), codigoPadded8));
}

/**
 * Linhas do modal «Vincular a Processo» (passo 2), com índice de busca pré-calculado.
 */
export function mapearGradeParaLinhasVinculoModal(gradeRows, nomeCliente, codigoPadded) {
  const nome = String(nomeCliente ?? '').trim();
  const cod = String(codigoPadded ?? '').trim();
  return (gradeRows || []).map((proc) => {
    const n = Number(proc.procNumero);
    const linha = enriquecerLinhaProcessoVinculoFinanceiro(
      {
        processoId: proc.processoId,
        numeroInterno: Number.isFinite(n) && n >= 1 ? n : proc.procNumero,
        numeroProcessoNovo: proc.processoNovo ?? '',
        numeroProcessoVelho: proc.processoVelho ?? '',
        parteOposta: proc.parteOposta ?? proc.reu ?? '',
        parteClienteAutor: String(proc.parteCliente ?? proc.autor ?? '').trim() || nome,
        observacao: proc.descricao ?? proc.tipoAcao ?? '',
        codigoCliente: cod,
      },
      cod
    );
    return prepararIndiceBuscaProcessoVinculo(linha, nome);
  });
}
