import { describe, expect, it } from 'vitest';
import { aplicarFormatoHtmlEditor } from './HtmlEditor.jsx';

describe('aplicarFormatoHtmlEditor', () => {
  it('retorna HTML vazio quando editor é nulo', () => {
    expect(aplicarFormatoHtmlEditor(null, 'negrito')).toBe('');
  });
});
