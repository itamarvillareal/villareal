import { describe, it, expect } from 'vitest';
import {
  extrairCnjPreferencialDoBloco,
  normalizarCnjParaChave,
  normalizarDataBrCompleta,
  hashTeorNormalizado,
  chaveDeduplicacao,
  deduplicarParseados,
  processarTextoPdfPublicacoes,
  parsearBlocoPublicacao,
  inferirOrgaoTribunalDoCnj,
  publicacaoSuprimivelSemTeorSemCnj,
  fundirParesComplementaresPublicacoes,
} from './publicacoesPdfParser.js';

describe('publicacoesPdfParser', () => {
  it('normaliza ano com 2 dígitos (dd/mm/aa → dd/mm/aaaa)', () => {
    expect(normalizarDataBrCompleta('19/03/26')).toBe('19/03/2026');
    expect(normalizarDataBrCompleta('20/03/26')).toBe('20/03/2026');
    expect(normalizarDataBrCompleta('01/01/99')).toBe('01/01/1999');
  });

  it('extrai disponibilização e publicação com ano de 2 dígitos', () => {
    const bloco = `
Processo 5120280-57.2026.8.09.0087
Data de disponibilização: 19/03/26
Data de publicação: 20/03/26
Diário: TJGO
Publicação: Intimação para manifestação.
`;
    const p = parsearBlocoPublicacao(bloco, 0);
    expect(p.dataDisponibilizacao).toBe('19/03/2026');
    expect(p.dataPublicacao).toBe('20/03/2026');
  });

  it('normaliza CNJ com espaços e traços unicode', () => {
    const raw = '5377175 - 91 . 2025 . 8 . 09 . 0006';
    expect(normalizarCnjParaChave(raw)).toBe('5377175-91.2025.8.09.0006');
  });

  it('prefere CNJ após NR.PROCESSO em vez de outro número no meio do bloco', () => {
    const bloco = `
Algo 1234567-89.2020.8.09.0001 irrelevante
NR.PROCESSO : 5377175-91.2025.8.09.0006
Publicação: texto
`;
    expect(extrairCnjPreferencialDoBloco(bloco)).toBe('5377175-91.2025.8.09.0006');
  });

  it('inferir órgão a partir do segmento J = 8 (justiça estadual)', () => {
    expect(inferirOrgaoTribunalDoCnj('5009686-73.2026.8.09.0007')).toBe('Justiça estadual (TJ)');
  });

  it('marca indisponibilidade de arquivos sem inventar teor integral', () => {
    const bloco = `
Processo nº: 5009686-73.2026.8.09.0007
Data de publicação: 10/11/2025
Publicação:
ARQUIVOS DIGITAIS INDISPONÍVEIS
`;
    const p = parsearBlocoPublicacao(bloco, 0);
    expect(p.statusTeor).toBe('indisponivel');
    expect(p.tipoPublicacao).toContain('indispon');
  });

  it('segredo de justiça', () => {
    const bloco = `
NÚMERO ÚNICO: 1111111-11.2024.8.09.0001
Publicação:
PROCESSO EM SEGREDO DE JUSTIÇA
`;
    const p = parsearBlocoPublicacao(bloco, 0);
    expect(p.statusTeor).toBe('segredo');
  });

  it('deduplica por CNJ + data publicação + hash do teor', () => {
    const a = parsearBlocoPublicacao(
      `
Processo 5009686-73.2026.8.09.0007
Data de publicação: 01/12/2025
Publicação: Mesmo teor exato aqui.
`,
      0
    );
    const b = parsearBlocoPublicacao(
      `
Processo 5009686-73.2026.8.09.0007
Data de publicação: 01/12/2025
Publicação: Mesmo teor exato aqui.
`,
      1
    );
    const { itens, duplicatasDescartadas } = deduplicarParseados([a, b]);
    expect(itens.length).toBe(1);
    expect(duplicatasDescartadas).toBe(1);
    expect(chaveDeduplicacao(a.processoCnjNormalizado, a.dataPublicacao, a.hashTeor)).toBe(
      chaveDeduplicacao(b.processoCnjNormalizado, b.dataPublicacao, b.hashTeor)
    );
  });

  it('mantém duas entradas do mesmo processo com teores diferentes', () => {
    const a = parsearBlocoPublicacao(
      'Processo 5009686-73.2026.8.09.0007\nData de publicação: 01/12/2025\nPublicação: Teor A',
      0
    );
    const b = parsearBlocoPublicacao(
      'Processo 5009686-73.2026.8.09.0007\nData de publicação: 01/12/2025\nPublicação: Teor B diferente',
      1
    );
    const { itens } = deduplicarParseados([a, b]);
    expect(itens.length).toBe(2);
    expect(hashTeorNormalizado('Teor A')).not.toBe(hashTeorNormalizado('Teor B diferente'));
  });

  it('pipeline: múltiplos blocos sintéticos', () => {
    const texto = `
Título: Pub 1
NÚMERO ÚNICO: 0011871-02.2024.5.18.0053
Data de disponibilização: 05/11/2025
Data de publicação: 06/11/2025
Diário: TRT
Publicação: Intimação para indicar pessoas ao polo passivo.

Título: Pub 2
Processo nº: 0356280-15.2016.8.09.0006
Data de publicação: 07/11/2025
Publicação: Sentença extensa com fundamentação.
`;
    const { parseados, metricas } = processarTextoPdfPublicacoes(texto);
    expect(metricas.blocosDetectados).toBeGreaterThanOrEqual(1);
    expect(parseados.length).toBeGreaterThanOrEqual(1);
    const c1 = parseados.find((p) => p.processoCnjNormalizado?.includes('0011871'));
    if (c1) {
      expect(c1.teorIntegral.toLowerCase()).toMatch(/intima/);
    }
  });

  it('fundirParesComplementaresPublicacoes une bloco sem CNJ+com datas com o seguinte CNJ+sem datas', () => {
    const cnj = '5303201-84.2026.8.09.0006';
    const a = {
      indiceBloco: 10,
      numeroCnj: '',
      processoCnjNormalizado: '',
      dataPublicacao: '14/04/2026',
      dataDisponibilizacao: '13/04/2026',
      diario: 'TJGO',
      teorIntegral: 'Verifique seu nome em destaque.',
      statusTeor: 'integral',
      tipoPublicacao: 'intimação',
      resumoAutomatico: 'x',
      hashTeor: 'aaa',
      observacoesTecnicas: '',
      termosEncontrados: '',
      processoCnjBruto: '',
      encontrouRotuloPublicacao: true,
      orgaoTribunal: null,
      tribunalPdf: null,
    };
    const b = {
      indiceBloco: 11,
      numeroCnj: cnj,
      processoCnjNormalizado: cnj,
      dataPublicacao: null,
      dataDisponibilizacao: null,
      diario: null,
      teorIntegral: '',
      statusTeor: 'vazio',
      tipoPublicacao: 'outros',
      resumoAutomatico: 'y',
      hashTeor: 'bbb',
      observacoesTecnicas: '',
      termosEncontrados: '',
      processoCnjBruto: cnj,
      encontrouRotuloPublicacao: false,
      orgaoTribunal: null,
      tribunalPdf: null,
    };
    const out = fundirParesComplementaresPublicacoes([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].processoCnjNormalizado).toMatch(/5303201-84\.2026\.8\.09\.0006/i);
    expect(out[0].dataPublicacao).toBe('14/04/2026');
    expect(out[0].dataDisponibilizacao).toBe('13/04/2026');
    expect(out[0].diario).toBe('TJGO');
    expect(out[0].teorIntegral).toMatch(/Verifique seu nome/);
  });

  it('fundirParesComplementaresPublicacoes aceita ordem CNJ primeiro, datas no bloco seguinte', () => {
    const cnj = '5303201-84.2026.8.09.0006';
    const a = {
      indiceBloco: 20,
      numeroCnj: cnj,
      processoCnjNormalizado: cnj,
      dataPublicacao: null,
      dataDisponibilizacao: null,
      diario: null,
      teorIntegral: '',
      statusTeor: 'vazio',
      tipoPublicacao: 'outros',
      resumoAutomatico: '',
      hashTeor: '1',
      observacoesTecnicas: '',
      termosEncontrados: '',
      processoCnjBruto: '',
      encontrouRotuloPublicacao: false,
      orgaoTribunal: null,
      tribunalPdf: null,
    };
    const b = {
      indiceBloco: 21,
      numeroCnj: '',
      processoCnjNormalizado: '',
      dataPublicacao: '14/04/2026',
      dataDisponibilizacao: '13/04/2026',
      diario: 'TJGO',
      teorIntegral: 'Texto do teor.',
      statusTeor: 'integral',
      tipoPublicacao: 'intimação',
      resumoAutomatico: 'r',
      hashTeor: '2',
      observacoesTecnicas: '',
      termosEncontrados: '',
      processoCnjBruto: '',
      encontrouRotuloPublicacao: true,
      orgaoTribunal: null,
      tribunalPdf: null,
    };
    const out = fundirParesComplementaresPublicacoes([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].processoCnjNormalizado).toMatch(/5303201-84\.2026\.8\.09\.0006/i);
    expect(out[0].dataPublicacao).toBe('14/04/2026');
  });

  it('publicacaoSuprimivelSemTeorSemCnj suprime só vazio sem CNJ', () => {
    expect(
      publicacaoSuprimivelSemTeorSemCnj({
        statusTeor: 'vazio',
        numeroCnj: '',
        processoCnjNormalizado: '',
      })
    ).toBe(true);
    expect(
      publicacaoSuprimivelSemTeorSemCnj({
        statusTeor: 'vazio',
        numeroCnj: '5036668-71.2024.8.09.0112',
        processoCnjNormalizado: '',
      })
    ).toBe(false);
    expect(publicacaoSuprimivelSemTeorSemCnj({ statusTeor: 'integral', numeroCnj: '', processoCnjNormalizado: '' })).toBe(
      false
    );
  });
});
