import { describe, it, expect } from 'vitest';
import { validateCPF } from './cpfValidatorService.js';
import { parseBrazilianDate } from './dateParserService.js';
import { extrairDadosDeTextoLivre } from './personTextAutofillService.js';

describe('validateCPF', () => {
  it('aceita CPF válido', () => {
    expect(validateCPF('390.533.447-05').valido).toBe(true);
    expect(validateCPF('39053344705').valido).toBe(true);
  });
  it('rejeita CPF inválido', () => {
    expect(validateCPF('111.111.111-11').valido).toBe(false);
  });
});

describe('parseBrazilianDate', () => {
  it('converte dd/mm/aaaa', () => {
    expect(parseBrazilianDate('4', '10', '2002')).toBe('2002-10-04');
  });
});

describe('extrairDadosDeTextoLivre — casos obrigatórios', () => {
  it('caso 1: texto estruturado', () => {
    const t =
      'Nome completo: Elizeu Souza de Oliveira\nCPF: 390.533.447-05\nRG: 3834914 DGPC GO\nData de nascimento: 04/10/2002';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.nomeCompleto).toMatch(/Elizeu Souza de Oliveira/i);
    expect(r.cpf).toBeTruthy();
    expect(r.rg).toMatch(/3834914/i);
    expect(r.dataNascimento).toBe('2002-10-04');
    expect(r.sucesso).toBe(true);
  });

  it('caso 2: texto jurídico corrido', () => {
    const t =
      'ELIZEU SOUZA DE OLIVEIRA ("ELIZEU"), brasileiro, casado, empresário, portador da cédula de identidade n. 3843914 DGPC/GO, inscrito no CPF sob o n. 921.130.101-79, residente e domiciliado na Avenida Maranhão, Quadra 64B, Lote 30, Apto. 1702, Edifício Residencial Montpellier, Bairro Jundiaí, Anápolis/GO, CEP 75.114-150, endereço eletrônico: elizeu0419@gmail.com;';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.nomeCompleto).toMatch(/ELIZEU SOUZA DE OLIVEIRA/i);
    expect(r.rg).toMatch(/3843914.*DGPC/i);
    expect(validateCPF('921.130.101-79').valido).toBe(false);
    expect(r.cpf).toBeNull();
    expect(r.nacionalidade).toBe('Brasileiro');
    expect(r.estadoCivil).toBe('casado');
    expect(r.profissao).toMatch(/^Empres[aá]rio$/i);
    expect(r.endereco).toBeTruthy();
    expect(r.endereco.estado).toBe('GO');
    expect(r.endereco.cidade).toMatch(/Anápolis/i);
    expect(r.endereco.cep).toBe('75114150');
    expect(r.endereco.rua).toMatch(/Avenida Maranhão/i);
  });

  it('qualificação por rótulos', () => {
    const r = extrairDadosDeTextoLivre(
      'Fulana de Tal. Nacionalidade: brasileira. Estado civil: divorciada. Profissão: professora.'
    );
    expect(r.nacionalidade).toBe('Brasileira');
    expect(r.estadoCivil).toBe('divorciado');
    expect(r.profissao).toMatch(/Professora/i);
  });

  it('caso 3: parcial', () => {
    const t = 'Elizeu Souza de Oliveira, CPF 39053344705';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.nomeCompleto).toMatch(/Elizeu/i);
    expect(r.cpf).toBeTruthy();
    expect(r.rg).toBeNull();
    expect(r.dataNascimento).toBeNull();
  });

  it('caso 4: vazio', () => {
    const r = extrairDadosDeTextoLivre('');
    expect(r.sucesso).toBe(false);
    expect(r.avisos.some((a) => /vazio/i.test(a))).toBe(true);
  });

  it('multilinha: remove parágrafos antes da extração (nome e CPF em linhas diferentes)', () => {
    const t = 'ELIZEU SOUZA DE\nOLIVEIRA, CPF 390.533.447-05';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.nomeCompleto).toMatch(/ELIZEU SOUZA DE OLIVEIRA/i);
    expect(r.cpf).toBeTruthy();
    expect(r.textoNormalizado).toMatch(/ELIZEU SOUZA DE OLIVEIRA, CPF 390\.533\.447-05/);
  });
});
