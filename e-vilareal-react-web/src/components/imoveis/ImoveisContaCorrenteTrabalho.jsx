import { useEffect, useMemo, useState } from 'react';
import { Loader2, Check, RefreshCw } from 'lucide-react';
import {
  mesReferenciaLancamentoParaRelatorio,
  PAPEL_ALUGUEL,
  PAPEL_CREDITO,
  PAPEL_DEBITO,
  PAPEL_DESPESA_REPASSAR,
  PAPEL_OUTRO,
  PAPEL_REPASSE,
  rotuloPapelAdministracao,
} from '../../data/imoveisAdministracaoFinanceiro.js';
import { aplicarSugestoesSemelhantes } from '../../data/imoveisSugestaoSemelhante.js';
import { competenciaValida } from '../../data/imoveisReconciliacao.js';
import {
  referenciaAluguelExtrato,
  rotuloCompetenciaCurta,
} from '../../data/imoveisAluguelChecklist.js';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function corValorNegativo(n) {
  return Number(n) < 0 ? 'text-red-600!' : '';
}

const th =
  'px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200 bg-slate-100 whitespace-nowrap sticky top-0 z-10';
const td = 'px-3 py-2 text-sm text-slate-800 border-b border-slate-100 align-top';

function mesDaDataBr(dataBr) {
  return mesReferenciaLancamentoParaRelatorio({ data: dataBr })?.chave ?? '';
}

function linhaEhAluguelCandidato(t, vinculosPorLancamento) {
  const id = t?.apiId != null ? Number(t.apiId) : NaN;
  if (Number.isFinite(id) && vinculosPorLancamento.get(id)?.papel === 'ALUGUEL') return true;
  return t?.classificacao?.papel === PAPEL_ALUGUEL && Number(t?.valor) > 0;
}

function linhaEhRepasseCandidato(t, vinculosPorLancamento) {
  const id = t?.apiId != null ? Number(t.apiId) : NaN;
  if (Number.isFinite(id) && vinculosPorLancamento.get(id)?.papel === 'REPASSE') return true;
  return t?.classificacao?.papel === PAPEL_REPASSE && Number(t?.valor) < 0;
}

function linhaPassaFiltroCompetencia(t, filtroCompetencia, vinculosPorLancamento) {
  if (!filtroCompetencia) return true;
  const ref = referenciaAluguelExtrato(t, vinculosPorLancamento, mesReferenciaLancamentoParaRelatorio);
  if (ref?.chave === filtroCompetencia) return true;
  const mesPag = mesDaDataBr(t?.data);
  if (mesPag !== filtroCompetencia) return false;
  return (
    linhaEhAluguelCandidato(t, vinculosPorLancamento) ||
    linhaEhRepasseCandidato(t, vinculosPorLancamento)
  );
}

function linhaClassificacaoManual(t, vinculosPorLancamento) {
  const id = Number(t?.apiId);
  if (Number.isFinite(id) && vinculosPorLancamento.get(id)) return false;
  if (linhaEhAluguelCandidato(t, vinculosPorLancamento)) return false;
  if (linhaEhRepasseCandidato(t, vinculosPorLancamento)) return false;
  const p = t?.classificacao?.papel;
  return (
    p === PAPEL_DEBITO ||
    p === PAPEL_CREDITO ||
    p === PAPEL_OUTRO ||
    p === PAPEL_DESPESA_REPASSAR
  );
}

function opcoesPapelManual(t) {
  const v = Number(t?.valor);
  if (v > 0) {
    return [
      { value: '', label: 'Escolher…' },
      { value: 'ALUGUEL', label: 'Aluguel', papelApi: 'ALUGUEL' },
      { value: 'OUTROS', label: 'Outros…', papelApi: 'ALUGUEL', rotuloCustom: true },
    ];
  }
  if (v < 0) {
    return [
      { value: '', label: 'Escolher…' },
      { value: 'REPASSE', label: 'Repasse', papelApi: 'REPASSE' },
      { value: 'IPTU', label: 'IPTU', papelApi: 'DESPESA', rotulo: 'IPTU' },
      { value: 'CONDOMINIO', label: 'Condomínio', papelApi: 'DESPESA', rotulo: 'Condomínio' },
      { value: 'OUTROS', label: 'Outros…', papelApi: 'DESPESA', rotuloCustom: true },
    ];
  }
  return [{ value: '', label: 'Escolher…' }];
}

