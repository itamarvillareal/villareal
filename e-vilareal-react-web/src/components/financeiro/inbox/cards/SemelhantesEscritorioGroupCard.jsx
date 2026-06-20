import { Check, ChevronDown, ChevronUp, SkipForward } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { navegarExtratoSemelhanteItem } from '../../extrato/extratoDeepLink.js';
import { ContaBadge } from '../../shared/ContaBadge.jsx';
import { CLASSE_BORDA_CONTA, CLASSE_BOTAO_APROVAR_CONTA, varsCorConta } from '../../shared/contaCores.js';
import { formatDataBrCompleta, formatMoeda } from '../../shared/financeiroFormat.js';
import { ValorText } from '../../shared/ValorText.jsx';

const AMOSTRA = 3;

const ROTULO_ORIGEM = {
  HISTORICO: 'Histórico (descrição + valor + banco)',
  CALCULO_PARCELA: 'Cálculos — parcela com valor e data',
  NOME_PESSOA: 'Nome cadastrado na descrição',
};

const ROTULO_CONFIANCA = {
  ALTA: 'Alta confiança',
  MEDIA: 'Média confiança',
  BAIXA: 'Baixa confiança',
};

function classeConfianca(conf) {
  const c = String(conf ?? '').toUpperCase();
  if (c === 'ALTA') return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
  if (c === 'MEDIA') return 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
  return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
}

function rotuloVinculo(item) {
  const cod = String(item?.sugestaoCodigoCliente ?? '').trim();
  const proc = String(item?.sugestaoProcessoNumero ?? '').trim();
  if (cod && proc) return `cód. ${cod} · proc. ${proc}`;
  if (cod) return `cód. ${cod}`;
  if (proc) return `proc. ${proc}`;
  return '—';
}

