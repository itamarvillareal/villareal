import {
  ETAPA_LABELS,
  ETAPAS_FILTRO_WORKFLOW,
} from '../constants/financeiroConstants.js';
import { CADASTRO_PARCIAL, CADASTRO_PLENO } from '../extrato/extratoCadastroFiltro.js';

export function EtapaFiltroSelect({
  value = '',
  onChange,
  modoEscritorio = false,
  modoImoveis = false,
  className = '',
  ...rest
}) {
  const modoCadastro = modoEscritorio || modoImoveis;
  const ativo = Boolean(value);
  const classeAtivo = modoCadastro
    ? value === CADASTRO_PLENO
      ? 'border-blue-300 bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-200'
      : 'border-red-300 bg-red-50 text-red-900 dark:bg-red-950/50 dark:border-red-700 dark:text-red-200'
    : 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-200';
  const classeInativo =
    'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900';

  const tituloFiltro = modoEscritorio
    ? 'Conta Escritório: completo = código e processo; incompleto = falta um dos dois'
    : modoImoveis
      ? 'Conta Imóveis: completo = imóvel vinculado; incompleto = sem nº do imóvel'
      : 'Etapa do workflow de classificação';

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs px-2 py-0.5 rounded-md border shrink-0 ${
        ativo ? classeAtivo : classeInativo
      } ${className}`.trim()}
      aria-label="Filtrar por etapa"
      title={tituloFiltro}
      {...rest}
    >
      <option value="">Etapa: todas</option>
      {modoCadastro ? (
        <>
          <option value={CADASTRO_PLENO}>
            {modoImoveis ? 'Com imóvel vinculado' : 'Completo (cod. + proc.)'}
          </option>
          <option value={CADASTRO_PARCIAL}>
            {modoImoveis ? 'Sem imóvel vinculado' : 'Incompleto'}
          </option>
        </>
      ) : (
        ETAPAS_FILTRO_WORKFLOW.map((etapa) => (
          <option key={etapa} value={etapa}>
            {ETAPA_LABELS[etapa] ?? etapa}
          </option>
        ))
      )}
    </select>
  );
}
