import { buildRouterStateChaveClienteProcesso } from '../../domain/camposProcessoCliente.js';
import { padCliente8Cadastro } from '../../data/cadastroClientesStorage.js';

/** Chave em `location.state` para rolar até a seção de cobrança automática na ficha do cliente. */
export const STATE_FOCO_COBRANCA_AUTOMATICA = 'focoCobrancaAutomatica';

export function estadoPediuFocoCobranca(state) {
  return Boolean(state && typeof state === 'object' && state[STATE_FOCO_COBRANCA_AUTOMATICA] === true);
}

/**
 * State do router para abrir /pessoas no cliente e focar a cobrança automática.
 * @param {string|number} codigoClienteRaw
 * @param {Record<string, unknown>} [extra]
 */
export function buildStateNavegarClienteCobranca(codigoClienteRaw, extra = {}) {
  return buildRouterStateChaveClienteProcesso(padCliente8Cadastro(codigoClienteRaw), '', {
    [STATE_FOCO_COBRANCA_AUTOMATICA]: true,
    ...extra,
  });
}
