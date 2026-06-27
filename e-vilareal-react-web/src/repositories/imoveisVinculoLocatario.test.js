import { describe, expect, it } from 'vitest';
import {
  extrairExtrasVinculoLocatarioJsonDoUi,
  mesclarExtrasVinculoLocatarioNoItem,
  removerExtrasVinculoLocatarioDoObjeto,
  usuarioAlterouVinculoProcessoNoFormulario,
} from './imoveisVinculoLocatario.js';

describe('imoveisVinculoLocatario', () => {
  it('detecta alteração de cod+proc no formulário', () => {
    expect(
      usuarioAlterouVinculoProcessoNoFormulario({
        codigo: '00000793',
        proc: '50',
        _vinculoCodigoOriginal: '00000793',
        _vinculoProcOriginal: '42',
      }),
    ).toBe(true);
  });

  it('remove campos de locatário do extras do imóvel', () => {
    const out = removerExtrasVinculoLocatarioDoObjeto({
      codigo: '00000793',
      proc: '42',
      inquilino: 'Carlos',
      aguaNumero: '123',
    });
    expect(out.inquilino).toBeUndefined();
    expect(out.aguaNumero).toBe('123');
  });

  it('extrai e mescla snapshot por vínculo', () => {
    const json = extrairExtrasVinculoLocatarioJsonDoUi({
      observacoesInquilino: 'Obs teste',
      inquilino: 'Maria',
      inquilinoNumeroPessoa: '99',
      inquilinos: [{ pessoaId: '99', nome: 'Maria' }],
    });
    expect(JSON.parse(json).inquilino).toBe('Maria');

    const merged = mesclarExtrasVinculoLocatarioNoItem(
      { valorLocacao: '1700' },
      JSON.parse(json),
      (e) => e,
    );
    expect(merged.inquilino).toBe('Maria');
    expect(merged.valorLocacao).toBe('1700');
  });
});
