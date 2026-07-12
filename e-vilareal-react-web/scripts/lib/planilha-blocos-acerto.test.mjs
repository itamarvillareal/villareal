import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarRef01,
  montarBlocosZerados,
  classificarBlocoCliente,
  nomeGrupoCard,
  listarCodigosNumericos,
  validarSomaAcumuladaZero,
  assertBlocosCompletosNoRecorte,
  gerarJobsCards,
  gerarJobsCardsAuto,
  blocoPrecisaForcarAuto,
} from './planilha-blocos-acerto.mjs';
import { analisarConflitosGrupo } from './carga-acerto-api.mjs';

describe('planilha-blocos-acerto', () => {
  it('normalizarRef01 trata float Excel', () => {
    assert.equal(normalizarRef01(728), '728');
    assert.equal(normalizarRef01('728.0'), '728');
  });

  it('montarBlocosZerados fecha em zero', () => {
    const linhas = [
      { rowId: 1, cents: 100, ref01: '728', comentario: '' },
      { rowId: 2, cents: -100, ref01: '728', comentario: '' },
      { rowId: 3, cents: 50, ref01: '491', comentario: '' },
    ];
    const { blocos } = montarBlocosZerados(linhas);
    assert.equal(blocos.length, 1);
    assert.equal(blocos[0].length, 2);
  });

  it('classificarBlocoCliente OK quando só cliente zera', () => {
    const bloco = [
      { rowId: 5494, cents: -1068776, ref01: '728', comentario: 'deb' },
      { rowId: 5495, cents: 1068776, ref01: '728', comentario: 'cred' },
    ];
    const r = classificarBlocoCliente(bloco, '728', { blocosPular: new Set() });
    assert.equal(r.tipo, 'OK');
    assert.equal(r.grupoAlvo, nomeGrupoCard('728', 5494));
  });

  it('classificarBlocoCliente ESPELHO com ref vazia', () => {
    const bloco = [
      { rowId: 6313, cents: -26970, ref01: '', comentario: '' },
      { rowId: 6314, cents: 13485, ref01: '728', comentario: '' },
      { rowId: 6315, cents: 13485, ref01: '728', comentario: '' },
    ];
    const r = classificarBlocoCliente(bloco, '728', { blocosPular: new Set() });
    assert.equal(r.tipo, 'ESPELHO');
    assert.equal(r.linhasCard.length, 3);
  });

  it('classificarBlocoCliente MISTO multi cliente numerico', () => {
    const bloco = [
      { rowId: 1, cents: 100, ref01: '728', comentario: '' },
      { rowId: 2, cents: -50, ref01: '491', comentario: '' },
      { rowId: 3, cents: -50, ref01: '728', comentario: '' },
    ];
    const r = classificarBlocoCliente(bloco, '728', { blocosPular: new Set() });
    assert.equal(r.tipo, 'MISTO');
  });

  it('listarCodigosNumericos ignora refs texto', () => {
    const blocos = [
      [
        { ref01: '728' },
        { ref01: 'Folha de Pagamento' },
      ],
    ];
    assert.deepEqual(listarCodigosNumericos(blocos), ['728']);
  });

  it('validarSomaAcumuladaZero aceita recorte zerado', () => {
    const linhas = [
      { cents: 100 },
      { cents: -100 },
    ];
    assert.doesNotThrow(() => validarSomaAcumuladaZero(linhas));
  });

  it('validarSomaAcumuladaZero rejeita recorte não zerado', () => {
    assert.throws(() => validarSomaAcumuladaZero([{ cents: 100 }]), /não soma zero/);
  });

  it('assertBlocosCompletosNoRecorte rejeita bloco parcial no corte', () => {
    assert.throws(
      () => assertBlocosCompletosNoRecorte({ blocos: [], foraDeBloco: 2 }, { ateLinhaExcel: 6812 }),
      /bloco parcial/,
    );
  });

  it('gerarJobsCardsAuto deduplica bloco multi-cliente', () => {
    const bloco = [
      { rowId: 10, cents: 100, ref01: '728', comentario: '' },
      { rowId: 11, cents: -50, ref01: '491', comentario: '' },
      { rowId: 12, cents: -50, ref01: '728', comentario: '' },
    ];
    const { blocos } = montarBlocosZerados(bloco);
    assert.equal(blocoPrecisaForcarAuto(bloco, { blocosPular: new Set() }), true);
    const jobsAuto = gerarJobsCardsAuto(blocos, { forcarAuto: true });
    const forçados = jobsAuto.filter((j) => j.motivo === 'forcar_auto');
    assert.equal(forçados.length, 1);
    assert.equal(forçados[0].tipo, 'ESPELHO');
    assert.equal(forçados[0].grupoAlvo, nomeGrupoCard('728', 10));
    assert.equal(forçados[0].linhasCard.length, 3);
    const jobsNormais = gerarJobsCards(blocos, { blocosPular: new Set() });
    assert.ok(jobsNormais.some((j) => j.tipo === 'MISTO'));
  });
});

describe('carga-acerto-api conflitos', () => {
  const porRowId = new Map([
    [100, [{ id: 1, grupo_compensacao: null, det: '100 x', natureza: 'DEBITO', valor: 10 }]],
    [101, [{ id: 2, grupo_compensacao: null, det: '101 x', natureza: 'CREDITO', valor: 10 }]],
    [
      200,
      [
        {
          id: 3,
          grupo_compensacao: 'CZ18B-200',
          det: '200 x',
          natureza: 'DEBITO',
          valor: 5,
        },
      ],
    ],
    [
      201,
      [
        {
          id: 4,
          grupo_compensacao: 'CZ18B-200',
          det: '201 x',
          natureza: 'CREDITO',
          valor: 5,
        },
      ],
    ],
  ]);

  it('analisarConflitosGrupo FEITO quando já no grupo alvo', () => {
    const m = new Map([
      [1, [{ id: 10, grupo_compensacao: 'CZ-B728-5494', det: '5494' }]],
    ]);
    const r = analisarConflitosGrupo([10], m, 'CZ-B728-5494', [5494]);
    assert.equal(r.status, 'FEITO');
  });

  it('analisarConflitosGrupo RENOMEAVEL para CZ18B mesmo rowId', () => {
    const r = analisarConflitosGrupo([3, 4], porRowId, 'CZ-B491-200', [200, 201]);
    assert.equal(r.status, 'RENOMEAVEL');
  });

  it('analisarConflitosGrupo DESPAREAR_LEGADO para espelho em CZ18', () => {
    const m = new Map([
      [7399, [{ id: 99, grupo_compensacao: 'CZ18-8591', det: '7399' }]],
      [7400, [{ id: 100, grupo_compensacao: null, det: '7400' }]],
    ]);
    const linhas = [
      { rowId: 7399, ref01: '' },
      { rowId: 7400, ref01: '728' },
    ];
    const r = analisarConflitosGrupo([99, 100], m, 'CZ-B728-7400', [7399, 7400], {
      linhasCard: linhas,
      codigo: '728',
    });
    assert.equal(r.status, 'DESPAREAR_LEGADO');
  });

  it('analisarConflitosGrupo DESPAREAR quando linha cliente em grupo legado CZ18', () => {
    const m = new Map([
      [7400, [{ id: 100, grupo_compensacao: 'CZ18-8591', det: '7400' }]],
    ]);
    const r = analisarConflitosGrupo([100], m, 'CZ-B728-7400', [7400], {
      linhasCard: [{ rowId: 7400, ref01: '728' }],
      codigo: '728',
    });
    assert.equal(r.status, 'DESPAREAR_LEGADO');
  });
});
