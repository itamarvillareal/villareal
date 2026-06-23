import { Loader2 } from 'lucide-react';
import { confiancaInfo } from '../../data/imoveisReconciliacao.js';
import { rotuloCompetenciaCurta } from '../../data/imoveisAluguelChecklist.js';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200 bg-slate-100 whitespace-nowrap';
const td = 'px-3 py-2 text-sm text-slate-800 border-b border-slate-100 align-top';

/**
 * Pendências do mês selecionado — ação única para marcar aluguel (inclui adoção de órfãos).
 */
export function ImoveisPendenciasAluguel({
  competencia,
  itemMatriz,
  repasseInterno,
  salvando,
  gerandoRepasses,
  onConfirmarAluguel,
  onDesvincular,
  onGerarRepasse,
}) {
  if (!competencia) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
        Selecione um mês no checklist.
      </div>
    );
  }

  const rotuloMes = rotuloCompetenciaCurta(competencia);
  const estado = String(itemMatriz?.estado ?? '').toUpperCase();
  const vinc = itemMatriz?.aluguelVinculado;
  const candidatos = Array.isArray(itemMatriz?.candidatos) ? itemMatriz.candidatos : [];

  if (estado === 'VINCULADO' && vinc) {
    const podeRepasse =
      repasseInterno &&
      String(itemMatriz?.statusRepasse ?? '').toUpperCase() === 'PENDENTE' &&
      Number(itemMatriz?.aluguelRecebido) > 0;

    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-emerald-900">
              {rotuloMes} · aluguel vinculado
            </h3>
            <p className="text-xs text-emerald-800 mt-0.5">
              {formatBRL(vinc.valor)} · {vinc.data ? String(vinc.data).slice(0, 10) : '—'} · {vinc.descricao || '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {podeRepasse ? (
              <button
                type="button"
                disabled={gerandoRepasses}
                onClick={() => onGerarRepasse(competencia)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-40"
              >
                {gerandoRepasses ? 'Gerando…' : 'Gerar repasse interno'}
              </button>
            ) : null}
            <button
              type="button"
              disabled={salvando}
              onClick={() => onDesvincular(vinc.vinculoId)}
              className="px-3 py-1.5 rounded-md border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50 disabled:opacity-40"
            >
              Desvincular
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (candidatos.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">{rotuloMes} · sem candidato automático</h3>
        <p className="text-xs text-slate-500">
          Nenhum crédito compatível com o valor do aluguel neste mês. Verifique o extrato (abaixo) ou classifique
          manualmente no Financeiro e volte aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">
          {rotuloMes} · {candidatos.length === 1 ? 'confirmar aluguel' : 'escolher aluguel'}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Um clique classifica no processo (se necessário) e vincula como aluguel desta competência.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr>
              <th className={th}>Data</th>
              <th className={th}>Descrição</th>
              <th className={`${th} text-right`}>Valor</th>
              <th className={th}>Origem</th>
              <th className={th}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {candidatos.map((c) => {
              const conf = confiancaInfo(c.confianca);
              const adocao = c.classificaAoConfirmar || String(c.origem).toUpperCase() === 'ORFAO';
              return (
                <tr key={c.lancamentoFinanceiroId} className={adocao ? 'bg-amber-50/40' : ''}>
                  <td className={`${td} tabular-nums whitespace-nowrap`}>
                    {c.data ? String(c.data).slice(0, 10) : '—'}
                  </td>
                  <td className={td}>
                    <div>{c.descricao || '—'}</div>
                    <span
                      className={`inline-flex mt-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${conf.cls}`}
                    >
                      {conf.label}
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums font-medium text-emerald-800`}>
                    {formatBRL(c.valor)}
                  </td>
                  <td className={`${td} text-xs text-slate-600`}>
                    {adocao ? 'Sem processo (adotar)' : 'No processo'}
                  </td>
                  <td className={td}>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => onConfirmarAluguel(c, competencia)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
                      {adocao ? 'Adotar e marcar aluguel' : 'Marcar como aluguel'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