export function SemelhantesEscritorioGroupCard({
  grupo,
  onAprovarGrupo,
  onAprovarItem,
  onRejeitarGrupo,
  onRejeitarItem,
  onPularGrupo,
  fading,
  busy,
}) {
  const [expandido, setExpandido] = useState(false);
  const itens = grupo?.itens ?? [];
  const n = itens.length;
  const amostra = itens.slice(0, AMOSTRA);
  const listaExibida = expandido ? itens : amostra;
  const codigo = 'A';
  const estiloConta = varsCorConta(codigo);
  const borderLeft = CLASSE_BORDA_CONTA;

  const periodo = useMemo(() => {
    const datas = itens.map((i) => i.dataLancamento).filter(Boolean).sort();
    if (!datas.length) return '';
    const a = formatDataBrCompleta(datas[0]);
    const b = formatDataBrCompleta(datas[datas.length - 1]);
    return a === b ? a : `${a} – ${b}`;
  }, [itens]);

  const navigate = useNavigate();
  const abrirExtrato = useCallback(
    (item) => {
      navegarExtratoSemelhanteItem(navigate, item, grupo);
    },
    [navigate, grupo],
  );

  return (
    <article
      className={`rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 mb-3 bg-white dark:bg-slate-900 hover:shadow-sm transition-all duration-300 ${borderLeft} ${
        fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'
      }`}
      style={estiloConta}
    >
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={grupo?.descricaoExemplo}>
            GRUPO: «{grupo?.descricaoExemplo ?? '—'}» — {grupo?.bancoNome ?? 'Banco'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {n.toLocaleString('pt-BR')} pendente{n !== 1 ? 's' : ''} · {formatMoeda(grupo?.valor)}
            {grupo?.origem === 'HISTORICO'
              ? ` · histórico ${Number(grupo?.qtdHistorico ?? 0).toLocaleString('pt-BR')}×`
              : null}
            {periodo ? ` · ${periodo}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border ${classeConfianca(grupo?.confianca ?? itens[0]?.confianca)}`}
            >
              {ROTULO_CONFIANCA[String(grupo?.confianca ?? itens[0]?.confianca ?? '').toUpperCase()] ??
                'Sugestão'}
            </span>
            <span className="text-[10px] text-violet-700 dark:text-violet-300">
              {ROTULO_ORIGEM[String(grupo?.origem ?? itens[0]?.origem ?? '').toUpperCase()] ??
                'Conta Escritório'}
            </span>
          </div>
          {itens[0]?.descricaoRegra ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{itens[0].descricaoRegra}</p>
          ) : (
            <p className="text-xs text-violet-700 dark:text-violet-300">
              Conta Escritório — pareamento 1:1 por descrição + valor quando há histórico idêntico.
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 shrink-0 min-w-[150px]">
          <ContaBadge codigo={codigo} size="sm" />
          <button
            type="button"
            disabled={busy || n === 0}
            onClick={() => onAprovarGrupo?.(grupo)}
            className={`text-xs px-3 py-2 rounded-md disabled:opacity-50 w-full font-medium text-white ${CLASSE_BOTAO_APROVAR_CONTA}`}
            style={estiloConta}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Vincular {n} na conta A
            </span>
          </button>
          <button
            type="button"
            disabled={busy || n === 0}
            onClick={() => onRejeitarGrupo?.(itens)}
            className="text-xs px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/70 disabled:opacity-50 w-full"
            title="Grava a rejeição — esta sugestão não volta a aparecer"
          >
            Rejeitar sugestão
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPularGrupo?.(itens.map((i) => i.lancamentoId))}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 w-full inline-flex items-center justify-center gap-1"
            title="Oculta só nesta sessão — reaparece ao recarregar"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Pular (temporário)
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="py-1.5 pr-2 font-medium">Data</th>
              <th className="py-1.5 pr-2 font-medium">Descrição</th>
              <th className="py-1.5 pr-2 font-medium">Valor</th>
              <th className="py-1.5 pr-2 font-medium">Sugestão (cód. + proc.)</th>
              <th className="py-1.5 pr-2 font-medium">Origem</th>
              <th className="py-1.5 pr-2 font-medium">Ref.</th>
              <th className="py-1.5 font-medium w-[6.5rem]" />
            </tr>
          </thead>
          <tbody>
            {listaExibida.map((item) => (
              <tr
                key={item.lancamentoId}
                className="border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                onDoubleClick={() => abrirExtrato(item)}
                title="Duplo clique: abrir extrato do banco neste lançamento"
              >
                <td className="py-2 pr-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                  {item.dataLancamento ? formatDataBrCompleta(item.dataLancamento) : '—'}
                </td>
                <td className="py-2 pr-2 max-w-[14rem] truncate text-slate-800 dark:text-slate-200" title={item.descricao}>
                  {item.descricao ?? '—'}
                </td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  <ValorText valor={item.valor} />
                </td>
                <td className="py-2 pr-2 text-violet-800 dark:text-violet-200">
                  <div>{rotuloVinculo(item)}</div>
                  {item.sugestaoParteCliente || item.sugestaoParteOposta ? (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={`${item.sugestaoParteCliente ?? ''} x ${item.sugestaoParteOposta ?? ''}`}>
                      {item.sugestaoParteCliente ?? '—'} x {item.sugestaoParteOposta ?? '—'}
                    </div>
                  ) : null}
                  {item.totalPendenteChave > 1 ? (
                    <div className="text-[10px] text-slate-400">
                      par {item.indicePar}/{Math.min(item.totalPendenteChave, item.totalHistoricoChave)}
                    </div>
                  ) : null}
                </td>
                <td className="py-2 pr-2 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[10px] max-w-[8rem] truncate" title={item.descricaoRegra}>
                  {ROTULO_ORIGEM[String(item.origem ?? '').toUpperCase()] ?? item.origem ?? '—'}
                </td>
                <td className="py-2 pr-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {item.referenciaHistoricoData
                    ? formatDataBrCompleta(item.referenciaHistoricoData)
                    : item.descricaoRegra
                      ? '—'
                      : '—'}
                </td>
                <td className="py-2">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAprovarItem?.(item);
                      }}
                      className="text-[11px] px-2 py-1 rounded border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50"
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRejeitarItem?.(item);
                      }}
                      className="text-[11px] px-2 py-1 rounded border border-red-200 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                    >
                      Rejeitar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {n > AMOSTRA ? (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          {expandido ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Ver todos os {n} lançamentos
            </>
          )}
        </button>
      ) : null}
    </article>
  );
}