function resolveEscolhaManual(escolhido, descricaoOutros, t) {
  const opcoes = opcoesPapelManual(t);
  const opt = opcoes.find((o) => o.value === escolhido);
  if (!opt?.value) return null;
  if (opt.rotuloCustom) {
    const txt = String(descricaoOutros ?? '').trim();
    if (!txt) return null;
    return { papel: opt.papelApi, rotuloClassificacao: txt };
  }
  return {
    papel: opt.papelApi,
    rotuloClassificacao: opt.rotulo || null,
  };
}

function escolhaManualPronta(escolhido, descricaoOutros, t) {
  return resolveEscolhaManual(escolhido, descricaoOutros, t) != null;
}

function papelManualInicial(t) {
  if (t?.classificacao?.papel === PAPEL_DESPESA_REPASSAR) return 'IPTU';
  return '';
}

function rotuloVinculoExibicao(vinc) {
  const rotulo = String(vinc?.rotuloClassificacao ?? '').trim();
  if (rotulo) return `${rotulo} ✓`;
  switch (String(vinc?.papel ?? '').toUpperCase()) {
    case 'ALUGUEL':
      return 'Aluguel ✓';
    case 'REPASSE':
      return 'Repasse ✓';
    case 'DESPESA':
      return 'Despesa ✓';
    default:
      return 'Vinculado ✓';
  }
}

function rotuloBotaoVincular(escolhido, descricaoOutros, t) {
  const resolved = resolveEscolhaManual(escolhido, descricaoOutros, t);
  if (!resolved) return 'vincular';
  const rotulo = resolved.rotuloClassificacao || rotuloPapelVinculoApi(resolved.papel);
  return rotulo.toLowerCase();
}

function rotuloPapelVinculoApi(papel) {
  switch (String(papel ?? '').toUpperCase()) {
    case 'ALUGUEL':
      return 'Aluguel';
    case 'REPASSE':
      return 'Repasse';
    case 'DESPESA':
      return 'Despesa';
    default:
      return 'Vínculo';
  }
}

function classeBotaoVincular(escolhido, t) {
  const opt = opcoesPapelManual(t).find((o) => o.value === escolhido);
  const papel = opt?.papelApi ?? escolhido;
  if (papel === 'ALUGUEL') return 'bg-indigo-600 hover:bg-indigo-700';
  if (papel === 'DESPESA' || escolhido === 'IPTU' || escolhido === 'CONDOMINIO' || escolhido === 'OUTROS') {
    return 'bg-orange-600 hover:bg-orange-700';
  }
  return 'bg-slate-700 hover:bg-slate-800';
}

const selectClassificacaoCls =
  'rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-800 w-full min-w-[10rem] max-w-[14rem]';
const inputOutrosCls =
  'mt-1 rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-800 w-full min-w-[10rem] max-w-[14rem]';

/**
 * Conta corrente do imóvel — base bruta de trabalho (classificar/vincular na própria linha).
 */
