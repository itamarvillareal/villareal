import { describe, expect, it } from 'vitest';
import {
  assinaturaAndamento,
  entradaHistoricoPertenceAoUsuarioAtivo,
  mapApiAndamentoToHistoricoItem,
} from './processosRepository.js';

describe('assinaturaAndamento', () => {
  it('iguala data local T12:00:00 com Instant da API no mesmo dia', () => {
    const daUi = { movimentoEm: '2026-04-20T12:00:00', titulo: 'JUNTEI IMPUGNAÇÃO' };
    const daApi = { movimentoEm: '2026-04-20T15:00:00.000Z', titulo: 'JUNTEI IMPUGNAÇÃO' };
    expect(assinaturaAndamento(daUi)).toBe(assinaturaAndamento(daApi));
  });

  it('aceita movimento_em e campo info (shape do histórico na UI)', () => {
    const api = { movimento_em: '2026-03-03T03:00:00.000Z', titulo: 'DECISÃO' };
    const ui = { movimentoEm: '2026-03-03T12:00:00', info: 'DECISÃO' };
    expect(assinaturaAndamento(api)).toBe(assinaturaAndamento(ui));
  });

  it('aceita movimentoEm como epoch em ms (mesmo dia que ISO)', () => {
    const iso = '2026-04-20T15:00:00.000Z';
    const ms = Date.parse(iso);
    const a = { movimentoEm: iso, titulo: 'X' };
    const b = { movimentoEm: ms, titulo: 'X' };
    expect(assinaturaAndamento(a)).toBe(assinaturaAndamento(b));
  });
});

describe('mapApiAndamentoToHistoricoItem', () => {
  it('formata data quando movimentoEm vem em milissegundos', () => {
    const ms = Date.UTC(2025, 4, 10, 12, 0, 0);
    const h = mapApiAndamentoToHistoricoItem({ id: 1, movimentoEm: ms, titulo: 'Título' }, 0, 1);
    expect(h.data).toBe('10/05/2025');
    expect(h.info).toBe('Título');
  });

  it('usa primeira linha de detalhe quando titulo vazio', () => {
    const h = mapApiAndamentoToHistoricoItem(
      { id: 2, movimentoEm: '2025-01-02T00:00:00Z', titulo: '', detalhe: 'Linha única' },
      0,
      1
    );
    expect(h.info).toBe('Linha única');
    expect(h.usuario).toBe('');
  });

  it('exibe responsável importado em detalhe quando usuarioId é null', () => {
    const h = mapApiAndamentoToHistoricoItem(
      {
        id: 3,
        movimentoEm: '2026-04-22T00:00:00Z',
        titulo: 'PUBLICOU EM 20/04',
        detalhe: 'KARLA',
        usuarioId: null,
      },
      0,
      1
    );
    expect(h.usuario).toBe('KARLA');
  });

  it('prioriza usuarioNome da API sobre detalhe', () => {
    const h = mapApiAndamentoToHistoricoItem(
      {
        id: 4,
        movimentoEm: '2026-04-22T00:00:00Z',
        titulo: 'Título',
        detalhe: 'KARLA',
        usuarioNome: 'Karla Silva',
      },
      0,
      1
    );
    expect(h.usuario).toBe('Karla Silva');
  });

  it('extrai Consultor: do detalhe com título preenchido', () => {
    const h = mapApiAndamentoToHistoricoItem(
      {
        id: 5,
        movimentoEm: '2026-01-01T00:00:00Z',
        titulo: 'Andamento',
        detalhe: 'Consultor: ANA LUISA',
      },
      0,
      1
    );
    expect(h.usuario).toBe('ANA LUISA');
  });

  it('inclui usuarioId quando a API envia', () => {
    const h = mapApiAndamentoToHistoricoItem(
      { id: 9, movimentoEm: '2026-01-01T00:00:00Z', titulo: 'X', usuarioId: 3 },
      0,
      1
    );
    expect(h.usuarioId).toBe(3);
  });
});

describe('entradaHistoricoPertenceAoUsuarioAtivo', () => {
  const usuarios = [
    { id: 1, apelido: 'ITAMAR', login: 'itamar' },
    { id: 2, apelido: 'KARLA', login: 'karla' },
  ];

  it('reconhece pelo apelido na linha', () => {
    expect(
      entradaHistoricoPertenceAoUsuarioAtivo(
        { usuario: 'ITAMAR' },
        { perfilId: 1, usuariosAtivos: usuarios, nomeAtivo: 'ITAMAR' }
      )
    ).toBe(true);
  });

  it('rejeita se a última linha é de outro usuário', () => {
    expect(
      entradaHistoricoPertenceAoUsuarioAtivo(
        { usuario: 'KARLA' },
        { perfilId: 1, usuariosAtivos: usuarios, nomeAtivo: 'ITAMAR' }
      )
    ).toBe(false);
  });

  it('reconhece por usuarioId', () => {
    expect(
      entradaHistoricoPertenceAoUsuarioAtivo(
        { usuario: '', usuarioId: 1 },
        { perfilId: 1, usuariosAtivos: usuarios, nomeAtivo: 'ITAMAR' }
      )
    ).toBe(true);
  });

  it('reconhece pelo nome da sessão API', () => {
    expect(
      entradaHistoricoPertenceAoUsuarioAtivo(
        { usuario: 'Itamar Villareal' },
        {
          perfilId: 'itamar',
          usuariosAtivos: usuarios,
          nomeAtivo: 'ITAMAR',
          apiUsuario: { id: '1', nome: 'Itamar Villareal', login: 'itamar' },
        }
      )
    ).toBe(true);
  });
});
