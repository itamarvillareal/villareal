import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { podeCancelarAgendamentoProtocolo } from '../../api/peticoesProjudiApi.js';

const TZ = 'America/Sao_Paulo';
const ARQUIVOS_VISIVEIS_PADRAO = 3;

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: TZ });
  } catch {
    return iso;
  }
}

function dataReferenciaHistorico(peticao) {
  return peticao.protocoladoEm || peticao.criadoEm || null;
}

function chaveAnoMes(iso) {
  if (!iso) return { ano: 0, mes: 0 };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { ano: 0, mes: 0 };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const ano = Number(parts.find((x) => x.type === 'year')?.value ?? 0);
  const mes = Number(parts.find((x) => x.type === 'month')?.value ?? 0);
  return { ano, mes };
}

function labelMes(ano, mes) {
  if (!ano || !mes) return 'Sem data';
  const raw = new Date(Date.UTC(ano, mes - 1, 15)).toLocaleDateString('pt-BR', {
    timeZone: TZ,
    month: 'long',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function chaveGrupoMes(anoLabel, mes) {
  return `${anoLabel}-${mes}`;
}

function agruparHistoricoPorAnoMes(peticoes) {
  const porAno = new Map();

  for (const peticao of peticoes ?? []) {
    const { ano, mes } = chaveAnoMes(dataReferenciaHistorico(peticao));
    if (!porAno.has(ano)) porAno.set(ano, new Map());
    const porMes = porAno.get(ano);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push(peticao);
  }

  const ordenarItens = (a, b) => {
    const ta = new Date(dataReferenciaHistorico(a)).getTime();
    const tb = new Date(dataReferenciaHistorico(b)).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  };

  return [...porAno.entries()]
    .sort(([anoA], [anoB]) => anoB - anoA)
    .map(([ano, porMes]) => ({
      ano: ano || null,
      labelAno: ano ? String(ano) : 'Sem data',
      meses: [...porMes.entries()]
        .sort(([mesA], [mesB]) => mesB - mesA)
        .map(([mes, items]) => ({
          mes,
          label: labelMes(ano, mes),
          items: [...items].sort(ordenarItens),
        })),
    }));
}

/**
 * @param {{
 *   peticao: import('../../api/peticoesProjudiApi.js').ProjudiPeticao,
 *   onReabrir?: (peticaoId: number) => void,
 *   onCancelarAgendamento?: (peticaoId: number) => void,
 *   operacao?: string | null,
 * }} props
 */
function HistoricoPeticaoItem({ peticao: p, onReabrir, onCancelarAgendamento, operacao = null }) {
  const arquivos = p.arquivos || [];
  const [arquivosAbertos, setArquivosAbertos] = useState(false);
  const arquivosExtras = arquivos.length > ARQUIVOS_VISIVEIS_PADRAO;
  const arquivosVisiveis = arquivosAbertos ? arquivos : arquivos.slice(0, ARQUIVOS_VISIVEIS_PADRAO);

  return (
    <li className="px-3 py-2.5 text-sm space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-slate-900">
          #{p.id}
          {p.complemento ? ` · ${p.complemento}` : ''}
        </span>
        <span className="text-xs text-slate-500">{formatDateTime(dataReferenciaHistorico(p))}</span>
      </div>
      <div className="font-mono text-xs text-slate-600 truncate">{p.numeroProcesso}</div>
      {arquivosVisiveis.map((a) => (
        <div key={a.id ?? a.ordem} className="text-xs text-slate-600 truncate pl-2 border-l-2 border-slate-200">
          {a.nomeOriginal || '—'}
        </div>
      ))}
      {arquivosExtras ? (
        <button
          type="button"
          className="text-xs text-sky-700 hover:underline"
          onClick={() => setArquivosAbertos((v) => !v)}
        >
          {arquivosAbertos
            ? 'Mostrar menos arquivos'
            : `+ ${arquivos.length - ARQUIVOS_VISIVEIS_PADRAO} arquivo(s)`}
        </button>
      ) : null}
      {p.protocoloMensagem ? (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1 line-clamp-3">
          {p.protocoloMensagem}
        </p>
      ) : null}
      {podeCancelarAgendamentoProtocolo(p) ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-violet-800">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span>Protocolo agendado: {formatDateTime(p.protocoloAgendadoPara)}</span>
          {onCancelarAgendamento ? (
            <button
              type="button"
              className="text-rose-700 hover:underline disabled:opacity-50"
              disabled={operacao === `cancelar-ag-${p.id}`}
              onClick={() => onCancelarAgendamento(p.id)}
            >
              Cancelar agendamento
            </button>
          ) : null}
        </div>
      ) : null}
      {p.status === 'ERRO' && onReabrir ? (
        <button
          type="button"
          className="text-xs rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          disabled={operacao === `reabrir-${p.id}`}
          onClick={() => onReabrir(p.id)}
        >
          {operacao === `reabrir-${p.id}` ? (
            <Loader2 className="w-3 h-3 animate-spin inline" aria-hidden />
          ) : null}
          Reabrir p/ protocolar
        </button>
      ) : null}
    </li>
  );
}

/**
 * @param {{
 *   peticoes: import('../../api/peticoesProjudiApi.js').ProjudiPeticao[],
 *   totalElements?: number,
 *   dias?: number,
 *   hasMore?: boolean,
 *   loadingMore?: boolean,
 *   onLoadMore?: () => void,
 *   onVerHistoricoAnterior?: () => void,
 *   onReabrir?: (peticaoId: number) => void,
 *   onCancelarAgendamento?: (peticaoId: number) => void,
 *   operacao?: string | null,
 * }} props
 */
export function PeticaoHistoricoLista({
  peticoes,
  totalElements,
  dias = 7,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onVerHistoricoAnterior,
  onReabrir,
  onCancelarAgendamento,
  operacao = null,
}) {
  const grupos = useMemo(() => agruparHistoricoPorAnoMes(peticoes), [peticoes]);
  const [mesesAbertos, setMesesAbertos] = useState(() => new Set());

  useEffect(() => {
    if (grupos.length === 0) return;
    const primeiro = grupos[0]?.meses?.[0];
    if (!primeiro) return;
    const chave = chaveGrupoMes(grupos[0].labelAno, primeiro.mes);
    setMesesAbertos((prev) => (prev.size === 0 ? new Set([chave]) : prev));
  }, [grupos]);

  const toggleMes = (anoLabel, mes) => {
    const chave = chaveGrupoMes(anoLabel, mes);
    setMesesAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  };

  const total = totalElements ?? peticoes.length;
  const tituloPeriodo = dias > 0 ? `Últimos ${dias} dias` : 'Histórico completo';

  if (!peticoes.length && !hasMore && !onVerHistoricoAnterior) {
    return <p className="text-sm text-slate-500">Nenhum registro no histórico.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        {tituloPeriodo}: exibindo {peticoes.length} de {total} registro(s).
        {dias > 0 ? ' Meses recolhidos podem ser expandidos.' : ' Use carregar mais para períodos anteriores.'}
      </p>

      <div className="space-y-6">
        {grupos.map((grupoAno) => (
          <section key={grupoAno.labelAno} className="space-y-2">
            <h3 className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-1 pb-1.5 text-base font-semibold text-slate-800 backdrop-blur-sm">
              {grupoAno.labelAno}
            </h3>
            <div className="space-y-2">
              {grupoAno.meses.map((grupoMes) => {
                const chave = chaveGrupoMes(grupoAno.labelAno, grupoMes.mes);
                const aberto = mesesAbertos.has(chave);
                return (
                  <div key={chave} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                      aria-expanded={aberto}
                      onClick={() => toggleMes(grupoAno.labelAno, grupoMes.mes)}
                    >
                      {aberto ? (
                        <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" aria-hidden />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" aria-hidden />
                      )}
                      <span className="text-sm font-medium text-slate-700">{grupoMes.label}</span>
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {grupoMes.items.length}
                      </span>
                    </button>
                    {aberto ? (
                      <ul className="divide-y divide-slate-100 border-t border-slate-100">
                        {grupoMes.items.map((p) => (
                          <HistoricoPeticaoItem
                            key={p.id}
                            peticao={p}
                            onReabrir={onReabrir}
                            onCancelarAgendamento={onCancelarAgendamento}
                            operacao={operacao}
                          />
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {hasMore && onLoadMore ? (
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={loadingMore}
          onClick={() => onLoadMore()}
        >
          {loadingMore ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" aria-hidden />
              Carregando…
            </>
          ) : (
            `Carregar mais (${peticoes.length} de ${total})`
          )}
        </button>
      ) : null}

      {dias > 0 && onVerHistoricoAnterior ? (
        <button
          type="button"
          className="w-full rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100"
          onClick={() => onVerHistoricoAnterior()}
        >
          Ver histórico anterior a {dias} dias
        </button>
      ) : null}

      {!peticoes.length ? (
        <p className="text-sm text-slate-500">Nenhum registro no período selecionado.</p>
      ) : null}
    </div>
  );
}
