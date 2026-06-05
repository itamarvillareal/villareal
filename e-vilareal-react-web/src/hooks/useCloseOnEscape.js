import { useEffect, useRef } from 'react';

/** @type {{ onClose: () => void }[]} */
let modalStack = [];
let listenerAttached = false;

function onDocumentKeyDown(e) {
  if (e.key !== 'Escape' || modalStack.length === 0) return;
  const top = modalStack[modalStack.length - 1];
  e.preventDefault();
  e.stopPropagation();
  top.onClose?.();
}

function ensureListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  document.addEventListener('keydown', onDocumentKeyDown, true);
}

function releaseListener() {
  if (modalStack.length > 0 || !listenerAttached) return;
  document.removeEventListener('keydown', onDocumentKeyDown, true);
  listenerAttached = false;
}

/**
 * Fecha o modal ao pressionar Escape. Com vários modais abertos, fecha só o do topo (LIFO).
 * @param {boolean} active - modal visível
 * @param {() => void} [onClose]
 * @param {{ enabled?: boolean, lockScroll?: boolean }} [options]
 */
export function useCloseOnEscape(active, onClose, options = {}) {
  const { enabled = true, lockScroll = false } = options;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const entryRef = useRef(null);
  if (!entryRef.current) {
    entryRef.current = { onClose: () => onCloseRef.current?.() };
  }

  useEffect(() => {
    if (!active || !enabled) return undefined;

    ensureListener();
    modalStack.push(entryRef.current);

    let prevOverflow;
    if (lockScroll) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      modalStack = modalStack.filter((e) => e !== entryRef.current);
      releaseListener();
      if (lockScroll) {
        document.body.style.overflow = prevOverflow ?? '';
      }
    };
  }, [active, enabled, lockScroll]);
}
