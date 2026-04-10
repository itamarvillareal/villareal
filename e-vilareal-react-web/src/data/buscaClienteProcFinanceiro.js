/**
 * Busca cod. cliente + proc. a partir de nome do cliente, CPF/CNPJ, autor, réu ou nº de processo —
 * usando apenas `vilareal:processos-historico:v1` (sem cadastro sintético).
 */

import { normalizarTextoBusca, normalizarNumeroBusca } from '../components/CadastroClientes.jsx';
import { normalizarCodigoClienteFinanceiro } from './financeiroData';
import {
  listarRegistrosProcessosHistoricoNormalizados,
  obterDescricaoAcaoUnificada,
  obterNumeroProcessoNovoUnificado,
  obterNumeroProcessoVelhoUnificado,
  obterParteOpostaUnificada,
} from './processosHistoricoData.js';

/** Compara sequências só de dígitos (CNJ normalizado); evita `''.includes('')` como match falso. */
function digitosCorrespondem(hayDigits, needleDigits) {
  if (!needleDigits) return false;
  if (!hayDigits) return false;
  return hayDigits.includes(needleDigits) || needleDigits.includes(hayDigits);
}

/**
 * @param {string} termoRaw
 * @param {{ maxResults?: number }} [opts]
 * @returns {Array<{ codCliente: string, proc: string, nomeCliente: string, cnpjCpf: string, processoNovo: string, autor: string, reu: string, tipoAcao: string }>}
 */
export function buscarParesClienteProcPorTexto(termoRaw, opts = {}) {
  const maxResults = opts.maxResults ?? 120;
  const termoRawStr = String(termoRaw ?? '').trim();
  const termo = normalizarTextoBusca(termoRawStr);
  const termoNumero = normalizarNumeroBusca(termoRawStr);
  if (!termo && !termoNumero) return [];

  const buscaProcCurta = termoNumero.length > 0 && termoNumero.length <= 2;
  const out = [];

  for (const reg of listarRegistrosProcessosHistoricoNormalizados()) {
    const codJur = String(reg.codCliente ?? '').trim();
    const pNum = Number(reg.proc);
    if (!codJur || !Number.isFinite(pNum) || pNum < 1) continue;

    const procNumeroStr = String(pNum);
    const nomeClienteNorm = normalizarTextoBusca(reg.cliente ?? '');

    const processoNovoDisp = obterNumeroProcessoNovoUnificado(codJur, pNum, reg.numeroProcessoNovo ?? '');
    const processoVelhoDisp = obterNumeroProcessoVelhoUnificado(codJur, pNum, reg.numeroProcessoVelho ?? '');
    const parteOpostaDisp = obterParteOpostaUnificada(codJur, pNum, reg.parteOposta ?? '');
    const descricaoDisp = obterDescricaoAcaoUnificada(codJur, pNum, reg.naturezaAcao ?? '');

    const numeroNovo = normalizarNumeroBusca(processoNovoDisp);
    const numeroVelho = normalizarNumeroBusca(processoVelhoDisp);

    const numeroMatch = (() => {
      if (!termoNumero) return false;
      if (buscaProcCurta) return procNumeroStr.includes(termoNumero);
      const procN = Number(procNumeroStr);
      const termN = Number(termoNumero);
      const internoExato =
        Number.isFinite(procN) && Number.isFinite(termN) && procN >= 0 && procN === termN;
      return (
        internoExato ||
        digitosCorrespondem(numeroNovo, termoNumero) ||
        digitosCorrespondem(numeroVelho, termoNumero)
      );
    })();

    const autorStr = normalizarTextoBusca(reg.parteCliente ?? '');
    const reuStr = normalizarTextoBusca(reg.parteOposta ?? parteOpostaDisp ?? '');
    const tipoAcaoStr = normalizarTextoBusca(descricaoDisp ?? '');
    const descStr = normalizarTextoBusca(descricaoDisp ?? '');
    const parteOpostaNorm = normalizarTextoBusca(parteOpostaDisp ?? '');

    const stripped = String(codJur).replace(/^0+/, '');
    const codClienteNum = Number(stripped) || 0;
    const codFin = normalizarCodigoClienteFinanceiro(codClienteNum);
    if (!codFin) continue;

    const clienteMatch = termo && nomeClienteNorm.includes(termo);

    const procMatch =
      numeroMatch ||
      (termo &&
        (autorStr.includes(termo) ||
          reuStr.includes(termo) ||
          tipoAcaoStr.includes(termo) ||
          descStr.includes(termo) ||
          parteOpostaNorm.includes(termo)));

    if (!(clienteMatch || procMatch)) continue;

    out.push({
      codCliente: codFin,
      proc: procNumeroStr,
      nomeCliente: reg.cliente ?? '',
      cnpjCpf: '',
      processoNovo: processoNovoDisp,
      autor: reg.parteCliente ?? '',
      reu: reg.parteOposta ?? parteOpostaDisp ?? '',
      tipoAcao: descricaoDisp || '',
    });

    if (out.length >= maxResults) return out;
  }

  return out;
}

