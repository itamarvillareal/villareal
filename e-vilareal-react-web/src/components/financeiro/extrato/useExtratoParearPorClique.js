import { useCallback, useState } from 'react';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import { extratoRowKey } from '../total/totalFinanceiroMerge.js';
import { executarPareamentoCompensacao } from './executarPareamentoCompensacao.js';

export function useExtratoParearPorClique({ detailItem, setDetailItem, onPareadoRows }) {
  const toast = useFinanceiroToast();
  const [modoParear, setModoParear] = useState(null);
  const [pareando, setPareando] = useState(false);

  const handleModoParearChange = useCallback((info) => {
    setModoParear(info?.active ? info : null);
  }, []);

  const handleRowClick = useCallback(
    async (item, openDetail) => {
      if (!modoParear?.active || pareando || !detailItem) {
        openDetail(item);
        return;
      }

      const origemKey = detailItem._rowKey ?? extratoRowKey(detailItem);
      const clickKey = item._rowKey ?? extratoRowKey(item);
      if (origemKey === clickKey) return;

      if (item.origemExtrato === 'cartao') {
        toast.warn('Pareamento só entre lançamentos bancários.');
        return;
      }

      setPareando(true);
      try {
        const { origemMerged, contrapartidaMerged } = await executarPareamentoCompensacao({
          origem: detailItem,
          contrapartidaRow: item,
        });
        dispatchRefreshPendentes();
        onPareadoRows?.(origemMerged, contrapartidaMerged);
        setDetailItem(origemMerged);
        toast.success('Lançamentos pareados com sucesso.');
      } catch (e) {
        toast.error(e?.message || 'Falha ao parear lançamentos.');
      } finally {
        setPareando(false);
      }
    },
    [modoParear, pareando, detailItem, setDetailItem, onPareadoRows, toast],
  );

  const modoParearOrigemKey = detailItem ? detailItem._rowKey ?? extratoRowKey(detailItem) : null;

  return {
    modoParearAtivo: Boolean(modoParear?.active),
    modoParearOrigemKey,
    pareando,
    handleModoParearChange,
    handleRowClick,
  };
}
