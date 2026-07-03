import { ETAPA_LABELS } from '../constants/financeiroConstants.js';

/**
 * @param {{ etapa?: string }} props
 * @param {boolean | null | undefined} [props.cadastroEscritorio] — Conta Escritório: true=azul (cod+proc), false=vermelho
 * @param {boolean | null | undefined} [props.cadastroImoveis] — Conta Imóveis: true=azul (imóvel), false=vermelho
 */
export function EtapaDot({ etapa, cadastroEscritorio = undefined, cadastroImoveis = undefined }) {
  if (cadastroEscritorio === true) {
    return (
      <span
        className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
        style={{ background: 'var(--fin-etapa-escritorio-ok, #2563eb)' }}
        title="Código e processo preenchidos"
        aria-label="Cadastro completo"
      />
    );
  }
  if (cadastroEscritorio === false) {
    return (
      <span
        className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
        style={{ background: 'var(--fin-etapa-escritorio-pendente, #ef4444)' }}
        title="Falta código de cliente e/ou processo"
        aria-label="Cadastro incompleto"
      />
    );
  }
  if (cadastroImoveis === true) {
    return (
      <span
        className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
        style={{ background: 'var(--fin-etapa-escritorio-ok, #2563eb)' }}
        title="Imóvel vinculado"
        aria-label="Imóvel vinculado"
      />
    );
  }
  if (cadastroImoveis === false) {
    return (
      <span
        className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
        style={{ background: 'var(--fin-etapa-escritorio-pendente, #ef4444)' }}
        title="Sem imóvel vinculado"
        aria-label="Sem imóvel vinculado"
      />
    );
  }

  const key = String(etapa ?? 'IMPORTADO').trim().toUpperCase();
  const label = ETAPA_LABELS[key] ?? key;
  const varName = `--fin-etapa-${key.toLowerCase()}`;

  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
      style={{ background: `var(${varName}, var(--fin-etapa-importado))` }}
      title={label}
      aria-label={label}
    />
  );
}
