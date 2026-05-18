import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  chaveConteudoEvento,
  compromissosEquivalentes,
  dataIsoAgenda,
  parseLinhaCsvAgendaDia,
  parseMesPastaAgenda,
  parseNomeArquivoAgenda,
  parseNomeArquivoAgendaDia,
} from './agenda-local-txt.mjs';

describe('parseNomeArquivoAgenda', () => {
  it('parse ficheiro padrão Dr. Itamar', () => {
    const p = parseNomeArquivoAgenda('Dr. Itamar.13.07.2026.1.Hora.Agenda.txt');
    assert.equal(p.usuarioArquivo, 'Dr. Itamar');
    assert.equal(p.dia, 13);
    assert.equal(p.mes, 7);
    assert.equal(p.ano, 2026);
    assert.equal(p.linha, 1);
    assert.equal(p.tipo, 'Hora');
  });

  it('ignora ficheiro legado dd.mm.yyyy.txt no parser estruturado', () => {
    assert.equal(parseNomeArquivoAgenda('06.07.2026.txt'), null);
  });
});

describe('parseNomeArquivoAgendaDia', () => {
  it('parse dd.mm.yyyy', () => {
    const p = parseNomeArquivoAgendaDia('02.12.2025.txt');
    assert.deepEqual(p, { dia: 2, mes: 12, ano: 2025 });
  });
});

describe('parseLinhaCsvAgendaDia', () => {
  it('parse linha CSV com hora e OK', () => {
    const l = parseLinhaCsvAgendaDia(
      '"09:30","Diogo CONCILIAÇÃO (teste)","OK"'
    );
    assert.equal(l.horaEvento, '09:30');
    assert.ok(l.descricao.includes('Diogo'));
    assert.equal(l.statusCurto, 'OK');
  });

  it('ignora linha vazia com ..../__', () => {
    assert.equal(parseLinhaCsvAgendaDia('".....","","__"'), null);
  });
});

describe('compromissosEquivalentes', () => {
  it('só descrição vs descrição+OK — equivalente (status não obrigatório)', () => {
    const a = {
      descricao: 'Pagar contas',
      horaEvento: null,
      statusCurto: null,
    };
    const b = {
      descricao: 'Pagar contas',
      horaEvento: null,
      statusCurto: 'OK',
    };
    assert.equal(compromissosEquivalentes(a, b), true);
  });

  it('mesma descrição, hora só num lado — equivalente', () => {
    assert.equal(
      compromissosEquivalentes(
        { descricao: 'Consultar processo X', horaEvento: null, statusCurto: null },
        { descricao: 'Consultar processo X', horaEvento: '14:00', statusCurto: null }
      ),
      true
    );
  });

  it('descrições diferentes — não equivalente', () => {
    assert.equal(
      compromissosEquivalentes(
        { descricao: 'Cheque Helder', horaEvento: null, statusCurto: null },
        { descricao: 'Cheque Veredas', horaEvento: null, statusCurto: null }
      ),
      false
    );
  });
});

describe('chaveConteudoEvento', () => {
  it('mesma chave para desc vazia e Compromisso', () => {
    const a = chaveConteudoEvento({ descricao: '', horaEvento: null, statusCurto: null });
    const b = chaveConteudoEvento({
      descricao: 'Compromisso',
      horaEvento: null,
      statusCurto: null,
    });
    assert.equal(a, b);
  });
});

describe('dataIsoAgenda', () => {
  it('valida 31/12', () => {
    assert.equal(dataIsoAgenda(2026, 12, 31), '2026-12-31');
    assert.equal(dataIsoAgenda(2026, 2, 31), null);
  });
});

describe('parseMesPastaAgenda', () => {
  it('extrai mês de pasta com nome', () => {
    assert.equal(parseMesPastaAgenda('07 - Julho'), 7);
    assert.equal(parseMesPastaAgenda('01 - Janeiro'), 1);
  });
});
