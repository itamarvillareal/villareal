import { describe, it, expect } from 'vitest';
import {
  FASES,
  TIPOS_AUDIENCIA,
  canonicalizarFaseParaOpcoesRadiosProcessos,
  classeShellFormularioProcessoPorFase,
  normalizarTipoAudienciaCanonico,
} from './processosDadosRelatorio.js';

describe('canonicalizarFaseParaOpcoesRadiosProcessos', () => {
  it('mantém valores já canónicos da lista FASES', () => {
    for (const f of FASES) {
      expect(canonicalizarFaseParaOpcoesRadiosProcessos(f)).toBe(f);
    }
  });

  it('mapeia «Aguardando Verificação» para o rótulo do radio «Ag. Verificação»', () => {
    expect(canonicalizarFaseParaOpcoesRadiosProcessos('Aguardando Verificação')).toBe('Ag. Verificação');
  });

  it('mapeia variações com acentos e caixa', () => {
    expect(canonicalizarFaseParaOpcoesRadiosProcessos('AGUARDANDO VERIFICACAO')).toBe('Ag. Verificação');
  });

  it('devolve string vazia para fase desconhecida', () => {
    expect(canonicalizarFaseParaOpcoesRadiosProcessos('Fase inventada XYZ')).toBe('');
  });
});

describe('classeShellFormularioProcessoPorFase', () => {
  it('aplica fundo âmbar para Ag. Documentos', () => {
    expect(classeShellFormularioProcessoPorFase('Ag. Documentos')).toContain('bg-amber-100');
  });

  it('aplica fundo escuro para Protocolo / Movimentação', () => {
    expect(classeShellFormularioProcessoPorFase('Protocolo / Movimentação')).toContain('bg-slate-900');
  });
});

describe('normalizarTipoAudienciaCanonico', () => {
  it('mantém tipos canónicos da lista', () => {
    for (const tipo of TIPOS_AUDIENCIA) {
      expect(normalizarTipoAudienciaCanonico(tipo)).toBe(tipo);
    }
  });

  it('mapeia cabeçalho de agenda CONCILIAÇÃO para Conciliação', () => {
    expect(normalizarTipoAudienciaCanonico('CONCILIAÇÃO')).toBe('Conciliação');
  });

  it('descarta descrições de tarefa «consultar … x …»', () => {
    expect(
      normalizarTipoAudienciaCanonico('consultar RAFAEL SIQUEIRA x KAROLYNE SOUZA')
    ).toBe('');
  });

  it('descarta valor genérico «Audiência»', () => {
    expect(normalizarTipoAudienciaCanonico('Audiência')).toBe('');
  });
});
