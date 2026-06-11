import { describe, it, expect } from 'vitest';
import { formatarPartesLinha, limparCssDoTeor, teorParaExibicao } from './manifestacoesProjudiDisplay.js';

describe('limparCssDoTeor', () => {
  it('remove bloco CSS órfão do email TRT', () => {
    const teor = `Processo Judicial Eletrônico
*
{
margin: 0;
padding: 0;
}
body {
background: #fff;
}
Número do Processo: 0000545-17.2025.5.18.0051`;
    const limpo = limparCssDoTeor(teor);
    expect(limpo).toContain('Número do Processo');
    expect(limpo).not.toContain('margin: 0');
  });
});

describe('teorParaExibicao', () => {
  it('TRT: reconstrói teor a partir do jsonReferencia quando só há CSS', () => {
    const row = {
      origemImportacao: 'TRT',
      numeroProcessoEncontrado: '0000545-17.2025.5.18.0051',
      teor: '* { margin: 0; } table { font-size: 10px; }',
      jsonReferencia: JSON.stringify({
        trt: {
          classeJudicial: 'Ação Trabalhista',
          orgaoJulgador: '1ª VARA',
          parteAutor: 'EZEQUIEL DOS SANTOS FERREIRA',
          parteReu: 'MEGA ELITE VIGILANCIA E SEGURANÇA ESPECIALIZADA LTDA',
          tipoMovimento: 'Intimação',
        },
      }),
    };
    const t = teorParaExibicao(row);
    expect(t).toContain('MEGA ELITE VIGILANCIA');
    expect(t).toContain('Intimação');
    expect(t).not.toContain('font-size');
  });
});

describe('formatarPartesLinha', () => {
  it('vinculado: não confunde titular/cliente contratante com parte cliente', () => {
    const row = {
      statusVinculo: 'vinculado',
      titularNome: 'CONDOMINIO RESIDENCIAL TORRES DO MIRANTE',
      cliente: 'CONDOMINIO RESIDENCIAL TORRES DO MIRANTE',
      parteCliente: '',
      reu: 'RANDERSON AGUIAR PEREIRA',
    };
    expect(formatarPartesLinha(row)).toBe('RANDERSON AGUIAR PEREIRA');
  });

  it('vinculado: parte cliente × parte oposta (não nome do cliente contratante)', () => {
    const row = {
      statusVinculo: 'vinculado',
      cliente: 'CONDOMINIO RESIDENCIAL TORRES DO MIRANTE',
      parteCliente: 'MARÍLIA GABRIELA',
      reu: 'RANDERSON AGUIAR PEREIRA',
    };
    expect(formatarPartesLinha(row)).toBe('MARÍLIA GABRIELA × RANDERSON AGUIAR PEREIRA');
  });

  it('vinculado requerido: réu primeiro (parte cliente do escritório)', () => {
    const row = {
      statusVinculo: 'vinculado',
      papelParte: 'requerido',
      parteCliente: 'ROBERTO SOARES DAS CHAGAS e ROBERTO SOARES DAS CHAGAS I ME',
      reu: 'FRANCISCO CESAR DA SILVA',
      parteOposta: 'FRANCISCO CESAR DA SILVA',
    };
    expect(formatarPartesLinha(row)).toBe(
      'ROBERTO SOARES DAS CHAGAS e ROBERTO SOARES DAS CHAGAS I ME × FRANCISCO CESAR DA SILVA'
    );
  });
});
