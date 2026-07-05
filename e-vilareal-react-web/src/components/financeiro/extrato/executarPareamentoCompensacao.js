import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  buscarLancamentoFinanceiroApi,
  parearCompensacaoApi,
} from '../../../repositories/financeiroRepository.js';
import { mergeExtratoRowComRespostaApi } from './extratoMappers.js';

/**
 * Pareia dois lançamentos bancários e devolve as linhas atualizadas para a UI.
 */
export async function executarPareamentoCompensacao({ origem, contrapartidaRow, contaToLetra }) {
  const idA = Number(origem?.id);
  const idB = Number(contrapartidaRow?.id);
  if (!idA || !idB || idA === idB) {
    throw new Error('Selecione outro lançamento para parear.');
  }
  if (origem?.origemExtrato === 'cartao' || contrapartidaRow?.origemExtrato === 'cartao') {
    throw new Error('Pareamento só entre lançamentos bancários.');
  }

  await parearCompensacaoApi({ pares: [{ lancamentoIdA: idA, lancamentoIdB: idB }] });

  const map =
    contaToLetra ?? buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
  const [apiA, apiB] = await Promise.all([
    buscarLancamentoFinanceiroApi(idA),
    buscarLancamentoFinanceiroApi(idB),
  ]);
  if (!apiA?.id || !apiB?.id) {
    throw new Error('Par criado, mas falha ao recarregar os lançamentos.');
  }

  return {
    origemMerged: mergeExtratoRowComRespostaApi(origem, apiA, map),
    contrapartidaMerged: mergeExtratoRowComRespostaApi(contrapartidaRow, apiB, map),
  };
}
