/**
 * Busca cod. cliente + proc. a partir de nome do cliente, CPF/CNPJ, autor, réu ou nº de processo —
 * alinhado ao Cadastro de Clientes / Processos, incluindo `vilareal:processos-historico:v1` (nº CNJ gravado).
 */

import {
  gerarMockClienteEProcessos,
  normalizarTextoBusca,
  normalizarNumeroBusca,
} from '../components/CadastroClientes.jsx';
import { normalizarCodigoClienteFinanceiro } from './financeiroData';
import {
  obterDescricaoAcaoUnificada,
  obterNumeroProcessoNovoUnificado,
  obterNumeroProcessoVelhoUnificado,
  obterParteOpostaUnificada,
} from './processosHistoricoData.js';

const MAX_COD_CLIENTE = 1000;

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

  for (let cod = 1; cod <= MAX_COD_CLIENTE; cod++) {
    const mock = gerarMockClienteEProcessos(String(cod));
    if (!mock) continue;

    const codJur = String(mock.codigoCliente ?? '').trim();
    const nomeClienteNorm = normalizarTextoBusca(mock.nomeRazao ?? '');
    const docClienteNorm = normalizarNumeroBusca(mock.cnpjCpf ?? '');

    for (const proc of mock.processos || []) {
      const procNumeroStr = String(proc.procNumero ?? '');
      const pNum = Number(proc.procNumero);
      if (!Number.isFinite(pNum) || pNum < 1) continue;

      const processoNovoDisp = obterNumeroProcessoNovoUnificado(codJur, pNum, proc.processoNovo ?? '');
      const processoVelhoDisp = obterNumeroProcessoVelhoUnificado(codJur, pNum, proc.processoVelho ?? '');
      const parteOpostaDisp = obterParteOpostaUnificada(codJur, pNum, proc.parteOposta ?? '');
      const descricaoDisp = obterDescricaoAcaoUnificada(codJur, pNum, proc.descricao ?? proc.tipoAcao ?? '');

      const numeroNovo = normalizarNumeroBusca(processoNovoDisp);
      const numeroVelho = normalizarNumeroBusca(processoVelhoDisp);

      const numeroMatch = (() => {
        if (!termoNumero) return false;
        if (buscaProcCurta) return procNumeroStr.includes(termoNumero);
        return digitosCorrespondem(numeroNovo, termoNumero) || digitosCorrespondem(numeroVelho, termoNumero);
      })();

      const autorStr = normalizarTextoBusca(proc.autor ?? '');
      const reuStr = normalizarTextoBusca(proc.reu ?? parteOpostaDisp ?? '');
      const tipoAcaoStr = normalizarTextoBusca(proc.tipoAcao ?? descricaoDisp ?? '');
      const descStr = normalizarTextoBusca(descricaoDisp ?? '');
      const parteOpostaNorm = normalizarTextoBusca(parteOpostaDisp ?? '');

      const stripped = String(mock.codigoCliente ?? '').replace(/^0+/, '');
      const codClienteNum = Number(stripped) || cod;
      const codFin = normalizarCodigoClienteFinanceiro(codClienteNum);
      if (!codFin) continue;

      const clienteMatch =
        (termo && nomeClienteNorm.includes(termo)) ||
        (termoNumero.length >= 3 && docClienteNorm.includes(termoNumero));

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
        nomeCliente: mock.nomeRazao ?? '',
        cnpjCpf: mock.cnpjCpf ?? '',
        processoNovo: processoNovoDisp,
        autor: proc.autor ?? '',
        reu: proc.reu ?? parteOpostaDisp ?? '',
        tipoAcao: descricaoDisp || proc.tipoAcao || proc.descricao || '',
      });

      if (out.length >= maxResults) return out;
    }
  }

  return out;
}
