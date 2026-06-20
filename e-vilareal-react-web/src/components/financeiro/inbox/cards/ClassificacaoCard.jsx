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
  dense = false,
  omitDescricao = false,
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

  const impedirDuploClique = (e) => e.stopPropagation();

  const paddingCard = dense ? 'px-3 py-1.5 mb-1.5' : 'px-3 py-2 mb-2';

  return (
    <article
      className={`rounded-lg border border-[var(--color-border-tertiary,#e2e8f0)] dark:border-slate-700 ${paddingCard} bg-white dark:bg-slate-900 hover:shadow-sm transition-all duration-300 cursor-pointer leading-tight ${borderLeft} ${
        focused ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950' : ''
      } ${fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'}`}
      style={estiloBorda}
      onDoubleClick={abrirExtrato}
      title="Duplo clique: abrir extrato do banco neste lançamento"
    >
      <div className="flex items-center gap-2 min-w-0">
        <label
          className="flex items-center shrink-0 cursor-pointer"
          onDoubleClick={impedirDuploClique}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(lancamento.id, e.target.checked)}
            className="rounded border-slate-300"
          />
        </label>
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
            {lancamento.dataExibicao}
          </span>
          {lancamento.bancoNome ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
              {lancamento.bancoNome}
            </span>
          ) : null}
          {!omitDescricao ? (
            <p
              className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate min-w-0 flex-1"
              title={lancamento.descricao}
            >
              {lancamento.descricao}
            </p>
          ) : (
            <span className="flex-1 min-w-0" />
          )}
          <span className="shrink-0">
            <ValorText valor={lancamento.valor} natureza={lancamento.natureza} />
          </span>
        </div>
      </div>

      {principal ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs pl-6">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">
            {contaEscolhida ? 'Classificar como:' : 'Sugestão:'}
          </span>
          <ContaBadge codigo={contaAtiva.contaCodigo} title={contaAtiva.contaNome} />
          <span className="text-slate-700 dark:text-slate-200 truncate">{contaAtiva.contaNome}</span>
          {!contaEscolhida ? (
            <>
              <ConfiancaDots nivel={principal.confianca} />
              <span className="text-[11px] italic text-slate-400 truncate">{textoOrigemSugestao(principal)}</span>
              {principal.rotuloVinculo &&
              String(principal.origem ?? '').toUpperCase() !== 'PESSOA_PROCESSO' ? (
                <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 truncate">
                  {principal.rotuloVinculo}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[11px] text-slate-400">
              (sugestão: {principal.contaCodigo} — {principal.contaNome})
            </span>
          )}
        </div>
      ) : null}

      {semSugestao ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Sem sugestão — escolha a conta ou classifique no{' '}
            <button
              type="button"
              className="text-indigo-700 dark:text-indigo-300 font-medium hover:underline"
              onDoubleClick={impedirDuploClique}
              onClick={() =>
                navigate(`/financeiro/extrato?busca=${encodeURIComponent(lancamento.descricao ?? '')}`)
              }
            >
              extrato
            </button>
            .
          </p>
          <select
            className="text-[11px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5"
            value={contaEscolhidaId ?? ''}
            onDoubleClick={impedirDuploClique}
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
        <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-6">
          <span className="text-[11px] text-slate-500 shrink-0">Alternativas:</span>
          {alternativas.map((alt) => (
            <button
              key={`${alt.contaContabilId}-${alt.origem}`}
              type="button"
              disabled={busy}
              onDoubleClick={impedirDuploClique}
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
            className="text-[11px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5"
            value={contaEscolhidaId ?? ''}
            onDoubleClick={impedirDuploClique}
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

      <div className="mt-2 flex flex-wrap gap-1.5 justify-end pl-6" onDoubleClick={impedirDuploClique}>
        {contaAtiva ? (
          <button
            type="button"
            disabled={busy || !codigoAprovar}
            onClick={() => handleAprovar()}
            style={varsCorConta(codigoAprovar)}
            className={`inline-flex items-center gap-1 rounded-md font-medium disabled:opacity-50 ${CLASSE_BOTAO_APROVAR_CONTA} text-xs px-3 py-1.5`}
          >
            <Check className="w-3.5 h-3.5" />
            Aprovar {codigoAprovar}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            navigate(`/financeiro/extrato?busca=${encodeURIComponent(lancamento.descricao ?? '')}`)
          }
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Pencil className="w-3 h-3" />
          Editar
        </button>
        {onRefatorar ? (
          <button
            type="button"
            disabled={busy || refatorando}
            onClick={onRefatorar}
            title="Recalcula a sugestão com as regras de classificação atuais"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refatorando ? 'animate-spin' : ''}`} />
            {refatorando ? 'Refatorando…' : 'Refatorar'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => onPular(lancamento.id)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:underline"
        >
          <SkipForward className="w-3 h-3" />
          Pular
        </button>
      </div>
    </article>
  );
}
