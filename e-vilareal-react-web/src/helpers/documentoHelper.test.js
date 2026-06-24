import { describe, expect, it } from 'vitest';
import { ENDERECAMENTOS } from '../pages/documentos/constants.js';
import {
  inferirEnderecamento,
  formatarLocalData,
  formatarDataExtensoPeticao,
  extrairCidadeEstadoDeLocalData,
  extrairDataIsoDeLocalData,
  mapearDadosProcessoParaFormIA,
  mapearDadosProcessoParaFormManual,
  montarPreambuloSugerido,
  montarTrechoAcaoPreambuloHtml,
  resolveSelectExato,
  resolveSelectInicial,
} from './documentoHelper.js';

describe('montarTrechoAcaoPreambuloHtml', () => {
  it('parte cliente requerente (autora) move em face da oposta', () => {
    expect(montarTrechoAcaoPreambuloHtml('requerente', 'Digittos Ltda')).toBe(
      'na ação que move em face de <strong>DIGITTOS LTDA</strong>',
    );
  });

  it('parte cliente requerida (ré) recebe ação da oposta', () => {
    expect(montarTrechoAcaoPreambuloHtml('requerido', 'Digittos Ltda')).toBe(
      'na ação que lhe move <strong>DIGITTOS LTDA</strong>',
    );
  });
});

describe('formatarLocalData', () => {
  it('monta cidade + data por extenso com ponto final', () => {
    expect(formatarLocalData('Anápolis, estado de Goiás', '2026-06-24')).toBe(
      'Anápolis, estado de Goiás, 24 de junho de 2026.',
    );
  });

  it('preserva data já informada no texto', () => {
    expect(formatarLocalData('Anápolis, estado de Goiás, 1 de junho de 2026.')).toBe(
      'Anápolis, estado de Goiás, 1 de junho de 2026.',
    );
  });

  it('extrai ISO de local completo', () => {
    expect(extrairDataIsoDeLocalData('Anápolis, estado de Goiás, 24 de junho de 2026.')).toBe(
      '2026-06-24',
    );
  });

  it('extrai só cidade/estado sem a data', () => {
    expect(extrairCidadeEstadoDeLocalData('Anápolis, estado de Goiás, 24 de junho de 2026.')).toBe(
      'Anápolis, estado de Goiás',
    );
  });
});

describe('mapearDadosProcessoParaFormManual', () => {
  it('preenche endereçamento, número e preâmbulo a partir do processo', () => {
    const endereco = inferirEnderecamento('3º JUIZADO ESPECIAL CÍVEL', 'Anápolis', 'GO');
    const form = mapearDadosProcessoParaFormManual({
      enderecamento: endereco,
      numeroProcesso: '5009686-73.2026.8.09.0007',
      nomeAutor: 'Autor X',
      nomeReu: 'Condomínio Torres',
      parteCliente: 'Condomínio Torres',
      parteOposta: 'Digittos Ltda',
      papelParte: 'requerido',
      qualificacaoParteCliente: 'pessoa jurídica...',
      cidadeEstado: 'Anápolis, estado de Goiás',
    });

    expect(form.enderecamentoSelect).toBe(
      'MERITÍSSIMO JUÍZO DO 3º JUIZADO ESPECIAL CÍVEL DA COMARCA DE ANÁPOLIS - GO',
    );
    expect(form.numeroProcesso).toBe('5009686-73.2026.8.09.0007');
    expect(form.preambulo).toContain('CONDOMÍNIO TORRES');
    expect(form.preambulo).toContain('já devidamente qualificado(s)');
    expect(form.preambulo).toContain('na ação que lhe move');
    expect(form.preambulo).toContain('AUTOR X');
  });
});

describe('mapearDadosProcessoParaFormIA', () => {
  it('usa enderecamentoSelect compatível com DadosProcesso', () => {
    const endereco = inferirEnderecamento('3º JUIZADO ESPECIAL CÍVEL', 'Anápolis', 'GO');
    const form = mapearDadosProcessoParaFormIA({
      enderecamento: endereco,
      numeroProcesso: 'CNJ-1',
      tipoPeca: 'Contestação',
    });
    expect(form.enderecamentoSelect).toBe(
      'MERITÍSSIMO JUÍZO DO 3º JUIZADO ESPECIAL CÍVEL DA COMARCA DE ANÁPOLIS - GO',
    );
    expect(form.numeroProcesso).toBe('CNJ-1');
  });
});

describe('montarPreambuloSugerido', () => {
  it('monta parágrafo HTML com qualificação completa na petição inicial', () => {
    const html = montarPreambuloSugerido({
      parteCliente: 'Maria',
      parteOposta: 'João',
      papelParte: 'requerente',
      qualificacaoParteCliente: 'brasileira, solteira',
    });
    expect(html).toContain('<strong>MARIA</strong>');
    expect(html).toContain('brasileira, solteira');
    expect(html).toContain('na ação que move em face de');
  });

  it('interlocutória resume autores e réus como já devidamente qualificados', () => {
    const html = montarPreambuloSugerido({
      numeroProcesso: '5009686-73.2026.8.09.0007',
      nomeAutor: 'Itamar Alexandre Felix Villa Real Junior',
      nomeReu: 'Euripsanto Marcelino da Costa, Paulo Moisés da Costa e Ana Paula da Costa',
      papelParte: 'requerente',
    });
    expect(html).toContain('ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR');
    expect(html).toContain('já devidamente qualificado(s)');
    expect(html).toContain('EURIPSANTO MARCELINO DA COSTA');
    expect(html).not.toContain('CPF');
    expect(html).toContain('na ação que move em face de');
  });

  it('interlocutória com cliente ré usa na ação que lhe move', () => {
    const html = montarPreambuloSugerido({
      numeroProcesso: 'CNJ-1',
      nomeAutor: 'Autor X',
      nomeReu: 'Condomínio Y',
      papelParte: 'requerido',
    });
    expect(html).toContain('CONDOMÍNIO Y');
    expect(html).toContain('na ação que lhe move');
    expect(html).toContain('AUTOR X');
  });
});

describe('resolveSelectExato (endereçamento)', () => {
  const enderecoFamilia = inferirEnderecamento(
    '1ª VARA DE FAMÍLIA E SUCESSÕES',
    'Anápolis',
    'GO',
  );

  it('resolveSelectExato usa a competência do processo na lista', () => {
    const exato = resolveSelectExato(enderecoFamilia, ENDERECAMENTOS);
    expect(exato.select).toBe('MERITÍSSIMO JUÍZO DA 1ª VARA DE FAMÍLIA E SUCESSÕES DA COMARCA DE ANÁPOLIS - GO');
    expect(exato.outro).toBe('');
  });

  it('resolveSelectInicial pode confundir varas com prefixo parecido', () => {
    const opcoesSemFamiliaExata = ENDERECAMENTOS.filter(
      (o) => o !== 'MERITÍSSIMO JUÍZO DA 1ª VARA DE FAMÍLIA E SUCESSÕES DA COMARCA DE ANÁPOLIS - GO',
    );
    const parcial = resolveSelectInicial(enderecoFamilia, opcoesSemFamiliaExata);
    expect(parcial.select).toBe('MERITÍSSIMO JUÍZO DA 1ª VARA CÍVEL DA COMARCA DE ANÁPOLIS - GO');

    const exato = resolveSelectExato(enderecoFamilia, opcoesSemFamiliaExata);
    expect(exato.select).toBe('__outro__');
    expect(exato.outro).toBe(enderecoFamilia);
  });
});
