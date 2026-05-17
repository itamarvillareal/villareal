import { useEffect, useRef } from 'react';

/**
 * @typedef {object} KeyboardShortcut
 * @property {string} key - Tecla (ex.: 'i', '/', 'Escape', 'ArrowUp')
 * @property {boolean} [ctrl] - Ctrl ou Cmd (meta)
 * @property {boolean} [alt]
 * @property {boolean} [shift]
 * @property {boolean} [preventDefault=true]
 * @property {() => void} handler
 */

export function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

function matchShortcut(event, spec) {
  const expected = String(spec.key ?? '').toLowerCase();
  const pressed = String(event.key ?? '').toLowerCase();
  if (expected && pressed !== expected) return false;

  const wantsCtrl = Boolean(spec.ctrl);
  const wantsAlt = Boolean(spec.alt);
  const wantsShift = Boolean(spec.shift);
  const mod = event.metaKey || event.ctrlKey;

  if (wantsCtrl && !mod) return false;
  if (wantsAlt && !event.altKey) return false;
  if (wantsShift && !event.shiftKey) return false;

  if (!wantsCtrl && mod && !wantsAlt) return false;
  if (!wantsAlt && event.altKey && !wantsCtrl) return false;
  if (!wantsShift && event.shiftKey && pressed.length > 1) return false;

  return true;
}

/**
 * Registra atalhos globais de teclado. Ignora eventos quando o foco está em campo editável.
 * @param {KeyboardShortcut[]} shortcuts
 * @param {boolean} [enabled=true]
 */
export function useKeyboardShortcuts(shortcuts, enabled = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;

      for (const spec of shortcutsRef.current) {
        if (!matchShortcut(event, spec)) continue;
        if (spec.preventDefault !== false) event.preventDefault();
        spec.handler(event);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/** Foca o campo de busca do extrato, se existir na página. */
export function focusFinanceiroBusca() {
  const el = document.getElementById('financeiro-campo-busca');
  if (el && typeof el.focus === 'function') {
    el.focus();
    return true;
  }
  return false;
}

/** Fecha painel de detalhe ou dispara limpeza de seleção. */
export function handleFinanceiroEscape() {
  const fechar = document.querySelector('[data-financeiro-fechar-detalhe]');
  if (fechar) {
    fechar.click();
    return;
  }
  window.dispatchEvent(new CustomEvent('financeiro:limpar-selecao'));
}

export const FINANCEIRO_REFRESH_PENDENTES = 'financeiro:refresh-pendentes';

export function dispatchRefreshPendentes() {
  window.dispatchEvent(new CustomEvent(FINANCEIRO_REFRESH_PENDENTES));
}
