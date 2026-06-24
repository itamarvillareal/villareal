import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diagnosticarAndamentoUsuario,
  extrairResponsavelPlanilhaDeDetalhe,
  extrairUsuarioExibicaoDb,
  montarEsperadoHistoricoFromTxt,
} from './historico-usuario-txt-vs-db.mjs';

describe('extrairUsuarioExibicaoDb', () => {
  it('lê responsável curto em detalhe', () => {
    assert.equal(
      extrairUsuarioExibicaoDb({
        titulo: 'PUBLICOU EM 20/04',
        detalhe: 'KARLA',
        usuario_id: null,
      }),
      'KARLA',
    );
  });

  it('retorna vazio quando detalhe ausente e sem usuario_id', () => {
    assert.equal(
      extrairUsuarioExibicaoDb({
        titulo: 'INFORMEI ENDERECO',
        detalhe: null,
        usuario_id: null,
      }),
      '',
    );
  });
});

describe('diagnosticarAndamentoUsuario', () => {
  it('marca correção quando txt tem ITAMAR e db está vazio', () => {
    const esperado = montarEsperadoHistoricoFromTxt({
      codigoCliente8: '00000149',
      codNum: 149,
      numeroInterno: 192,
      procStr: '192',
      indice: 3,
      indice4: '0003',
      dataBruta: '4/24/2026',
      yyyyPasta: 2026,
      mmPasta: 4,
      informacao: 'INFORMEI ENDERECO PARA CITAÇÃO',
      usuarioBruto: 'ITAMAR',
      infoArquivoAbs: null,
      localAposBancoDeDados: null,
    });
    const diag = diagnosticarAndamentoUsuario(
      esperado,
      { titulo: esperado.titulo, detalhe: null, movimento_em: esperado.movimentoEm, usuario_id: null },
      new Map([['itamar', 1]]),
    );
    assert.equal(diag.precisaAtualizacao, true);
    assert.ok(diag.motivos.includes('sem_usuario_db'));
    assert.equal(diag.patch?.detalhe_novo, 'ITAMAR');
    assert.equal(diag.patch?.usuario_id_novo, 1);
  });
});

describe('extrairResponsavelPlanilhaDeDetalhe', () => {
  it('extrai Consultor: prefixo', () => {
    assert.equal(
      extrairResponsavelPlanilhaDeDetalhe('Consultor: ANA LUISA\n\nTexto longo', true),
      'ANA LUISA',
    );
  });
});
