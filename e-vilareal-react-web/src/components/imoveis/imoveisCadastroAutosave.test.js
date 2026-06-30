import { describe, expect, it } from 'vitest';
import { buildSnapshotImovelCadastro } from './imoveisCadastroAutosave.js';

describe('buildSnapshotImovelCadastro', () => {
  it('detecta alteração no link de vistoria', () => {
    const base = buildSnapshotImovelCadastro({ linkVistoria: 'https://a.com' });
    const alt = buildSnapshotImovelCadastro({ linkVistoria: 'https://b.com' });
    expect(base).not.toBe(alt);
  });

  it('ignora ordem estável de arrays simples', () => {
    const a = buildSnapshotImovelCadastro({ inquilinos: [{ pessoaId: '1' }] });
    const b = buildSnapshotImovelCadastro({ inquilinos: [{ pessoaId: '1' }] });
    expect(a).toBe(b);
  });
});