export function ImoveisContaCorrenteTrabalho({
  transacoes = [],
  vinculosPorLancamento,
  vinculandoLancamentoId = null,
  linhasVinculadasRecentes,
  filtroCompetencia,
  onLimparFiltro,
  competenciaMin,
  competenciaMax,
  contratoId,
  repasseInterno,
  salvando,
  gerandoRepasses,
  onConfirmarAluguel,
  onConfirmarRepasse,
  onConfirmarVinculoManual,
  onMoverCompetencia,
  onDesvincular,
  onGerarRepasse,
  codigoCliente,
  proc,
}) {
  const [refPorLancamento, setRefPorLancamento] = useState({});
  const [papelEscolhidoPorLancamento, setPapelEscolhidoPorLancamento] = useState({});
  const [descricaoOutrosPorLancamento, setDescricaoOutrosPorLancamento] = useState({});
  const [classificacaoExtra, setClassificacaoExtra] = useState({});
  const [msgSemelhantes, setMsgSemelhantes] = useState('');
  const [mostrarTodos, setMostrarTodos] = useState(true);
  const [busca, setBusca] = useState('');

  const lista = Array.isArray(transacoes) ? transacoes : [];

  const listaEfetiva = useMemo(() => {
    return lista.map((t) => {
      const id = Number(t?.apiId);
      const extra = Number.isFinite(id) ? classificacaoExtra[id] : null;
      if (!extra) return t;
      return { ...t, classificacao: { ...t.classificacao, ...extra } };
    });
  }, [lista, classificacaoExtra]);

  useEffect(() => {
    setClassificacaoExtra({});
    setMsgSemelhantes('');
  }, [transacoes]);

  useEffect(() => {
    if (!msgSemelhantes) return;
    const t = window.setTimeout(() => setMsgSemelhantes(''), 6000);
    return () => window.clearTimeout(t);
  }, [msgSemelhantes]);

  function executarSugestoesSemelhantes() {
    const out = aplicarSugestoesSemelhantes({
      transacoes: listaEfetiva,
      vinculosPorLancamento,
      escolhasManuais: papelEscolhidoPorLancamento,
      descricoesOutros: descricaoOutrosPorLancamento,
      classificacoesExtras: classificacaoExtra,
    });
    setClassificacaoExtra(out.classificacoesExtras);
    setPapelEscolhidoPorLancamento(out.escolhasManuais);
    setDescricaoOutrosPorLancamento(out.descricoesOutros);
    if (out.aplicadas > 0) {
      setMsgSemelhantes(
        `${out.aplicadas} sugest${out.aplicadas === 1 ? 'ão' : 'ões'} aplicada${out.aplicadas === 1 ? '' : 's'} por valor semelhante.`,
      );
    } else {
      setMsgSemelhantes('Nenhuma correspondência nova encontrada. Classifique ao menos um lançamento antes.');
    }
  }

  useEffect(() => {
    const next = {};
    for (const t of lista) {
      const id = t?.apiId != null ? Number(t.apiId) : null;
      if (!Number.isFinite(id)) continue;
      const ref = referenciaAluguelExtrato(t, vinculosPorLancamento, mesReferenciaLancamentoParaRelatorio);
      next[id] =
        ref?.chave ||
        filtroCompetencia ||
        mesDaDataBr(t?.data) ||
        '';
    }
    setRefPorLancamento(next);

    setPapelEscolhidoPorLancamento((prev) => {
      const merged = { ...prev };
      for (const t of listaEfetiva) {
        const id = t?.apiId != null ? Number(t.apiId) : null;
        if (!Number.isFinite(id)) continue;
        if (vinculosPorLancamento.get(id)) {
          delete merged[id];
          continue;
        }
        if (!linhaClassificacaoManual(t, vinculosPorLancamento)) {
          delete merged[id];
          continue;
        }
        if (merged[id] == null || merged[id] === '') {
          const inicial = papelManualInicial(t);
          if (inicial) merged[id] = inicial;
        }
      }
      return merged;
    });
  }, [listaEfetiva, vinculosPorLancamento, filtroCompetencia]);

  const visiveis = useMemo(() => {
    let rows = listaEfetiva;
    if (!mostrarTodos && filtroCompetencia) {
      rows = rows.filter((t) => linhaPassaFiltroCompetencia(t, filtroCompetencia, vinculosPorLancamento));
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      rows = rows.filter((t) => {
        const blob = `${t.descricao} ${t.nomeBanco} ${t.data} ${t.valor}`.toLowerCase();
        return blob.includes(q);
      });
    }
    return rows;
  }, [listaEfetiva, mostrarTodos, filtroCompetencia, vinculosPorLancamento, busca]);

  const pendentesAluguel = useMemo(() => {
    let n = 0;
    for (const t of listaEfetiva) {
      const id = Number(t?.apiId);
      if (!Number.isFinite(id)) continue;
      if (vinculosPorLancamento.get(id)?.papel === 'ALUGUEL') continue;
      if (t.classificacao?.papel === PAPEL_ALUGUEL && Number(t.valor) > 0) n++;
    }
    return n;
  }, [listaEfetiva, vinculosPorLancamento]);

  const pendentesRepasse = useMemo(() => {
    let n = 0;
    for (const t of listaEfetiva) {
      const id = Number(t?.apiId);
      if (!Number.isFinite(id)) continue;
      if (vinculosPorLancamento.get(id)?.papel === 'REPASSE') continue;
      if (t.classificacao?.papel === PAPEL_REPASSE && Number(t.valor) < 0) n++;
    }
    return n;
  }, [listaEfetiva, vinculosPorLancamento]);

  function celulaRefMes(t) {
    const id = t?.apiId != null ? Number(t.apiId) : NaN;
    const vinc = Number.isFinite(id) ? vinculosPorLancamento.get(id) : null;
    const ref = referenciaAluguelExtrato(t, vinculosPorLancamento, mesReferenciaLancamentoParaRelatorio);
    const refMes = refPorLancamento[id] ?? ref?.chave ?? '';

    if (vinc?.papel === 'ALUGUEL' || vinc?.papel === 'REPASSE' || vinc?.papel === 'DESPESA') {
      return (
        <input
          type="month"
          value={vinc.competenciaMes || refMes}
          min={competenciaMin}
          max={competenciaMax}
          disabled={salvando}
          onChange={(e) => {
            const nova = e.target.value;
            if (!competenciaValida(nova) || nova === vinc.competenciaMes) return;
            onMoverCompetencia(
              { vinculoId: vinc.vinculoId, lancamentoFinanceiroId: id, papel: vinc.papel },
              nova,
            );
          }}
          className={`rounded border bg-white px-2 py-1 text-xs tabular-nums w-full min-w-[8rem] disabled:opacity-60 ${
            vinc.papel === 'ALUGUEL'
              ? 'border-emerald-300'
              : vinc.papel === 'DESPESA'
                ? 'border-orange-300'
                : 'border-emerald-300'
          }`}
          aria-label="Mês de referência vinculado"
        />
      );
    }

    const manual = linhaClassificacaoManual(t, vinculosPorLancamento);
    const escolhido = papelEscolhidoPorLancamento[id] ?? papelManualInicial(t);
    const descricaoOutros = descricaoOutrosPorLancamento[id] ?? '';

    if (manual && escolhido) {
      const resolved = resolveEscolhaManual(escolhido, descricaoOutros, t);
      return (
        <input
          type="month"
          value={refMes}
          min={competenciaMin}
          max={competenciaMax}
          disabled={salvando}
          onChange={(e) => setRefPorLancamento((prev) => ({ ...prev, [id]: e.target.value }))}
          className={`rounded border bg-white px-2 py-1 text-xs tabular-nums w-full min-w-[8rem] disabled:opacity-60 ${
            resolved?.papel === 'ALUGUEL'
              ? 'border-indigo-300'
              : resolved?.papel === 'DESPESA'
                ? 'border-orange-300'
                : escolhido === 'REPASSE'
                  ? 'border-slate-400'
                  : 'border-slate-300'
          }`}
          aria-label="Mês de referência para vincular"
        />
      );
    }

    if (linhaEhRepasseCandidato(t, vinculosPorLancamento)) {
      return (
        <input
          type="month"
          value={refMes}
          min={competenciaMin}
          max={competenciaMax}
          disabled={salvando}
          onChange={(e) => setRefPorLancamento((prev) => ({ ...prev, [id]: e.target.value }))}
          className="rounded border border-slate-400 bg-white px-2 py-1 text-xs tabular-nums w-full min-w-[8rem]"
          aria-label="Mês de referência do repasse"
        />
      );
    }

    if (linhaEhAluguelCandidato(t, vinculosPorLancamento)) {
      return (
        <input
          type="month"
          value={refMes}
          min={competenciaMin}
          max={competenciaMax}
          disabled={salvando}
          onChange={(e) => setRefPorLancamento((prev) => ({ ...prev, [id]: e.target.value }))}
          className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs tabular-nums w-full min-w-[8rem]"
          aria-label="Mês de referência do aluguel"
        />
      );
    }

    if (ref) {
      return (
        <span className={`text-xs tabular-nums ${ref.vinculado ? 'text-emerald-800 font-semibold' : 'text-amber-800'}`}>
          {ref.rotulo}
          {!ref.vinculado ? <span className="font-normal text-amber-700"> (sug.)</span> : null}
        </span>
      );
    }
    return <span className="text-slate-400 text-xs">—</span>;
  }

  function celulaAcao(t) {
    const id = t?.apiId != null ? Number(t.apiId) : NaN;
    if (!Number.isFinite(id) || !contratoId) return null;
    const vinc = vinculosPorLancamento.get(id);
    const refMes = refPorLancamento[id] ?? '';
    const emVinculo = vinculandoLancamentoId === id;
    const recémVinculado = linhasVinculadasRecentes?.has?.(id);

    if (vinc?.papel) {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {recémVinculado ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
              <Check className="w-3.5 h-3.5" aria-hidden />
              Vinculado
            </span>
          ) : null}
          <button
            type="button"
            disabled={salvando}
            onClick={() => onDesvincular(vinc.vinculoId)}
            className="px-2 py-1 rounded border border-red-300 text-red-700 text-[11px] hover:bg-red-50 disabled:opacity-40"
          >
            Desvincular
          </button>
        </div>
      );
    }

    const manual = linhaClassificacaoManual(t, vinculosPorLancamento);
    const escolhido = papelEscolhidoPorLancamento[id] ?? papelManualInicial(t);
    const descricaoOutros = descricaoOutrosPorLancamento[id] ?? '';
    const resolved = resolveEscolhaManual(escolhido, descricaoOutros, t);
    if (manual && resolved && onConfirmarVinculoManual) {
      return (
        <button
          type="button"
          disabled={salvando || emVinculo || !competenciaValida(refMes)}
          onClick={() => {
            const resolved = resolveEscolhaManual(escolhido, descricaoOutros, t);
            if (!resolved) return;
            onConfirmarVinculoManual(
              { lancamentoFinanceiroId: id, classificaAoConfirmar: true },
              resolved.papel,
              refMes,
              resolved.rotuloClassificacao,
            );
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-white text-[11px] font-semibold disabled:opacity-40 whitespace-nowrap ${classeBotaoVincular(escolhido, t)}`}
        >
          {emVinculo ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : null}
          {emVinculo
            ? 'Vinculando…'
            : `Vincular ${rotuloBotaoVincular(escolhido, descricaoOutros, t)}`}
        </button>
      );
    }

    if (linhaEhRepasseCandidato(t, vinculosPorLancamento)) {
      const adocao = !vinc && t.classificacao?.papel === PAPEL_REPASSE;
      return (
        <button
          type="button"
          disabled={salvando || emVinculo || !competenciaValida(refMes)}
          onClick={() =>
            onConfirmarRepasse({ lancamentoFinanceiroId: id, classificaAoConfirmar: adocao }, refMes)
          }
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-700 text-white text-[11px] font-semibold hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
        >
          {emVinculo ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : null}
          {emVinculo ? 'Vinculando…' : 'Vincular repasse'}
        </button>
      );
    }

    if (linhaEhAluguelCandidato(t, vinculosPorLancamento)) {
      const adocao = !vinc && t.classificacao?.papel === PAPEL_ALUGUEL;
      return (
        <button
          type="button"
          disabled={salvando || emVinculo || !competenciaValida(refMes)}
          onClick={() =>
            onConfirmarAluguel({ lancamentoFinanceiroId: id, classificaAoConfirmar: adocao }, refMes)
          }
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-40 whitespace-nowrap"
        >
          {emVinculo ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : null}
          {emVinculo ? 'Vinculando…' : 'Vincular aluguel'}
        </button>
      );
    }

    return <span className="text-slate-400 text-xs">—</span>;
  }

  function celulaClassificacao(t) {
    const id = t?.apiId != null ? Number(t.apiId) : NaN;
    const vinc = Number.isFinite(id) ? vinculosPorLancamento.get(id) : null;
    const { papel } = t.classificacao || {};

    if (vinc?.papel) {
      const tom =
        vinc.papel === 'ALUGUEL'
          ? 'text-emerald-800'
          : vinc.papel === 'DESPESA' || vinc.rotuloClassificacao
            ? 'text-orange-800'
            : 'text-slate-800';
      return (
        <span className={`${tom} font-semibold text-xs`}>{rotuloVinculoExibicao(vinc)}</span>
      );
    }

    if (linhaClassificacaoManual(t, vinculosPorLancamento)) {
      const opcoes = opcoesPapelManual(t);
      const escolhido = papelEscolhidoPorLancamento[id] ?? papelManualInicial(t);
      const descricaoOutros = descricaoOutrosPorLancamento[id] ?? '';
      return (
        <div className="space-y-1">
          <select
            value={escolhido}
            disabled={salvando}
            onChange={(e) => {
              const next = e.target.value;
              setPapelEscolhidoPorLancamento((prev) => ({ ...prev, [id]: next }));
              if (next !== 'OUTROS') {
                setDescricaoOutrosPorLancamento((prev) => {
                  const copy = { ...prev };
                  delete copy[id];
                  return copy;
                });
              }
            }}
            className={selectClassificacaoCls}
            aria-label="Tipo do lançamento"
          >
            {opcoes.map((o) => (
              <option key={o.value || 'vazio'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {escolhido === 'OUTROS' ? (
            <input
              type="text"
              value={descricaoOutros}
              disabled={salvando}
              placeholder="Descreva o lançamento…"
              maxLength={120}
              onChange={(e) =>
                setDescricaoOutrosPorLancamento((prev) => ({ ...prev, [id]: e.target.value }))
              }
              className={inputOutrosCls}
              aria-label="Descrição do lançamento (Outros)"
            />
          ) : null}
        </div>
      );
    }

    if (papel === PAPEL_ALUGUEL) {
      return <span className="text-amber-800 text-xs">Sugestão: aluguel</span>;
    }
    if (papel === PAPEL_REPASSE) {
      return <span className="text-amber-800 text-xs">Sugestão: repasse</span>;
    }
    return <span className="text-slate-600 text-xs">{rotuloPapelAdministracao(papel)}</span>;
  }

  return (
    <div
      id="extrato-imoveis"
      className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden scroll-mt-4"
    >
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/90 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Conta corrente</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Base de trabalho · Cod. {codigoCliente} · Proc. {proc} · {lista.length} lançamentos
              {pendentesAluguel > 0 ? (
                <>
                  {' '}
                  · <strong className="text-amber-800">{pendentesAluguel} aluguel(is) pendente(s)</strong>
                </>
              ) : null}
              {pendentesRepasse > 0 ? (
                <>
                  {' '}
                  · <strong className="text-amber-800">{pendentesRepasse} repasse(s) pendente(s)</strong>
                </>
              ) : null}
            </p>
          </div>
          {repasseInterno && filtroCompetencia ? (
            <button
              type="button"
              disabled={gerandoRepasses}
              onClick={() => onGerarRepasse(filtroCompetencia)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40"
            >
              {gerandoRepasses ? 'Gerando…' : 'Gerar repasse interno'}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar descrição, banco…"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs min-w-[10rem] flex-1 max-w-xs"
          />
          <button
            type="button"
            disabled={salvando}
            onClick={executarSugestoesSemelhantes}
            title="Analisa lançamentos já classificados e sugere o mesmo tipo para valores iguais"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-indigo-300 bg-indigo-50 text-indigo-900 text-xs font-medium hover:bg-indigo-100 disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden />
            Sugerir semelhantes
          </button>
          {filtroCompetencia ? (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-100 text-indigo-900 text-[11px] font-medium">
                Filtro: {rotuloCompetenciaCurta(filtroCompetencia)}
                <button
                  type="button"
                  onClick={onLimparFiltro}
                  className="ml-1 text-indigo-700 hover:underline"
                  aria-label="Limpar filtro de competência"
                >
                  ×
                </button>
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!mostrarTodos}
                  onChange={(e) => setMostrarTodos(!e.target.checked)}
                />
                Restringir ao mês filtrado
              </label>
            </>
          ) : null}
        </div>
        {msgSemelhantes ? (
          <p className="text-[11px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
            {msgSemelhantes}
          </p>
        ) : null}
        <p className="text-[11px] text-slate-500">
          Classifique um lançamento (ou vincule) e use <strong>Sugerir semelhantes</strong> para propagar ao mesmo valor.
          Em <strong>Débito/Crédito (classificar)</strong>, escolha o tipo, informe a descrição em{' '}
          <strong>Outros</strong>, preencha <strong>Ref. mês</strong> e clique <strong>Vincular</strong>.
        </p>
      </div>

      <div className="overflow-x-auto max-h-[min(70vh,900px)] overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[960px]">
          <thead>
            <tr>
              <th className={th}>Data</th>
              <th className={th}>Banco</th>
              <th className={th}>Descrição</th>
              <th className={`${th} text-right`}>Valor</th>
              <th className={th}>Ref. mês</th>
              <th className={th}>Classificação</th>
              <th className={th}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={7} className={`${td} text-center text-slate-500 py-8`}>
                  Nenhum lançamento neste filtro.
                </td>
              </tr>
            ) : (
              visiveis.map((t, idx) => {
                const isDesp =
                  t.classificacao?.papel === PAPEL_DESPESA_REPASSAR || t.classificacao?.despesaRepassarAoLocador;
                const ref = referenciaAluguelExtrato(
                  t,
                  vinculosPorLancamento,
                  mesReferenciaLancamentoParaRelatorio,
                );
                const id = Number(t?.apiId);
                const destacado = filtroCompetencia && linhaPassaFiltroCompetencia(t, filtroCompetencia, vinculosPorLancamento);
                const recémVinculado = linhasVinculadasRecentes?.has?.(id);
                const rowClass = recémVinculado
                  ? 'bg-emerald-100/90 ring-2 ring-emerald-400 ring-inset transition-colors duration-500'
                  : isDesp
                  ? 'bg-orange-50/60'
                  : vinculosPorLancamento.get(id)?.papel === 'ALUGUEL'
                    ? 'bg-emerald-50/50'
                    : vinculosPorLancamento.get(id)?.papel === 'REPASSE'
                      ? 'bg-slate-50/80'
                      : vinculosPorLancamento.get(id)?.papel === 'DESPESA'
                        ? 'bg-orange-50/50'
                        : t.classificacao?.papel === PAPEL_ALUGUEL
                        ? 'bg-amber-50/40'
                        : t.classificacao?.papel === PAPEL_REPASSE
                          ? 'bg-amber-50/40'
                          : destacado
                            ? 'ring-1 ring-inset ring-indigo-200'
                            : '';
                return (
                  <tr key={`${t.apiId ?? t.numero}-${t.nomeBanco}-${t.data}-${idx}`} className={rowClass}>
                    <td className={`${td} tabular-nums whitespace-nowrap`}>{t.data}</td>
                    <td className={`${td} text-xs`}>{t.nomeBanco}</td>
                    <td className={td}>{t.descricao}</td>
                    <td
                      className={`${td} text-right tabular-nums font-medium whitespace-nowrap ${corValorNegativo(t.valor)}`}
                    >
                      {formatBRL(t.valor)}
                    </td>
                    <td className={td}>{celulaRefMes(t)}</td>
                    <td className={td}>{celulaClassificacao(t)}</td>
                    <td className={td}>{celulaAcao(t)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <footer className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-500">
        Exibindo {visiveis.length} de {lista.length} lançamentos
      </footer>
    </div>
  );
}
