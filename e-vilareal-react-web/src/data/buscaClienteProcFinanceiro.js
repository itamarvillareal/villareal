/**
 * Busca cod. cliente + proc. a partir de nome do cliente, CPF/CNPJ, autor, réu ou nº de processo —
 * mesma lógica conceitual do filtro de processos no Cadastro de Clientes, para uso no Financeiro.
 */

import {
  gerarMockClienteEProcessos,
  normalizarTextoBusca,
  normalizarNumeroBusca,
} from '../components/CadastroClientes.jsx';
import { normalizarCodigoClienteFinanceiro } from './financeiroData';

const MAX_COD_CLIENTE = 1000;

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

    const nomeClienteNorm = normalizarTextoBusca(mock.nomeRazao ?? '');
    const docClienteNorm = normalizarNumeroBusca(mock.cnpjCpf ?? '');

    for (const proc of mock.processos || []) {
      const procNumeroStr = String(proc.procNumero ?? '');
      const numeroNovo = normalizarNumeroBusca(proc.processoNovo ?? '');

      const numeroMatch = (() => {
        if (!termoNumero) return false;
        if (buscaProcCurta) return procNumeroStr.includes(termoNumero);
        return numeroNovo.includes(termoNumero);
      })();

      const autorStr = normalizarTextoBusca(proc.autor ?? '');
      const reuStr = normalizarTextoBusca(proc.reu ?? proc.parteOposta ?? '');
      const tipoAcaoStr = normalizarTextoBusca(proc.tipoAcao ?? proc.descricao ?? '');

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
            normalizarTextoBusca(proc.parteOposta ?? '').includes(termo) ||
            normalizarTextoBusca(proc.descricao ?? '').includes(termo)));

      if (!(clienteMatch || procMatch)) continue;

      out.push({
        codCliente: codFin,
        proc: String(proc.procNumero ?? ''),
        nomeCliente: mock.nomeRazao ?? '',
        cnpjCpf: mock.cnpjCpf ?? '',
        processoNovo: proc.processoNovo ?? '',
        autor: proc.autor ?? '',
        reu: proc.reu ?? proc.parteOposta ?? '',
        tipoAcao: proc.tipoAcao ?? proc.descricao ?? '',
      });

      if (out.length >= maxResults) return out;
    }
  }

  return out;
}
