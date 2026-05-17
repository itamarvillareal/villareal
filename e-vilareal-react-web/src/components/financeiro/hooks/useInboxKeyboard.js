import { useEffect, useMemo } from 'react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.js';

/**
 * Atalhos específicos da Inbox (navegação entre cards, aprovar, pular).
 */
export function useInboxKeyboard({
  tipo,
  enabled,
  focusedIndex,
  setFocusedIndex,
  itemCount,
  onAprovarFocado,
  onPularFocado,
  onToggleSelecaoFocado,
  onAprovarTodos,
}) {
  const shortcuts = useMemo(
    () => [
      {
        key: 'ArrowDown',
        handler: () => {
          setFocusedIndex((i) => Math.min(itemCount - 1, (i < 0 ? -1 : i) + 1));
        },
      },
      {
        key: 'ArrowUp',
        handler: () => {
          setFocusedIndex((i) => Math.max(0, (i < 0 ? 0 : i) - 1));
        },
      },
      {
        key: 'Enter',
        ctrl: true,
        handler: () => onAprovarTodos(),
      },
      {
        key: 'Enter',
        handler: () => onAprovarFocado(),
      },
      {
        key: 'Backspace',
        handler: () => onPularFocado(),
      },
      {
        key: ' ',
        handler: (e) => {
          e.preventDefault();
          onToggleSelecaoFocado();
        },
      },
    ],
    [itemCount, onAprovarFocado, onPularFocado, onToggleSelecaoFocado, onAprovarTodos, setFocusedIndex],
  );

  useKeyboardShortcuts(shortcuts, enabled && itemCount > 0);

  useEffect(() => {
    if (itemCount === 0) {
      setFocusedIndex(-1);
      return;
    }
    setFocusedIndex((i) => {
      if (i < 0) return 0;
      if (i >= itemCount) return itemCount - 1;
      return i;
    });
  }, [tipo, itemCount, setFocusedIndex]);

}

export function scrollInboxCardIntoView(index) {
  if (index < 0) return;
  const el = document.querySelector(`[data-inbox-card-index="${index}"]`);
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
