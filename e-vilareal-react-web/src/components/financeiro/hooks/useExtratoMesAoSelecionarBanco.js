import { useEffect, useRef } from 'react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  listarLancamentosFinanceiroPaginados,
  obterSaldoBancoFinanceiro,
} from '../../../repositories/financeiroRepository.js';
import { mesAnoFromDataLancamento } from '../extrato/extratoMesUtils.js';

/**
 * Ao selecionar um banco, se o mês já definido na URL não tiver lançamentos,
 * ajusta o período para o mês do último lançamento importado naquele banco.
 * Não reage a mudanças manuais de período (só quando `bancoAtivo` muda).
 */
export function useExtratoMesAoSelecionarBanco(bancoAtivo, mesAtual, setMes) {
  const mesRef = useRef(mesAtual);

  useEffect(() => {
    mesRef.current = mesAtual;
  }, [bancoAtivo, mesAtual]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || bancoAtivo == null) return undefined;

    const mes = mesRef.current;
    if (!mes) return undefined;
    const [ano, mesNum] = mes.split('-');
    if (!ano || !mesNum) return undefined;

    const ac = new AbortController();
    (async () => {
      try {
        const res = await listarLancamentosFinanceiroPaginados(
          { numeroBanco: bancoAtivo, ano, mes: mesNum, page: 0, size: 1 },
          { signal: ac.signal },
        );
        if ((Number(res?.totalElements) || 0) > 0) return;

        const saldo = await obterSaldoBancoFinanceiro(bancoAtivo, { signal: ac.signal });
        const ultimoMes = mesAnoFromDataLancamento(saldo?.dataUltimoLancamento);
        if (ultimoMes && ultimoMes !== mes) setMes(ultimoMes);
      } catch (e) {
        if (e?.name !== 'AbortError') {
          /* mantém período atual se a API falhar */
        }
      }
    })();

    return () => ac.abort();
  }, [bancoAtivo, setMes]);
}
