import assert from 'node:assert/strict';
import test from 'node:test';
import { montarPanelConfigDesdeTxt } from './calculos-dropbox-payload.mjs';
import { extrairConfigRodada } from './calculos-recalcular-rodada.mjs';
import { carregarBundleCalculosCliente } from './calculos-dropbox-txt.mjs';

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
