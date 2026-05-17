import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Pencil, SkipForward } from 'lucide-react';
import { ContaBadge } from '../../shared/ContaBadge.jsx';
import { ConfiancaDots } from '../../shared/ConfiancaDots.jsx';
import { ValorText } from '../../shared/ValorText.jsx';
import { textoOrigemSugestao } from '../inboxMappers.js';

const ORDEM_CONFIANCA = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

function melhorSugestao(lista) {
  if (!lista?.length) return null;
  return [...lista].sort(
    (a, b) =>
      (ORDEM_CONFIANCA[String(a.confianca).toUpperCase()] ?? 9) -
      (ORDEM_CONFIANCA[String(b.confianca).toUpperCase()] ?? 9),
  )[0];
}

export function ClassificacaoCard({
  lancamento,
  sugestoes = [],
  contas = [],
  onAprovar,
  onPular,
  isSelected,
  onSelect,
  fading,
  busy,
  focused = false,
}) {
  const navigate = useNavigate();
  const principal = useMemo(() => melhorSugestao(sugestoes), [sugestoes]);
  const alternativas = useMemo(() => {
    if (!principal) return sugestoes.slice(0, 3);
    return sugestoes.filter((s) => s.contaContabilId !== principal.contaContabilId).slice(0, 3);
  }, [sugestoes, principal]);

  const conf = String(principal?.confianca ?? '').toUpperCase();
  const semSugestao = !principal;
  const [contaManual, setContaManual] = useState('');

  const borderLeft =
    conf === 'ALTA'
      ? 'border-l-[3px] border-l-green-500'
      : conf === 'MEDIA'
        ? 'border-l-[3px] border-l-amber-500'
        : 'border-l-[3px] border-l-slate-300 dark:border-l-slate-600';

  const codigoAprovar =
    principal?.contaCodigo ??
    contas.find((c) => String(c.id) === String(contaManual))?.codigo ??
    'N';

  const handleAprovar = (sug) => {
    const s = sug ?? principal;
    const contaId = s?.contaContabilId ?? Number(contaManual);
    if (!contaId) return;
    onAprovar({
      lancamentoId: lancamento.id,
      contaContabilId: contaId,
      clienteId: s?.clienteId ?? null,
      processoId: s?.processoId ?? null,
    });
  };

  return (
    <article
      className={`rounded-lg border border-[var(--color-border-tertiary,#e2e8f0)] dark:border-slate-700 px-4 py-3 mb-2 bg-white dark:bg-slate-900 hover:shadow-sm transition-all duration-300 ${borderLeft} ${
        focused ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950' : ''
      } ${fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <label className="flex items-center pt-0.5 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(lancamento.id, e.target.checked)}
            className="rounded border-slate-300"
          />
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-sm text-slate-700 dark:text-slate-200 tabular-nums">
              {lancamento.dataExibicao}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{lancamento.bancoNome || '—'}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-0.5">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate flex-1 min-w-0">
              {lancamento.descricao}
            </p>
            <ValorText valor={lancamento.valor} natureza={lancamento.natureza} />
          </div>
        </div>
      </div>

      {principal ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Sugestão:</span>
          <ContaBadge codigo={principal.contaCodigo} title={principal.contaNome} />
          <span className="text-slate-700 dark:text-slate-200">{principal.contaNome}</span>
          <ConfiancaDots nivel={principal.confianca} />
          <span className="text-[12px] italic text-slate-400">{textoOrigemSugestao(principal)}</span>
        </div>
      ) : null}

      {semSugestao ? (
        <div className="mt-3">
          <label className="text-xs text-slate-500 block mb-1">Conta contábil</label>
          <select
            value={contaManual}
            onChange={(e) => setContaManual(e.target.value)}
            className="w-full max-w-md text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
          >
            <option value="">Selecione…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nome}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Alternativas:</span>
          {alternativas.map((alt) => (
            <button
              key={`${alt.contaContabilId}-${alt.origem}`}
              type="button"
              disabled={busy}
              onClick={() => handleAprovar(alt)}
              className="inline-flex rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
              title={alt.contaNome}
            >
              <ContaBadge codigo={alt.contaCodigo} />
            </button>
          ))}
          <select
            className="text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const c = contas.find((x) => String(x.id) === id);
              if (c) {
                handleAprovar({
                  contaContabilId: c.id,
                  contaCodigo: c.codigo,
                  clienteId: null,
                  processoId: null,
                });
              }
              e.target.value = '';
            }}
          >
            <option value="">Outra ▼</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          disabled={busy || (semSugestao && !contaManual)}
          onClick={() => handleAprovar()}
          className={`inline-flex items-center gap-1 rounded-md text-white font-medium disabled:opacity-50 ${
            conf === 'ALTA'
              ? 'bg-green-600 hover:bg-green-700 text-sm px-4 py-2'
              : 'bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1.5'
          }`}
        >
          <Check className="w-4 h-4" />
          Aprovar {codigoAprovar}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            navigate(`/financeiro/extrato?busca=${encodeURIComponent(lancamento.descricao ?? '')}`)
          }
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onPular(lancamento.id)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:underline"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Pular
        </button>
      </div>
    </article>
  );
}
