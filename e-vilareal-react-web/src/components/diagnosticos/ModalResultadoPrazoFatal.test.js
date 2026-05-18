import { describe, expect, it } from 'vitest';
import { formatarNumeroCnjExibicao } from './ModalResultadoPrazoFatal.jsx';

describe('formatarNumeroCnjExibicao', () => {
  it('formata 20 dígitos no padrão CNJ', () => {
    expect(formatarNumeroCnjExibicao('55904468620258090006')).toBe('5590446-86.2025.8.09.0006');
  });

  it('mantém valor já formatado', () => {
    const cnj = '5590446-86.2025.8.09.0006';
    expect(formatarNumeroCnjExibicao(cnj)).toBe(cnj);
  });
});
