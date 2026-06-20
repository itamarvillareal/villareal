import { CONFIANCA } from '../constants/financeiroConstants.js';

const ROTULOS = {
  [CONFIANCA.ALTA]: 'Alta',
  [CONFIANCA.MEDIA]: 'Média',
  [CONFIANCA.BAIXA]: 'Baixa',
};

const OPCOES = [CONFIANCA.ALTA, CONFIANCA.MEDIA, CONFIANCA.BAIXA];

export function ConfiancaFiltroSelect({ value = '', onChange, className = '', ...rest }) {
  const ativo = Boolean(value);
  const classeAtivo =
    value === CONFIANCA.ALTA
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-200'
      : value === CONFIANCA.MEDIA
        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-200'
        : 'border-slate-300 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200';
  const classeInativo =
    'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900';

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-sm rounded-md border px-2 py-1 shrink-0 ${
        ativo ? classeAtivo : classeInativo
      } ${className}`.trim()}
      aria-label="Filtrar por confiança da sugestão"
      title="Filtra sugestões pela confiança do pareamento"
      {...rest}
    >
      <option value="">Confiança: todas</option>
      {OPCOES.map((nivel) => (
        <option key={nivel} value={nivel}>
          {ROTULOS[nivel] ?? nivel}
        </option>
      ))}
    </select>
  );
}
