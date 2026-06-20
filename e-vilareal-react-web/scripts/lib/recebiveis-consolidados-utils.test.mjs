import assert from 'node:assert/strict';
import {
  consolidarRecebiveisContratos,
  parcelamentoContratoAtivo,
  resolverParcelasContrato,
} from '../../src/data/recebiveisConsolidadosUtils.js';

const contratoPagamentoUnico = {
  id: 2,
  processoId: 1,
  gerarRecebiveis: false,
  quantidadeParcelas: 2,
  valorTotalParcelas: null,
  valorFixo: 1000,
  tipoRemuneracao: 'VALOR_FIXO',
  dataContrato: '2026-06-20',
  parcelas: [],
};

assert.equal(parcelamentoContratoAtivo(contratoPagamentoUnico), false);
assert.equal(resolverParcelasContrato(contratoPagamentoUnico).length, 1);
assert.equal(resolverParcelasContrato(contratoPagamentoUnico)[0].valor, 1000);
assert.equal(consolidarRecebiveisContratos([contratoPagamentoUnico]).length, 1);

const contratoParcelado = {
  id: 3,
  gerarRecebiveis: true,
  quantidadeParcelas: 2,
  valorTotalParcelas: 1000,
  valorFixo: 1000,
  dataContrato: '2026-06-20',
  parcelas: [],
};

assert.equal(parcelamentoContratoAtivo(contratoParcelado), true);
assert.equal(resolverParcelasContrato(contratoParcelado).length, 2);

console.log('recebiveis-consolidados-utils.test.mjs OK');
