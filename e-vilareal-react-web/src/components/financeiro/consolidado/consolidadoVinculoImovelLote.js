import { normalizarNumeroImovelFinanceiro } from '../../../data/financeiroData.js';
import { salvarOuAtualizarLancamentoFinanceiroApi } from '../../../repositories/financeiroRepository.js';
import { extratoRowToUi, mergeExtratoRowComRespostaApi } from '../extrato/extratoMappers.js';

/**
 * Aplica o mesmo nº de imóvel (planilha) aos lançamentos selecionados na conta I.
 * @returns {Promise<{ aplicados: number, mergedById: Map<number, object>, erros: string[] }>}
 */
export async function vincularNumeroImovelLancamentosEmLote(rows, numeroPlanilha, opts = {}) {
  const np = normalizarNumeroImovelFinanceiro(numeroPlanilha);
  if (!np) {
    throw new Error('Informe um nº de imóvel válido (planilha).');
  }
  const lista = Array.isArray(rows) ? rows.filter((r) => r?.id != null) : [];
  if (!lista.length) {
    return { aplicados: 0, mergedById: new Map(), erros: [] };
  }

  const contaToLetra = opts.contaToLetra ?? {};
  const contaContabilId = opts.contaContabilId ?? null;
  const contaContabilNome = opts.contaContabilNome ?? 'Conta Imóveis';
  const concorrencia = Math.min(8, Math.max(1, lista.length));
  const mergedById = new Map();
  const erros = [];
  let aplicados = 0;
  let indice = 0;

  async function salvarUm(row) {
    const next = {
      ...row,
      contaCodigo: 'I',
      contaContabilId: contaContabilId ?? row.contaContabilId,
      contaContabilNome,
      numeroImovel: np,
      grupoCompensacao: np,
      codCliente: '',
      proc: '',
      clienteId: null,
      pessoaRefId: null,
      processoId: null,
    };
    try {
      const saved = await salvarOuAtualizarLancamentoFinanceiroApi(extratoRowToUi(next));
      if (!saved?.id) {
        return { ok: false, erro: `Lançamento ${row.id}: falha ao gravar.` };
      }
      const merged = mergeExtratoRowComRespostaApi(next, saved, contaToLetra);
      return { ok: true, id: Number(merged.id), merged };
    } catch (e) {
      return { ok: false, erro: `Lançamento ${row.id}: ${e?.message || 'erro ao gravar'}` };
    }
  }

  async function worker() {
    while (indice < lista.length) {
      const i = indice;
      indice += 1;
      const res = await salvarUm(lista[i]);
      if (res.ok) {
        aplicados += 1;
        mergedById.set(res.id, res.merged);
      } else if (res.erro) {
        erros.push(res.erro);
      }
    }
  }

  await Promise.all(Array.from({ length: concorrencia }, () => worker()));
  return { aplicados, mergedById, erros };
}
