import { featureFlags } from '../config/featureFlags.js';
import { getTransacoesContaCorrenteCompleto } from './financeiroData.js';
import { linhaRelatorioResultadoProcesso } from './contaCorrenteProcessoResultado.js';
import { obterLinhasBaseRelatorioProcessos } from './relatorioProcessosDados.js';
import { listarLancamentosProcessoApiFirst } from '../repositories/financeiroRepository.js';

const FETCH_CONCURRENCY = 8;

async function transacoesContaCorrenteProcesso(codCliente, proc, processoApiId) {
  if (featureFlags.useApiFinanceiro && Number(processoApiId) > 0) {
    try {
      return await listarLancamentosProcessoApiFirst({
        processoId: Number(processoApiId),
        codigoCliente: codCliente,
        numeroInterno: proc,
      });
    } catch {
      /* fallback local */
    }
  }
  return getTransacoesContaCorrenteCompleto(codCliente, proc);
}

/**
 * @param {{ apenasComLancamentos?: boolean, apenasComLucro?: boolean }} [opts]
 */
export async function carregarRelatorioResultadoProcessos(opts = {}) {
  const { apenasComLancamentos = false, apenasComLucro = false } = opts;
  const base = await obterLinhasBaseRelatorioProcessos();
  if (!base.length) {
    return { ok: true, linhas: [], motivo: 'Sem processos na API.' };
  }

  const linhas = [];
  for (let i = 0; i < base.length; i += FETCH_CONCURRENCY) {
    const chunk = base.slice(i, i + FETCH_CONCURRENCY);
    const partial = await Promise.all(
      chunk.map(async (row) => {
        const transacoes = await transacoesContaCorrenteProcesso(
          row.codCliente,
          row.proc,
          row.processoApiId,
        );
        return linhaRelatorioResultadoProcesso({
          codCliente: row.codCliente,
          proc: row.proc,
          cliente: row.cliente,
          processoApiId: row.processoApiId,
          transacoes,
        });
      }),
    );
    linhas.push(...partial);
  }

  let filtradas = linhas;
  if (apenasComLancamentos) {
    filtradas = filtradas.filter((l) => l.qtdLancamentos > 0);
  }
  if (apenasComLucro) {
    filtradas = filtradas.filter((l) => Math.abs(l.lucroProcesso) > 0.009);
  }

  filtradas.sort((a, b) => {
    const c = String(a.codCliente).localeCompare(String(b.codCliente));
    if (c !== 0) return c;
    return Number(a.proc) - Number(b.proc);
  });

  return { ok: true, linhas: filtradas, ultimaCarga: Date.now() };
}
