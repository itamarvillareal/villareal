import assert from 'node:assert/strict';
import test from 'node:test';
import { montarPanelConfigDesdeTxt } from './calculos-dropbox-payload.mjs';
import { extrairConfigRodada } from './calculos-recalcular-rodada.mjs';
import {
  carregarBundleCalculosCliente,
  diagnosticarRodadaImport,
  montarPayloadRodadaComRecalculo,
  parseNomeArquivoCalculo,
} from './calculos-dropbox-txt.mjs';

test('montarPanelConfigDesdeTxt: taxa honorários fixa 20% → «20 %» no painel', () => {
  const bundle = carregarBundleCalculosCliente(728);
  const rodada = bundle.porRodada.get('00000728|77|1');
  assert.ok(rodada);
  const cfg = extrairConfigRodada(rodada);
  assert.equal(cfg.taxaHonorariosPct, 20);
  assert.equal(cfg.honorariosTipo, 'FIXO');
  const panel = montarPanelConfigDesdeTxt(rodada);
  assert.equal(panel.honorariosTipo, 'fixos');
  assert.equal(panel.honorariosValor, '20 %');
  assert.doesNotMatch(panel.honorariosValor, /^R\$/i);
});

test('parseNome: config dimensão 00000728.0.129.1.txt', () => {
  const meta = parseNomeArquivoCalculo('00000728.0.129.1.txt');
  assert.equal(meta?.dimensao, 0);
  assert.equal(meta?.tipo, 129);
  assert.equal(meta?.numeroProcesso, null);
});

test('728/1198/0: honorários 0% da dimensão + snapshot dos txt (sem recalcular 10%)', async () => {
  const bundle = carregarBundleCalculosCliente(728);
  const rodada = bundle.porRodada.get('00000728|1198|0');
  assert.ok(rodada);
  assert.equal(extrairConfigRodada(rodada).taxaHonorariosPct, 0);
  const panel = montarPanelConfigDesdeTxt(rodada);
  assert.equal(panel.honorariosValor, '0 %');
  const p = await montarPayloadRodadaComRecalculo(rodada, {});
  assert.equal(p.meta?.recalculado, false);
  assert.equal(p.titulos?.length, 5);
  assert.equal(p.titulos[0].valorInicial, 'R$ 140,89');
  assert.equal(p.titulos[0].juros, 'R$ 6,85');
  assert.equal(p.titulos[0].honorarios, 'R$ 30,13');
  assert.equal(p.panelConfig?.honorariosValor, '0 %');
  assert.equal(p.dataCalculoRodada, '03/08/2023');
  const diag = diagnosticarRodadaImport(rodada, p);
  assert.equal(diag.modo, 'snapshot');
  assert.equal(diag.avisos.length, 0);
});

test('parseNome: 00000149.0.95.1.186.txt é dimensão 0 (não 1)', () => {
  const meta = parseNomeArquivoCalculo('00000149.0.95.1.186.txt');
  assert.equal(meta?.dimensao, 0);
  assert.equal(meta?.tipo, 95);
  assert.equal(meta?.numeroProcesso, 186);
});

test('149/186/1 lê taxa honorários 20% de 00000149.1.95.1.186.txt', () => {
  const bundle = carregarBundleCalculosCliente(149);
  const rodada = bundle.porRodada.get('00000149|186|1');
  assert.ok(rodada);
  assert.ok(rodada.porTipo.get('95'), 'esperado 00000149.1.95.1.186.txt');
  assert.equal(extrairConfigRodada(rodada).taxaHonorariosPct, 20);
  assert.equal(montarPanelConfigDesdeTxt(rodada).honorariosValor, '20 %');
});

test('recálculo 149/76/2 inclui linhas 2 e 3 só com valor (sem vencimento)', async () => {
  const { carregarBundleCalculosCliente, montarPayloadRodadaComRecalculo } = await import(
    './calculos-dropbox-txt.mjs'
  );
  const rodada = carregarBundleCalculosCliente(149).porRodada.get('00000149|76|2');
  assert.ok(rodada);
  const p = await montarPayloadRodadaComRecalculo(rodada, {});
  assert.equal(p.titulos?.length, 3);
  assert.equal(p.titulos[1].valorInicial, 'R$ 1.087,57');
  assert.equal(p.titulos[1].dataVencimento, '');
  assert.equal(p.titulos[2].valorInicial, 'R$ -10.685,64');
});
