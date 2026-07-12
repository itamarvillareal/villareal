import { buildRouterStateChaveClienteProcesso } from '../../../../domain/camposProcessoCliente.js';

/**
 * Estado do ProcessoEmbedModal para consulta rápida (sem navegar nem alterar a tela de origem).
 * @returns {{ revision: number, routerState: object, titulo: string }}
 */
export function criarEmbedConsultaProcesso(codigoCliente, { numeroInterno = null, processoId = null } = {}) {
  const extra = {};
  if (processoId != null && Number(processoId) > 0) {
    extra.processoApiId = Number(processoId);
  }
  const proc =
    numeroInterno != null && String(numeroInterno).trim() !== '' ? String(numeroInterno).trim() : '0';
  const titulo =
    proc !== '0' ? `Processo · Proc. ${proc}` : 'Processo · mensalidades/avulsos';
  return {
    revision: Date.now(),
    routerState: buildRouterStateChaveClienteProcesso(codigoCliente, proc, extra),
    titulo,
  };
}

export function criarEmbedConsultaContaCorrente(codigoCliente, { numeroInterno = null } = {}) {
  const proc =
    numeroInterno != null && String(numeroInterno).trim() !== '' ? String(numeroInterno).trim() : '0';
  return {
    revision: Date.now(),
    routerState: buildRouterStateChaveClienteProcesso(codigoCliente, proc, {
      contaCorrenteSomente: true,
    }),
    titulo: proc !== '0' ? `Conta corrente · Proc. ${proc}` : 'Conta corrente · Proc. 0',
  };
}
