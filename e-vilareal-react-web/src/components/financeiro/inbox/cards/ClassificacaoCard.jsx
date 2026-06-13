import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { navegarExtratoLancamento } from '../../extrato/extratoDeepLink.js';
import { Check, Pencil, RefreshCw, SkipForward } from 'lucide-react';
import { ContaBadge } from '../../shared/ContaBadge.jsx';
import {
  CLASSE_BORDA_CONTA,
  CLASSE_BOTAO_APROVAR_CONTA,
  varsCorConta,
} from '../../shared/contaCores.js';
import { ConfiancaDots } from '../../shared/ConfiancaDots.jsx';
import { ValorText } from '../../shared/ValorText.jsx';
import { filtrarSugestoesClassificacao, melhorSugestao } from '../inboxClassificacaoGrupos.js';
import { textoOrigemSugestao } from '../inboxMappers.js';

export function ClassificacaoCard({
  lancamento,
  sugestoes = [],
  contas = [],
  onAprovar,
  onPular,
  onRefatorar,
  refatorando = false,
  isSelected,
  onSelect,
  fading,
  busy,
  focused = false,
}) {
  const navigate = useNavigate();
  const [contaEscolhidaId, setContaEscolhidaId] = useState(null);

  useEffect(() => {
    setContaEscolhidaId(null);
  }, [lancamento.id]);

  const sugestoesUteis = useMemo(() => filtrarSugestoesClassificacao(sugestoes), [sugestoes]);
  const principal = useMemo(() => melhorSugestao(sugestoesUteis), [sugestoesUteis]);
  const alternativas = useMemo(() => {
    if (!principal) return sugestoesUteis.slice(0, 3);
    return sugestoesUteis.filter((s) => s.contaContabilId !== principal.contaContabilId).slice(0, 3);
  }, [sugestoesUteis, principal]);

  const contaEscolhida = useMemo(() => {
    if (contaEscolhidaId == null || contaEscolhidaId === '') return null;
    const c = contas.find((x) => String(x.id) === String(contaEscolhidaId));
    if (!c) return null;
    return {
      contaContabilId: c.id,
      contaCodigo: c.codigo,
      contaNome: c.nome,
      clienteId: null,
      processoId: null,
    };
  }, [contaEscolhidaId, contas]);

  const contaAtiva = contaEscolhida ?? principal;

  const semSugestao = !principal;
  const codigoBorda = contaAtiva?.contaCodigo ?? null;
  const borderLeft = codigoBorda
    ? CLASSE_BORDA_CONTA
    : 'border-l-[3px] border-l-slate-300 dark:border-l-slate-600';
  const estiloBorda = codigoBorda ? varsCorConta(codigoBorda) : undefined;

  const codigoAprovar = contaAtiva?.contaCodigo ?? '';

  const handleAprovar = (sug) => {
    const s = sug ?? contaAtiva;
    const contaId = s?.contaContabilId;
    if (!contaId) return;
    onAprovar({
      lancamentoId: lancamento.id,
      contaContabilId: contaId,
      clienteId: s?.clienteId ?? null,
      processoId: s?.processoId ?? null,
    });
  };

  const abrirExtrato = useCallback(() => {
    navegarExtratoLancamento(navigate, lancamento);
  }, [navigate, lancamento]);

  return (
    <article
      className={`rounded-lg border border-[var(--color-border-tertiary,#e2e8f0)] dark:border-slate-700 px-4 py-3 mb-2 bg-white dark:bg-slate-900 hover:shadow-sm transition-all duration-300 ${borderLeft} ${
        focused ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950' : ''
      } ${fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'}`}
      style={estiloBorda}
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
        <div
          className="flex-1 min-w-0 cursor-pointer rounded-md -mx-1 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          onDoubleClick={abrirExtrato}
          title="Duplo clique: abrir extrato do banco neste lançamento"
        >
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
          <span className="text-slate-500 dark:text-slate-400">
            {contaEscolhida ? 'Classificar como:' : 'Sugestão:'}
          </span>
          <ContaBadge codigo={contaAtiva.contaCodigo} title={contaAtiva.contaNome} />
          <span className="text-slate-700 dark:text-slate-200">{contaAtiva.contaNome}</span>
          {!contaEscolhida ? (
            <>
              <ConfiancaDots nivel={principal.confianca} />
              <span className="text-[12px] italic text-slate-400">{textoOrigemSugestao(principal)}</span>
              {principal.rotuloVinculo &&
              String(principal.origem ?? '').toUpperCase() !== 'PESSOA_PROCESSO' ? (
                <span className="text-[12px] font-medium text-blue-700 dark:text-blue-300">
                  {principal.rotuloVinculo}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[12px] text-slate-400">
              (sugestão automática: {principal.contaCodigo} — {principal.contaNome})
            </span>
          )}
        </div>
      ) : null}

      {semSugestao ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 w-full">
            Sem sugestão automática — escolha a conta ou classifique no{' '}
            <button
              type="button"
              className="text-indigo-700 dark:text-indigo-300 font-medium hover:underline"
              onClick={() =>
                navigate(`/financeiro/extrato?busca=${encodeURIComponent(lancamento.descricao ?? '')}`)
              }
            >
              extrato
            </button>
            .
          </p>
          <select
            className="text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5"
            value={contaEscolhidaId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              setContaEscolhidaId(id || null);
            }}
          >
            <option value="">Escolher conta ▼</option>
            {contas
              .filter((c) => String(c.codigo ?? '').toUpperCase() !== 'N')
              .map((c) => (
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
              onClick={() => setContaEscolhidaId(alt.contaContabilId)}
              className={`inline-flex rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                String(contaEscolhidaId) === String(alt.contaContabilId)
                  ? 'ring-2 ring-blue-500 ring-offset-1'
                  : ''
              }`}
              title={alt.rotuloVinculo || alt.contaNome}
            >
              <ContaBadge codigo={alt.contaCodigo} />
            </button>
          ))}
          <select
            className="text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5"
            value={contaEscolhidaId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              setContaEscolhidaId(id || null);
            }}
          >
            <option value="">Outra ▼</option>
            {contas
              .filter((c) => String(c.codigo ?? '').toUpperCase() !== 'N')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.nome}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        {contaAtiva ? (
          <button
            type="button"
            disabled={busy || !codigoAprovar}
            onClick={() => handleAprovar()}
            style={varsCorConta(codigoAprovar)}
            className={`inline-flex items-center gap-1 rounded-md font-medium disabled:opacity-50 ${CLASSE_BOTAO_APROVAR_CONTA} text-sm px-4 py-2`}
          >
            <Check className="w-4 h-4" />
            Aprovar {codigoAprovar}
          </button>
        ) : null}
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
        {onRefatorar ? (
          <button
            type="button"
            disabled={busy || refatorando}
            onClick={onRefatorar}
            title="Recalcula a sugestão com as regras de classificação atuais"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refatorando ? 'animate-spin' : ''}`} />
            {refatorando ? 'Refatorando…' : 'Refatorar'}
          </button>
        ) : null}
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