/**
 * Clientes únicos do histórico local (nome/código) para o assistente Conta Escritório sem API de cadastro.
 * @param {string} termoRaw
 * @param {{ maxResults?: number }} [opts]
 * @returns {Array<{ codCliente: string, nomeCliente: string, cnpjCpf: string }>}
 */
export function buscarClientesUnicosPorTextoHistorico(termoRaw, opts = {}) {
  const maxResults = opts.maxResults ?? 80;
  const termoRawStr = String(termoRaw ?? '').trim();
  const termo = normalizarTextoBusca(termoRawStr);
  const termoNumero = normalizarNumeroBusca(termoRawStr);
  if (!termo && !termoNumero) return [];

  /** @type {Map<string, string>} */
  const porCod = new Map();
  for (const reg of listarRegistrosProcessosHistoricoNormalizados()) {
    const codJur = String(reg.codCliente ?? '').trim();
    const pNum = Number(reg.proc);
    if (!codJur || !Number.isFinite(pNum) || pNum < 1) continue;
    const codFin = normalizarCodigoClienteFinanceiro(Number(String(codJur).replace(/^0+/, '') || 0));
    if (!codFin) continue;
    const nome = String(reg.cliente ?? '').trim();
    if (!porCod.has(codFin)) porCod.set(codFin, nome);
  }

  const out = [];
  for (const [codFin, nome] of porCod) {
    const nomeN = normalizarTextoBusca(nome);
    const codDigits = normalizarNumeroBusca(codFin);
    const match =
      (termo && nomeN.includes(termo)) ||
      (termoNumero && (codDigits.includes(termoNumero) || termoNumero.includes(codDigits)));
    if (!match) continue;
    out.push({ codCliente: codFin, nomeCliente: nome, cnpjCpf: '' });
    if (out.length >= maxResults) break;
  }
  return out.sort((a, b) => a.nomeCliente.localeCompare(b.nomeCliente, 'pt-BR'));
}

/**
 * Pares cliente+proc do histórico local para um código de cliente já normalizado (ex. "12").
 * @param {string|number} codClienteRaw
 * @param {{ maxResults?: number }} [opts]
 */
export function listarParesPorCodigoClienteHistorico(codClienteRaw, opts = {}) {
  const maxResults = opts.maxResults ?? 200;
  const n = Number(String(codClienteRaw ?? '').replace(/\D/g, ''));
  const codW = normalizarCodigoClienteFinanceiro(Number.isFinite(n) && n >= 1 ? n : codClienteRaw);
  if (!codW) return [];
  const seen = new Set();
  const out = [];
  for (const reg of listarRegistrosProcessosHistoricoNormalizados()) {
    const codJur = String(reg.codCliente ?? '').trim();
    const pNum = Number(reg.proc);
    if (!codJur || !Number.isFinite(pNum) || pNum < 1) continue;
    const codFin = normalizarCodigoClienteFinanceiro(Number(String(codJur).replace(/^0+/, '') || 0));
    if (codFin !== codW) continue;
    const key = `${codFin}-${pNum}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const processoNovoDisp = obterNumeroProcessoNovoUnificado(codJur, pNum, reg.numeroProcessoNovo ?? '');
    const processoVelhoDisp = obterNumeroProcessoVelhoUnificado(codJur, pNum, reg.numeroProcessoVelho ?? '');
    const parteOpostaDisp = obterParteOpostaUnificada(codJur, pNum, reg.parteOposta ?? '');
    const descricaoDisp = obterDescricaoAcaoUnificada(codJur, pNum, reg.naturezaAcao ?? '');
    out.push({
      codCliente: codFin,
      proc: String(pNum),
      nomeCliente: reg.cliente ?? '',
      cnpjCpf: '',
      processoNovo: processoNovoDisp,
      processoVelho: processoVelhoDisp,
      autor: reg.parteCliente ?? '',
      reu: reg.parteOposta ?? parteOpostaDisp ?? '',
      tipoAcao: descricaoDisp || '',
    });
    if (out.length >= maxResults) break;
  }
  return out.sort((a, b) => Number(a.proc) - Number(b.proc));
}
