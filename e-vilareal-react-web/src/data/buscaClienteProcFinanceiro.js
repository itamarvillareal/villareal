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
    const docClienteNorm = '';

    const processoNovoDisp = obterNumeroProcessoNovoUnificado(codJur, pNum, reg.numeroProcessoNovo ?? '');
    const processoVelhoDisp = obterNumeroProcessoVelhoUnificado(codJur, pNum, reg.numeroProcessoVelho ?? '');
    const parteOpostaDisp = obterParteOpostaUnificada(codJur, pNum, reg.parteOposta ?? '');
    const descricaoDisp = obterDescricaoAcaoUnificada(codJur, pNum, reg.naturezaAcao ?? '');

    const numeroNovo = normalizarNumeroBusca(processoNovoDisp);
    const numeroVelho = normalizarNumeroBusca(processoVelhoDisp);

    const numeroMatch = (() => {
      if (!termoNumero) return false;
      if (buscaProcCurta) return procNumeroStr.includes(termoNumero);
      return digitosCorrespondem(numeroNovo, termoNumero) || digitosCorrespondem(numeroVelho, termoNumero);
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
