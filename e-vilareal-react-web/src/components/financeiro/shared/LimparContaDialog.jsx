import { useState } from 'react';
import { useFinanceiroChrome } from '../FinanceiroContext.jsx';
import {
  limparCartaoFinanceiro,
  limparContaCorrenteFinanceiro,
} from '../extrato/limparContaFinanceiro.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { useFinanceiroToast } from './Toast.jsx';

/**
 * @param {{
 *   open: boolean,
 *   tipo: 'banco' | 'cartao',
 *   nome: string,
 *   numero?: number | null,
 *   onClose: () => void,
 *   onSuccess?: (result: { removidos: number, desvinculados?: number }) => void,
 * }} props
 */
export function LimparContaDialog({ open, tipo, nome, numero, onClose, onSuccess }) {
  const toast = useFinanceiroToast();
  const { refreshBancos } = useFinanceiroChrome();
  const [busy, setBusy] = useState(false);

  const titulo =
    tipo === 'cartao' ? `Limpar cartão «${nome}»` : `Limpar conta corrente «${nome}»`;
  const message =
    tipo === 'cartao'
      ? 'Remove todos os lançamentos deste cartão no servidor. Esta ação não pode ser desfeita.'
      : 'Remove todos os lançamentos desta conta corrente no servidor e na cópia local legada. Esta ação não pode ser desfeita.';

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result =
        tipo === 'cartao'
          ? await limparCartaoFinanceiro({ nomeCartao: nome, numeroCartao: numero })
          : await limparContaCorrenteFinanceiro({ nomeBanco: nome, numeroBanco: numero });

      const removidos = Number(result?.removidos) || 0;
      const extra =
        removidos > 0
          ? ` ${removidos.toLocaleString('pt-BR')} lançamento(s) removido(s).`
          : ' Nenhum lançamento encontrado nesta conta.';

      toast.success(`Conta limpa.${extra} Pode importar de novo do zero.`);
      refreshBancos?.();
      onSuccess?.(result);
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Falha ao limpar a conta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={titulo}
      message={message}
      confirmLabel={busy ? 'A limpar…' : 'Limpar tudo'}
      onConfirm={handleConfirm}
      onCancel={onClose}
      danger
    />
  );
}
