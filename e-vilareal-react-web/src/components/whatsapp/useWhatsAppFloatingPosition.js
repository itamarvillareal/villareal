import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'vilareal:whatsapp-floating-pos';
export const WHATSAPP_FAB_SIZE = 56;
export const WHATSAPP_PANEL_W = 380;
export const WHATSAPP_PANEL_H = 500;
const VIEWPORT_MARGIN = 8;
const DRAG_THRESHOLD = 6;

/** Permite arrastar o handle (ex.: FAB `<button>`); ignora cliques em controles filhos. */
export function shouldStartFloatingDrag(event) {
  if (event.button !== 0 && event.pointerType === 'mouse') return false;
  const block = event.target.closest?.('button, a, input, textarea, select');
  if (block && block !== event.currentTarget) return false;
  return true;
}

function readStoredFabPosition() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function defaultFabPosition() {
  return {
    x: window.innerWidth - WHATSAPP_FAB_SIZE - 24,
    y: window.innerHeight - WHATSAPP_FAB_SIZE - 24,
  };
}

export function clampFabPosition(x, y) {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - WHATSAPP_FAB_SIZE - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - WHATSAPP_FAB_SIZE - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, y), maxY),
  };
}

export function panelPosFromFab(fabX, fabY) {
  const x = fabX + WHATSAPP_FAB_SIZE - WHATSAPP_PANEL_W;
  const y = fabY + WHATSAPP_FAB_SIZE - WHATSAPP_PANEL_H;
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - WHATSAPP_PANEL_W - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - WHATSAPP_PANEL_H - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, y), maxY),
  };
}

function clampPanelPosition(x, y) {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - WHATSAPP_PANEL_W - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - WHATSAPP_PANEL_H - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, y), maxY),
  };
}

function fabPosFromPanel(panelX, panelY) {
  return clampFabPosition(
    panelX + WHATSAPP_PANEL_W - WHATSAPP_FAB_SIZE,
    panelY + WHATSAPP_PANEL_H - WHATSAPP_FAB_SIZE,
  );
}

function persistFabPosition(fabPos) {
  try {
    if (!fabPos) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fabPos));
  } catch {
    /* ignore */
  }
}

/**
 * Posição arrastável do botão/painel flutuante do WhatsApp (persiste no localStorage).
 * @param {{ isOpen: boolean, isMobile: boolean, onTap: () => void }} opts
 */
export function useWhatsAppFloatingPosition({ isOpen, isMobile, onTap }) {
  const [fabPos, setFabPos] = useState(() => readStoredFabPosition());
  const dragRef = useRef(null);

  const resolvedFab = useMemo(() => {
    if (isMobile) return null;
    return clampFabPosition((fabPos ?? defaultFabPosition()).x, (fabPos ?? defaultFabPosition()).y);
  }, [fabPos, isMobile]);

  const containerStyle = useMemo(() => {
    if (isMobile || !resolvedFab) return undefined;
    const pos = isOpen ? panelPosFromFab(resolvedFab.x, resolvedFab.y) : resolvedFab;
    return { left: `${pos.x}px`, top: `${pos.y}px` };
  }, [isMobile, resolvedFab, isOpen]);

  useEffect(() => {
    if (isMobile) return undefined;
    const onResize = () => {
      setFabPos((prev) => clampFabPosition((prev ?? defaultFabPosition()).x, (prev ?? defaultFabPosition()).y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMobile]);

  const resetPosition = useCallback(() => {
    persistFabPosition(null);
    setFabPos(null);
  }, []);

  const startDrag = useCallback(
    (e) => {
      if (isMobile) return;
      if (!shouldStartFloatingDrag(e)) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const origin = resolvedFab ?? defaultFabPosition();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originFabX: origin.x,
        originFabY: origin.y,
        moved: false,
      };
    },
    [isMobile, resolvedFab],
  );

  const moveDrag = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;

      if (isOpen) {
        const originPanel = panelPosFromFab(drag.originFabX, drag.originFabY);
        const panel = clampPanelPosition(originPanel.x + dx, originPanel.y + dy);
        setFabPos(fabPosFromPanel(panel.x, panel.y));
        return;
      }

      setFabPos(clampFabPosition(drag.originFabX + dx, drag.originFabY + dy));
    },
    [isOpen],
  );

  const endDrag = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);

      if (drag.moved) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        let next;
        if (isOpen) {
          const originPanel = panelPosFromFab(drag.originFabX, drag.originFabY);
          const panel = clampPanelPosition(originPanel.x + dx, originPanel.y + dy);
          next = fabPosFromPanel(panel.x, panel.y);
        } else {
          next = clampFabPosition(drag.originFabX + dx, drag.originFabY + dy);
        }
        setFabPos(next);
        persistFabPosition(next);
        return;
      }

      if (!isOpen) {
        onTap?.();
      }
    },
    [isOpen, onTap],
  );

  const dragHandleProps = useMemo(
    () =>
      isMobile
        ? {}
        : {
            onPointerDown: startDrag,
            onPointerMove: moveDrag,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            className: 'touch-none select-none cursor-grab active:cursor-grabbing',
            title: isOpen
              ? 'Arraste para mover o painel'
              : 'Arraste para mover · Clique para abrir · Duplo clique restaura posição',
          },
    [isMobile, startDrag, moveDrag, endDrag, isOpen],
  );

  return {
    containerStyle,
    containerClassName: isMobile ? 'bottom-0 right-0' : '',
    dragHandleProps,
    resetPosition,
    isMobile,
  };
}
