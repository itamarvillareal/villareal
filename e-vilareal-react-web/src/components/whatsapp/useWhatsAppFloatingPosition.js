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

function getViewportBounds() {
  if (typeof window === 'undefined') {
    return { w: 0, h: 0, top: 0, left: 0 };
  }
  const vv = window.visualViewport;
  return {
    w: vv?.width ?? window.innerWidth,
    h: vv?.height ?? window.innerHeight,
    top: vv?.offsetTop ?? 0,
    left: vv?.offsetLeft ?? 0,
  };
}

function defaultFabPosition() {
  const { w, h, top, left } = getViewportBounds();
  const margin = 24;
  const bottomInset = typeof window !== 'undefined' && window.innerWidth <= 640 ? 16 : 0;
  return clampFabPosition(
    left + w - WHATSAPP_FAB_SIZE - margin,
    top + h - WHATSAPP_FAB_SIZE - margin - bottomInset,
  );
}

export function clampFabPosition(x, y) {
  const { w, h, top, left } = getViewportBounds();
  const minX = left + VIEWPORT_MARGIN;
  const minY = top + VIEWPORT_MARGIN;
  const maxX = left + Math.max(VIEWPORT_MARGIN, w - WHATSAPP_FAB_SIZE - VIEWPORT_MARGIN);
  const maxY = top + Math.max(VIEWPORT_MARGIN, h - WHATSAPP_FAB_SIZE - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(minX, x), maxX),
    y: Math.min(Math.max(minY, y), maxY),
  };
}

export function panelPosFromFab(fabX, fabY) {
  const { w, h, top, left } = getViewportBounds();
  const x = fabX + WHATSAPP_FAB_SIZE - WHATSAPP_PANEL_W;
  const y = fabY + WHATSAPP_FAB_SIZE - WHATSAPP_PANEL_H;
  const minX = left + VIEWPORT_MARGIN;
  const minY = top + VIEWPORT_MARGIN;
  const maxX = left + Math.max(VIEWPORT_MARGIN, w - WHATSAPP_PANEL_W - VIEWPORT_MARGIN);
  const maxY = top + Math.max(VIEWPORT_MARGIN, h - WHATSAPP_PANEL_H - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(minX, x), maxX),
    y: Math.min(Math.max(minY, y), maxY),
  };
}

function clampPanelPosition(x, y) {
  const { w, h, top, left } = getViewportBounds();
  const minX = left + VIEWPORT_MARGIN;
  const minY = top + VIEWPORT_MARGIN;
  const maxX = left + Math.max(VIEWPORT_MARGIN, w - WHATSAPP_PANEL_W - VIEWPORT_MARGIN);
  const maxY = top + Math.max(VIEWPORT_MARGIN, h - WHATSAPP_PANEL_H - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(minX, x), maxX),
    y: Math.min(Math.max(minY, y), maxY),
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

  const resolvedFab = useMemo(
    () => clampFabPosition((fabPos ?? defaultFabPosition()).x, (fabPos ?? defaultFabPosition()).y),
    [fabPos],
  );

  const containerStyle = useMemo(() => {
    if (isMobile && isOpen) return undefined;
    const pos = isOpen ? panelPosFromFab(resolvedFab.x, resolvedFab.y) : resolvedFab;
    return { left: `${pos.x}px`, top: `${pos.y}px` };
  }, [isMobile, resolvedFab, isOpen]);

  useEffect(() => {
    const onResize = () => {
      setFabPos((prev) => clampFabPosition((prev ?? defaultFabPosition()).x, (prev ?? defaultFabPosition()).y));
    };
    window.addEventListener('resize', onResize);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onResize);
    vv?.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      vv?.removeEventListener('resize', onResize);
      vv?.removeEventListener('scroll', onResize);
    };
  }, []);

  const resetPosition = useCallback(() => {
    persistFabPosition(null);
    setFabPos(null);
  }, []);

  const startDrag = useCallback(
    (e) => {
      if (isMobile && isOpen) return;
      if (!shouldStartFloatingDrag(e)) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const origin = resolvedFab;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originFabX: origin.x,
        originFabY: origin.y,
        moved: false,
      };
    },
    [isMobile, isOpen, resolvedFab],
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

  const dragHandleProps = useMemo(() => {
    if (isMobile && isOpen) return {};
    return {
      onPointerDown: startDrag,
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      className: 'touch-none select-none cursor-grab active:cursor-grabbing',
      title: isOpen
        ? 'Arraste para mover o painel'
        : 'Arraste para mover · Toque para abrir · Duplo toque restaura posição',
    };
  }, [isMobile, isOpen, startDrag, moveDrag, endDrag]);

  return {
    containerStyle,
    containerClassName: isMobile && isOpen ? 'inset-0' : '',
    dragHandleProps,
    resetPosition,
    isMobile,
  };
}
