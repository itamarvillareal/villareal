import { useCallback, useMemo, useState } from 'react';
import { podeEncaminharMensagem } from '../utils/whatsappForwardEligibility.js';

/**
 * @param {object[]} messages Mensagens visíveis na conversa (ordem do feed).
 */
export function useWhatsAppForwardSelection(messages) {
  const [active, setActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const startSelection = useCallback((message) => {
    if (!podeEncaminharMensagem(message)) return;
    setActive(true);
    setSelectedIds(new Set([message.id]));
  }, []);

  const toggleMessage = useCallback((message) => {
    if (!podeEncaminharMensagem(message)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(message.id)) next.delete(message.id);
      else next.add(message.id);
      return next;
    });
  }, []);

  const cancelSelection = useCallback(() => {
    setActive(false);
    setSelectedIds(new Set());
    setModalOpen(false);
  }, []);

  const openModal = useCallback(() => {
    if (selectedIds.size === 0) return;
    setModalOpen(true);
  }, [selectedIds.size]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const finishSuccess = useCallback(() => {
    setModalOpen(false);
    setActive(false);
    setSelectedIds(new Set());
  }, []);

  const selectedMessages = useMemo(() => {
    if (!active || selectedIds.size === 0) return [];
    return (Array.isArray(messages) ? messages : [])
      .filter((m) => m?.id != null && selectedIds.has(m.id))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, selectedIds, active]);

  const isSelected = useCallback(
    (message) => message?.id != null && selectedIds.has(message.id),
    [selectedIds],
  );

  return {
    forwardSelectActive: active,
    forwardSelectedIds: selectedIds,
    forwardSelectedMessages: selectedMessages,
    forwardModalOpen: modalOpen,
    startForwardSelection: startSelection,
    toggleForwardSelection: toggleMessage,
    cancelForwardSelection: cancelSelection,
    openForwardModal: openModal,
    closeForwardModal: closeModal,
    finishForwardSuccess: finishSuccess,
    isForwardSelected: isSelected,
    forwardSelectionCount: selectedIds.size,
  };
}
