import { describe, expect, it } from 'vitest';
import { shouldStartFloatingDrag } from './useWhatsAppFloatingPosition.js';

function dragEvent({ closestResult, currentTarget, button = 0, pointerType = 'mouse' }) {
  const target = {
    closest: () => closestResult ?? null,
  };
  return {
    button,
    pointerType,
    target,
    currentTarget,
  };
}

describe('shouldStartFloatingDrag', () => {
  it('permite arrastar quando o handle é o próprio botão FAB', () => {
    const fab = { id: 'fab' };
    expect(shouldStartFloatingDrag(dragEvent({ closestResult: fab, currentTarget: fab }))).toBe(true);
  });

  it('bloqueia arraste ao clicar em botão filho do header', () => {
    const header = { id: 'header' };
    const closeBtn = { id: 'close' };
    expect(shouldStartFloatingDrag(dragEvent({ closestResult: closeBtn, currentTarget: header }))).toBe(false);
  });

  it('permite arrastar pelo header fora de controles', () => {
    const header = { id: 'header' };
    expect(shouldStartFloatingDrag(dragEvent({ closestResult: null, currentTarget: header }))).toBe(true);
  });

  it('ignora botão direito do mouse', () => {
    const fab = { id: 'fab' };
    expect(
      shouldStartFloatingDrag(dragEvent({ closestResult: fab, currentTarget: fab, button: 2 })),
    ).toBe(false);
  });
});
