import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Pencil, SkipForward } from 'lucide-react';
import { ContaBadge } from '../../shared/ContaBadge.jsx';
import { ConfiancaDots } from '../../shared/ConfiancaDots.jsx';
import { ValorText } from '../../shared/ValorText.jsx';
import { textoOrigemSugestao } from '../inboxMappers.js';
import {
  formatMoeda,
  resumoPeriodoGrupo,
  resumoValoresGrupo,
} from '../inboxClassificacaoGrupos.js';
import { ClassificacaoCard } from './ClassificacaoCard.jsx';

const AMOSTRA = 3;

export function ClassificacaoGroupCard({
  grupo,
  sugestoesMap = {},
  contas = [],
  onAprovarGrupo,
  onAprovar,
  onPularGrupo,
  isSelected,
  onSelectGrupo,
  fading,
  busy,
}) {
  const { sugestao, lancamentos, descricao, banco } = grupo;
  const n = lancamentos.length;
  const [expandido, setExpandido] = useState(false);
  const [modoRevisar, setModoRevisar] = useState(false);

  const conf = String(sugestao?.confianca ?? '').toUpperCase();
  const codigo = sugestao?.contaCodigo ?? '—';
  const periodo = useMemo(() => resumoPeriodoGrupo(lancamentos), [lancamentos]);
  const valores = useMemo(() => resumoValoresGrupo(lancamentos), [lancamentos]);
  const amostra = lancamentos.slice(0, AMOSTRA);
  const listaExibida = expandido || modoRevisar ? lancamentos : amostra;

  const borderLeft =
    conf === 'ALTA'
      ? 'border-l-[3px] border-l-green-500'
      : conf === 'MEDIA'
        ? 'border-l-[3px] border-l-amber-500'
        : 'border-l-[3px] border-l-slate-300 dark:border-l-slate-600';

  const handleAprovarGrupo = () => {
    onAprovarGrupo?.(grupo);
  };

  const handlePular = () => {
    onPularGrupo?.(lancamentos.map((l) => l.id));
  };

  if (modoRevisar) {
    return (
      <article
        className={`rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 mb-3 bg-white dark:bg-slate-900 ${borderLeft} ${
          fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'
        } transition-all duration-300`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Revisar grupo: «{descricao}» — {banco || '—'}
          </h3>
          <button
            type="button"
            onClick={() => setModoRevisar(false)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Voltar ao resumo
          </button>
        </div>
        {lancamentos.map((l) => (
          <ClassificacaoCard
            key={l.id}
            lancamento={l}
            sugestoes={sugestoesMap[l.id] ?? []}
            contas={contas}
            onAprovar={onAprovar}
            onPular={(id) => onPularGrupo?.([id])}
            isSelected={false}
            onSelect={() => {}}
            busy={busy}
          />
        ))}
      </article>
    );
  }

  return (
    <article
      className={`rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 mb-3 bg-white dark:bg-slate-900 hover:shadow-sm transition-all duration-300 ${borderLeft} ${
        fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'
      }`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <label className="flex items-center pt-0.5 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelectGrupo?.(lancamentos.map((l) => l.id), e.target.checked)}
            className="rounded border-slate-300"
          />
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              GRUPO: «{descricao}» — {banco || '—'}
            </h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 shrink-0">
              {n} lançamento{n !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Período: {periodo}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Valores: R$ {formatMoeda(valores.min)} a R$ {formatMoeda(valores.max)} (total: R${' '}
            {formatMoeda(valores.total)})
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Sugestão:</span>
        <ContaBadge codigo={sugestao.contaCodigo} title={sugestao.contaNome} />
        <span className="text-slate-700 dark:text-slate-200">{sugestao.contaNome}</span>
        <ConfiancaDots nivel={sugestao.confianca} />
        <span className="text-[12px] italic text-slate-400">{textoOrigemSugestao(sugestao)}</span>
      </div>

      <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          Amostra ({listaExibida.length} de {n})
        </p>
        <div className={expandido && n > 8 ? 'max-h-64 overflow-y-auto' : ''}>
          <table className="w-full text-xs">
            <tbody>
              {listaExibida.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                    {l.dataExibicao}
                  </td>
                  <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100 truncate max-w-[140px]">
                    {l.descricao}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 truncate max-w-[80px]">{l.bancoNome}</td>
                  <td className="px-2 py-1.5 text-right">
                    <ValorText valor={l.valor} natureza={l.natureza} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {n > AMOSTRA ? (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expandido ? 'Recolher lista' : `Ver todos os ${n}`}
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={handleAprovarGrupo}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium text-sm px-4 py-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          Aprovar {codigo} para os {n}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setModoRevisar(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Pencil className="w-3.5 h-3.5" />
          Revisar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handlePular}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:underline"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Pular
        </button>
      </div>
    </article>
  );
}
