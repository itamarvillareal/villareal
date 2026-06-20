import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { navegarExtratoLancamento } from '../../extrato/extratoDeepLink.js';
import { Check, ChevronDown, ChevronUp, Pencil, RefreshCw, SkipForward } from 'lucide-react';
import { ContaBadge } from '../../shared/ContaBadge.jsx';
import {
  CLASSE_BORDA_CONTA,
  CLASSE_BOTAO_APROVAR_CONTA,
  varsCorConta,
} from '../../shared/contaCores.js';
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

function badgeSecundario(children) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0 whitespace-nowrap">
      {children}
    </span>
  );
}

export function ClassificacaoGroupCard({
  grupo,
  sugestoesMap = {},
  contas = [],
  onAprovarGrupo,
  onAprovar,
  onPularGrupo,
  onRefatorar,
  refatorando = false,
  isSelected,
  onSelectGrupo,
  fading,
  busy,
}) {
  const { sugestao, lancamentos, descricao, banco } = grupo;
  const n = lancamentos.length;
  const [amostraAberta, setAmostraAberta] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [modoRevisar, setModoRevisar] = useState(false);

  const codigo = sugestao?.contaCodigo ?? '—';
  const estiloConta = codigo !== '—' ? varsCorConta(codigo) : undefined;
  const borderLeft =
    codigo !== '—' ? CLASSE_BORDA_CONTA : 'border-l-[3px] border-l-slate-300 dark:border-l-slate-600';
  const periodo = useMemo(() => resumoPeriodoGrupo(lancamentos), [lancamentos]);
  const valores = useMemo(() => resumoValoresGrupo(lancamentos), [lancamentos]);
  const datasDistintas = useMemo(() => {
    const chaves = new Set(
      lancamentos.map((l) => String(l.dataExibicao ?? l.dataLancamento ?? '').trim()).filter(Boolean),
    );
    return chaves.size > 1;
  }, [lancamentos]);
  const listaExibida = useMemo(() => {
    if (!amostraAberta) return [];
    if (expandido || modoRevisar) return lancamentos;
    return lancamentos.slice(0, AMOSTRA);
  }, [amostraAberta, expandido, modoRevisar, lancamentos]);

  const handleAprovarGrupo = () => {
    onAprovarGrupo?.(grupo);
  };

  const handlePular = () => {
    onPularGrupo?.(lancamentos.map((l) => l.id));
  };

  const handleRefatorar = () => {
    onRefatorar?.(lancamentos.map((l) => l.id));
  };

  const navigate = useNavigate();
  const abrirExtrato = useCallback(
    (l) => {
      navegarExtratoLancamento(navigate, l);
    },
    [navigate],
  );

  const linhaMetadados = useMemo(() => {
    const partes = [periodo];
    if (valores.min !== valores.max) {
      partes.push(`R$ ${formatMoeda(valores.min)}–${formatMoeda(valores.max)}`);
    } else if (valores.min > 0) {
      partes.push(`R$ ${formatMoeda(valores.min)}`);
    }
    partes.push(`total R$ ${formatMoeda(valores.total)}`);
    return partes.join(' · ');
  }, [periodo, valores]);

  const cardBase =
    'rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 mb-2 bg-white dark:bg-slate-900 hover:shadow-sm transition-all duration-300 leading-tight';

  if (modoRevisar) {
    return (
      <article
        className={`${cardBase} ${borderLeft} ${fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'}`}
        style={estiloConta}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate min-w-0" title={descricao}>
            Revisar: {descricao}
          </h3>
          <button
            type="button"
            onClick={() => setModoRevisar(false)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline shrink-0"
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
            onRefatorar={() => onRefatorar?.([l.id])}
            refatorando={refatorando}
            isSelected={false}
            onSelect={() => {}}
            busy={busy}
            dense
            omitDescricao
          />
        ))}
      </article>
    );
  }

  return (
    <article
      className={`${cardBase} ${borderLeft} ${fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'}`}
      style={estiloConta}
    >
      <div className="flex items-start gap-2">
        <label className="flex items-center shrink-0 cursor-pointer pt-0.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelectGrupo?.(lancamentos.map((l) => l.id), e.target.checked)}
            className="rounded border-slate-300"
          />
        </label>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate min-w-0 flex-1"
              title={descricao}
            >
              {descricao}
            </h3>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 shrink-0">
              {n} lanç.
            </span>
            {banco ? badgeSecundario(banco) : null}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={linhaMetadados}>
            {linhaMetadados}
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span className="text-slate-500 dark:text-slate-400 shrink-0">Sugestão:</span>
        <ContaBadge codigo={sugestao.contaCodigo} title={sugestao.contaNome} />
        <span className="text-slate-700 dark:text-slate-200 truncate">{sugestao.contaNome}</span>
        <ConfiancaDots nivel={sugestao.confianca} />
        <span className="text-[11px] italic text-slate-400 truncate">{textoOrigemSugestao(sugestao)}</span>
      </div>

      <div className="mt-1.5">
        <button
          type="button"
          onClick={() => {
            setAmostraAberta((v) => {
              const next = !v;
              if (!next) setExpandido(false);
              return next;
            });
          }}
          className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
          aria-expanded={amostraAberta}
        >
          {amostraAberta ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {amostraAberta ? 'Ocultar lançamentos' : `Ver ${n} lançamento${n !== 1 ? 's' : ''}`}
        </button>

        {amostraAberta && listaExibida.length > 0 ? (
          <ul
            className={`mt-1 rounded border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-[11px] ${
              expandido && n > 8 ? 'max-h-40 overflow-y-auto' : ''
            }`}
          >
            {listaExibida.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                onDoubleClick={() => abrirExtrato(l)}
                title="Duplo clique: abrir extrato do banco neste lançamento"
              >
                {datasDistintas ? (
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                    {l.dataExibicao}
                  </span>
                ) : null}
                <span className="flex-1" />
                <ValorText valor={l.valor} natureza={l.natureza} />
              </li>
            ))}
          </ul>
        ) : null}

        {amostraAberta && n > AMOSTRA ? (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
          >
            {expandido ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Ver todos os {n}
              </>
            )}
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={handleAprovarGrupo}
          style={codigo !== '—' ? varsCorConta(codigo) : undefined}
          className={`inline-flex items-center gap-1 rounded-md font-medium text-xs px-3 py-1.5 disabled:opacity-50 ${
            codigo !== '—' ? CLASSE_BOTAO_APROVAR_CONTA : 'bg-slate-500 text-white'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          Aprovar {codigo} para os {n}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setModoRevisar(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Pencil className="w-3 h-3" />
          Revisar
        </button>
        <button
          type="button"
          disabled={busy || refatorando}
          onClick={handleRefatorar}
          title="Recalcula a sugestão com as regras de classificação atuais"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${refatorando ? 'animate-spin' : ''}`} />
          {refatorando ? 'Refatorando…' : 'Refatorar'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handlePular}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:underline"
        >
          <SkipForward className="w-3 h-3" />
          Pular
        </button>
      </div>
    </article>
  );
}
